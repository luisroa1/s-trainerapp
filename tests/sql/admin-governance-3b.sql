-- 3B isolated integration assertions. Execute as one request in an explicit
-- transaction; ROLLBACK at EOF removes the single transient Auth identity,
-- ledger/audit rows, profile, relation, and all test-only changes.
BEGIN;

DO $test$
DECLARE
  v_admin uuid;
  v_trainer uuid;
  v_other_trainer uuid;
  v_client uuid;
  v_temp_user uuid := pg_catalog.gen_random_uuid();
  v_temp_client_id text;
  v_email text;
  v_program_id text;
  v_other_program_id text := '3b-test-program-' || pg_catalog.gen_random_uuid()::text;
  v_operation jsonb;
  v_operation_replay jsonb;
  v_finish jsonb;
  v_activation jsonb;
  v_count bigint;
  v_role text;
  v_access text;
  v_correlation uuid := pg_catalog.gen_random_uuid();
  v_idempotency text := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.gen_random_uuid()::text,'UTF8')), 'hex');
  v_denied boolean;
BEGIN
  SELECT id INTO v_admin FROM public.profiles WHERE role = 'admin' LIMIT 1;
  SELECT p.id INTO v_trainer FROM public.profiles p
    JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='enabled'
    JOIN public.programs pr ON pr.trainer_id=p.id::text
    WHERE p.role='trainer' LIMIT 1;
  SELECT c.user_id INTO v_client FROM public.clients c
    JOIN public.account_access aa ON aa.user_id=c.user_id AND aa.state='enabled'
    WHERE c.user_id IS NOT NULL AND c.assigned_program_id IS NOT NULL LIMIT 1;
  SELECT id INTO v_program_id FROM public.programs WHERE trainer_id=v_trainer::text LIMIT 1;
  SELECT id INTO v_other_trainer FROM public.profiles WHERE role='trainer' AND id<>v_trainer LIMIT 1;
  IF v_admin IS NULL OR v_trainer IS NULL OR v_other_trainer IS NULL OR v_client IS NULL OR v_program_id IS NULL THEN
    RAISE EXCEPTION 'fixture precondition failed: enabled Admin, Trainer, assigned Client, and owned Program are required';
  END IF;

  IF (SELECT count(*) FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id
      WHERE p.role='admin' AND aa.state='enabled') < 1 THEN
    RAISE EXCEPTION 'last enabled Admin invariant precondition failed';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.account_access SET state='pending' WHERE user_id=v_trainer;
  v_denied := false;
  BEGIN
    PERFORM public.begin_client_invitation(v_trainer, 'trainer-not-enabled@example.invalid', v_idempotency, v_correlation);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'disabled Trainer passed invite backend authorization'; END IF;
  IF EXISTS (SELECT 1 FROM private.account_operation_ledger WHERE target_email='trainer-not-enabled@example.invalid') THEN
    RAISE EXCEPTION 'disabled Trainer invite created a ledger operation';
  END IF;
  UPDATE public.account_access SET state='enabled' WHERE user_id=v_trainer;

  INSERT INTO public.programs (id,trainer_id,name,data)
  VALUES (v_other_program_id,v_other_trainer::text,'3B transaction test program','{}'::jsonb);
  PERFORM pg_catalog.set_config('test.other_program_id',v_other_program_id,true);

  -- New Auth users ignore user_metadata.role; the trigger creates a pending Client.
  v_email := '3b_txn-' || v_temp_user::text || '@example.invalid';
  v_temp_client_id := '3b-txn-client-' || v_temp_user::text;
  INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES (v_temp_user, 'authenticated', 'authenticated', v_email,
          '{"full_name":"3B transaction test","role":"admin"}'::jsonb, pg_catalog.now(), pg_catalog.now());
  SELECT role INTO v_role FROM public.profiles WHERE id=v_temp_user;
  SELECT state INTO v_access FROM public.account_access WHERE user_id=v_temp_user;
  IF v_role <> 'client' OR v_access <> 'pending' THEN
    RAISE EXCEPTION 'Auth trigger did not create Client/pending state';
  END IF;

  INSERT INTO public.clients (id, user_id, trainer_id, name, email, status, assigned_program_id, data)
  VALUES (v_temp_client_id, v_temp_user, v_trainer::text, '3B transaction test', v_email,
          'Pendiente', NULL, '{}'::jsonb);

  -- The function rejects a non-service JWT claim; successful service calls remain server-only.
  PERFORM pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('role','authenticated','sub',v_temp_user)::text, true);
  v_denied := false;
  BEGIN
    PERFORM public.activate_client_account(v_temp_user, v_correlation);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'activation RPC accepted a non-service role'; END IF;

  -- A real service-side flow records idempotently and verifies the Auth hook result.
  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v_denied := false;
  BEGIN
    PERFORM public.activate_client_account(v_temp_user, v_correlation);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'activation accepted an unconfirmed Auth email'; END IF;
  SELECT state INTO v_access FROM public.account_access WHERE user_id=v_temp_user;
  SELECT count(*) INTO v_count FROM public.clients WHERE id=v_temp_client_id AND status='Pendiente';
  IF v_access <> 'pending' OR v_count <> 1 THEN RAISE EXCEPTION 'unconfirmed activation changed protected state'; END IF;

  v_denied := false;
  BEGIN
    PERFORM public.activate_client_account(v_trainer, v_correlation);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Trainer identity passed Client activation'; END IF;
  v_denied := false;
  BEGIN
    PERFORM public.activate_client_account(v_admin, v_correlation);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'Admin identity passed Client activation'; END IF;

  v_operation := public.begin_client_invitation(v_trainer, v_email, v_idempotency, v_correlation);
  v_operation_replay := public.begin_client_invitation(v_trainer, v_email, v_idempotency, v_correlation);
  IF (v_operation->>'replayed')::boolean OR NOT (v_operation_replay->>'replayed')::boolean
     OR v_operation->>'operation_id' <> v_operation_replay->>'operation_id' THEN
    RAISE EXCEPTION 'invitation ledger idempotency failed';
  END IF;

  -- Confirmation and relation are simulated transactionally: no email is sent.
  UPDATE auth.users SET email_confirmed_at=pg_catalog.now(), updated_at=pg_catalog.now()
  WHERE id=v_temp_user;
  v_finish := public.finish_client_invitation(
    (v_operation->>'operation_id')::uuid, v_temp_user, 'invited', NULL, v_correlation
  );
  IF v_finish->>'state' <> 'invited' THEN RAISE EXCEPTION 'pending invite could not be finalized'; END IF;

  -- Mismatch failure must leave the Client closed and unchanged (atomic failure).
  v_denied := false;
  BEGIN
    UPDATE public.clients SET email='mismatch@example.invalid' WHERE id=v_temp_client_id;
    PERFORM public.activate_client_account(v_temp_user, v_correlation);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'activation accepted a mismatched client email'; END IF;
  SELECT count(*) INTO v_count FROM public.clients
  WHERE id=v_temp_client_id AND user_id=v_temp_user AND status='Pendiente' AND email=v_email;
  SELECT state INTO v_access FROM public.account_access WHERE user_id=v_temp_user;
  IF v_count <> 1 OR v_access <> 'pending' THEN
    RAISE EXCEPTION 'failed activation changed Client relation or opened account';
  END IF;

  v_denied := false;
  BEGIN
    UPDATE public.clients SET email='holder-' || v_temp_user::text || '@example.invalid' WHERE id=v_temp_client_id;
    INSERT INTO public.clients (id,user_id,trainer_id,name,email,status,data)
    VALUES (v_temp_client_id || '-foreign',v_client,v_trainer::text,'3B foreign owner',v_email,'Pendiente','{}'::jsonb);
    PERFORM public.activate_client_account(v_temp_user, v_correlation);
    RAISE EXCEPTION 'activation unexpectedly claimed a foreign-owned row';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'activation claimed a relation owned by another user'; END IF;
  SELECT state INTO v_access FROM public.account_access WHERE user_id=v_temp_user;
  SELECT count(*) INTO v_count FROM public.clients WHERE id=v_temp_client_id AND user_id=v_temp_user AND status='Pendiente';
  IF v_access <> 'pending' OR v_count <> 1 THEN RAISE EXCEPTION 'foreign-owner rejection changed protected state'; END IF;

  v_denied := false;
  BEGIN
    INSERT INTO public.clients (id,user_id,trainer_id,name,email,status,data)
    VALUES (v_temp_client_id || '-duplicate',NULL,v_trainer::text,'3B duplicate',v_email,'Pendiente','{}'::jsonb);
    PERFORM public.activate_client_account(v_temp_user, v_correlation);
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'activation accepted duplicate exact-email Client matches'; END IF;
  SELECT state INTO v_access FROM public.account_access WHERE user_id=v_temp_user;
  SELECT count(*) INTO v_count FROM public.clients WHERE id=v_temp_client_id AND user_id=v_temp_user AND status='Pendiente';
  IF v_access <> 'pending' OR v_count <> 1 THEN RAISE EXCEPTION 'duplicate rejection changed protected state'; END IF;

  v_activation := public.activate_client_account(v_temp_user, v_correlation);
  IF v_activation->>'id' <> v_temp_client_id OR v_activation->>'status' <> 'Activo' THEN
    RAISE EXCEPTION 'valid Client activation response did not match minimal expected fields';
  END IF;
  PERFORM public.activate_client_account(v_temp_user, v_correlation);
  SELECT count(*) INTO v_count FROM public.clients WHERE user_id=v_temp_user;
  SELECT state INTO v_access FROM public.account_access WHERE user_id=v_temp_user;
  IF v_count <> 1 OR v_access <> 'enabled' THEN
    RAISE EXCEPTION 'activation did not converge to one linked row and enabled access';
  END IF;

  -- Trigger metadata, actor state check, and append-only audit behavior.
  SELECT role INTO v_role FROM public.profiles WHERE id=v_temp_user;
  IF v_role <> 'client' THEN RAISE EXCEPTION 'untrusted metadata changed the Auth profile role'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.admin_audit_events WHERE correlation_id=v_correlation) THEN
    RAISE EXCEPTION 'expected audit events were not recorded';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.account_operation_ledger WHERE operation_id=(v_operation->>'operation_id')::uuid AND state='accepted') THEN
    RAISE EXCEPTION 'activation did not finalize the operation ledger';
  END IF;

  -- Last enabled Admin cannot be suspended or demoted by a future privileged path.
  v_denied := false;
  BEGIN
    UPDATE public.account_access SET state='suspended' WHERE user_id=v_admin;
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'last enabled Admin could be suspended'; END IF;
  v_denied := false;
  BEGIN
    UPDATE public.profiles SET role='trainer' WHERE id=v_admin;
  EXCEPTION WHEN SQLSTATE '23514' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'last enabled Admin could be demoted'; END IF;
END;
$test$;

-- Data API impersonation tests use existing enabled identities and real RLS.
SELECT pg_catalog.set_config('test.admin_id', (SELECT id::text FROM public.profiles WHERE role='admin' LIMIT 1), true);
SELECT pg_catalog.set_config('test.admin_clients', (SELECT count(*)::text FROM public.clients), true);
SELECT pg_catalog.set_config('test.admin_programs', (SELECT count(*)::text FROM public.programs), true);
SELECT pg_catalog.set_config('test.admin_nutrition', (SELECT count(*)::text FROM public.nutrition_plans), true);
SELECT pg_catalog.set_config('test.admin_profiles', (SELECT count(*)::text FROM public.profiles), true);
SELECT pg_catalog.set_config('test.admin_trainer_profiles', (SELECT count(*)::text FROM public.trainer_profiles), true);
SELECT pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub',current_setting('test.admin_id'),'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $test_admin$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.clients;
  IF v_count <> current_setting('test.admin_clients')::bigint THEN RAISE EXCEPTION 'enabled Admin lost global clients read'; END IF;
  SELECT count(*) INTO v_count FROM public.programs;
  IF v_count <> current_setting('test.admin_programs')::bigint THEN RAISE EXCEPTION 'enabled Admin lost global programs read'; END IF;
  SELECT count(*) INTO v_count FROM public.nutrition_plans;
  IF v_count <> current_setting('test.admin_nutrition')::bigint THEN RAISE EXCEPTION 'enabled Admin lost global nutrition read'; END IF;
  SELECT count(*) INTO v_count FROM public.profiles;
  IF v_count <> current_setting('test.admin_profiles')::bigint THEN RAISE EXCEPTION 'enabled Admin lost global profile read'; END IF;
  SELECT count(*) INTO v_count FROM public.trainer_profiles;
  IF v_count <> current_setting('test.admin_trainer_profiles')::bigint THEN RAISE EXCEPTION 'enabled Admin lost global trainer-profile read'; END IF;
  PERFORM * FROM public.list_admin_audit_events(100, NULL);
  BEGIN
    UPDATE public.profiles SET role='trainer' WHERE id=current_setting('test.admin_id')::uuid;
    RAISE EXCEPTION 'Admin unexpectedly updated profiles.role through Data API';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.account_access SET state='suspended' WHERE user_id=current_setting('test.admin_id')::uuid;
    RAISE EXCEPTION 'Admin unexpectedly updated account_access through Data API';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.profiles SET full_name=full_name WHERE id=current_setting('test.admin_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin lost legitimate own profile-field update'; END IF;
END;
$test_admin$;
RESET ROLE;

SELECT pg_catalog.set_config('test.trainer_id', (
  SELECT p.id::text FROM public.profiles p JOIN public.programs pr ON pr.trainer_id=p.id::text WHERE p.role='trainer' LIMIT 1
), true);
SELECT pg_catalog.set_config('test.trainer_clients', (SELECT count(*)::text FROM public.clients WHERE trainer_id=current_setting('test.trainer_id')), true);
SELECT pg_catalog.set_config('test.trainer_programs', (SELECT count(*)::text FROM public.programs WHERE trainer_id=current_setting('test.trainer_id')), true);
SELECT pg_catalog.set_config('test.trainer_nutrition', (SELECT count(*)::text FROM public.nutrition_plans WHERE trainer_id=current_setting('test.trainer_id')), true);
SELECT pg_catalog.set_config('test.own_program_id', (SELECT id FROM public.programs WHERE trainer_id=current_setting('test.trainer_id') LIMIT 1), true);
SELECT pg_catalog.set_config('test.insert_client_id', '3b-rls-' || pg_catalog.gen_random_uuid()::text, true);
SELECT pg_catalog.set_config('test.insert_program_id', '3b-rls-program-' || pg_catalog.gen_random_uuid()::text, true);
SELECT pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub',current_setting('test.trainer_id'),'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $test_trainer$
DECLARE v_count bigint; v_other_program text := current_setting('test.other_program_id');
BEGIN
  SELECT count(*) INTO v_count FROM public.clients;
  IF v_count <> current_setting('test.trainer_clients')::bigint THEN RAISE EXCEPTION 'Trainer client visibility changed unexpectedly'; END IF;
  SELECT count(*) INTO v_count FROM public.programs;
  IF v_count <> current_setting('test.trainer_programs')::bigint THEN RAISE EXCEPTION 'Trainer program visibility changed unexpectedly'; END IF;
  INSERT INTO public.programs (id,trainer_id,name,data)
  VALUES (current_setting('test.insert_program_id'),current_setting('test.trainer_id'),'3B Trainer RLS program','{}'::jsonb);
  UPDATE public.programs SET name='3B Trainer RLS program updated' WHERE id=current_setting('test.insert_program_id');
  IF NOT FOUND THEN RAISE EXCEPTION 'Trainer could not update own Program'; END IF;
  DELETE FROM public.programs WHERE id=current_setting('test.insert_program_id');
  IF NOT FOUND THEN RAISE EXCEPTION 'Trainer could not delete own Program'; END IF;
  SELECT count(*) INTO v_count FROM public.nutrition_plans;
  IF v_count <> current_setting('test.trainer_nutrition')::bigint THEN RAISE EXCEPTION 'Trainer nutrition visibility changed unexpectedly'; END IF;
  INSERT INTO public.clients (id,trainer_id,name,email,status,assigned_program_id,data)
  VALUES (current_setting('test.insert_client_id'),current_setting('test.trainer_id'),'3B RLS test',
    '3b-rls-' || pg_catalog.gen_random_uuid()::text || '@example.invalid','Pendiente',
    current_setting('test.own_program_id'),'{}'::jsonb);
  SELECT count(*) INTO v_count FROM public.clients WHERE id=current_setting('test.insert_client_id');
  IF v_count <> 1 THEN RAISE EXCEPTION 'Trainer INSERT with own Program failed'; END IF;
  BEGIN
    UPDATE public.clients SET assigned_program_id=v_other_program WHERE id=current_setting('test.insert_client_id');
    RAISE EXCEPTION 'Trainer assigned another Trainer program';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  DELETE FROM public.clients WHERE id=current_setting('test.insert_client_id');
END;
$test_trainer$;
RESET ROLE;

SELECT pg_catalog.set_config('test.client_id', (SELECT user_id::text FROM public.clients WHERE user_id IS NOT NULL AND assigned_program_id IS NOT NULL LIMIT 1), true);
SELECT pg_catalog.set_config('test.assigned_program_id', (SELECT assigned_program_id FROM public.clients WHERE user_id=current_setting('test.client_id')::uuid AND assigned_program_id IS NOT NULL LIMIT 1), true);
SELECT pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub',current_setting('test.client_id'),'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $test_client$
DECLARE v_count bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.clients WHERE user_id=current_setting('test.client_id')::uuid;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Client lost own linked row'; END IF;
  SELECT count(*) INTO v_count FROM public.programs WHERE id=current_setting('test.assigned_program_id');
  IF v_count <> 1 THEN RAISE EXCEPTION 'Client lost legitimate assigned Program read'; END IF;
  BEGIN
    INSERT INTO public.clients (id,trainer_id,name,status,data)
    VALUES ('3b-client-rls-' || pg_catalog.gen_random_uuid()::text,current_setting('test.client_id'),'3B Client insert','Pendiente','{}'::jsonb);
    RAISE EXCEPTION 'Client unexpectedly inserted a client relation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.account_access SET state='enabled' WHERE user_id=current_setting('test.client_id')::uuid;
    RAISE EXCEPTION 'Client unexpectedly wrote own account_access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET role='admin' WHERE id=current_setting('test.client_id')::uuid;
    RAISE EXCEPTION 'Client unexpectedly updated profiles.role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.profiles SET full_name=full_name WHERE id=current_setting('test.client_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client lost legitimate own profile-field update'; END IF;
END;
$test_client$;
RESET ROLE;

-- Pending, suspended, and absent access state deny all five operational tables.
DO $access_setup$
DECLARE v_id uuid := current_setting('test.client_id')::uuid;
BEGIN
  UPDATE public.account_access SET state='pending' WHERE user_id=v_id;
END;
$access_setup$;
SELECT pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub',current_setting('test.client_id'),'role','authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $pending_gate$
DECLARE n bigint;
BEGIN
  SELECT (SELECT count(*) FROM public.profiles) + (SELECT count(*) FROM public.clients)
       + (SELECT count(*) FROM public.programs) + (SELECT count(*) FROM public.nutrition_plans)
       + (SELECT count(*) FROM public.trainer_profiles) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'pending account accessed operational data'; END IF;
END;
$pending_gate$;
RESET ROLE;

DO $access_setup$
BEGIN
  UPDATE public.account_access SET state='suspended' WHERE user_id=current_setting('test.client_id')::uuid;
END;
$access_setup$;
SET LOCAL ROLE authenticated;
DO $suspended_gate$
DECLARE n bigint;
BEGIN
  SELECT (SELECT count(*) FROM public.profiles) + (SELECT count(*) FROM public.clients)
       + (SELECT count(*) FROM public.programs) + (SELECT count(*) FROM public.nutrition_plans)
       + (SELECT count(*) FROM public.trainer_profiles) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'suspended account accessed operational data'; END IF;
END;
$suspended_gate$;
RESET ROLE;

UPDATE public.account_access SET state='enabled' WHERE user_id=current_setting('test.client_id')::uuid;
DELETE FROM public.account_access WHERE user_id=current_setting('test.client_id')::uuid;
SET LOCAL ROLE authenticated;
DO $missing_gate$
DECLARE n bigint;
BEGIN
  SELECT (SELECT count(*) FROM public.profiles) + (SELECT count(*) FROM public.clients)
       + (SELECT count(*) FROM public.programs) + (SELECT count(*) FROM public.nutrition_plans)
       + (SELECT count(*) FROM public.trainer_profiles) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'missing access row did not fail closed'; END IF;
END;
$missing_gate$;
RESET ROLE;

-- Role/API grants and trigger/RLS invariants are checked explicitly.
DO $acl$
BEGIN
  IF has_function_privilege('anon','public.begin_client_invitation(uuid,text,text,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.begin_client_invitation(uuid,text,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'invitation ledger RPC exposed beyond service_role';
  END IF;
  IF NOT has_function_privilege('service_role','public.begin_client_invitation(uuid,text,text,uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.is_account_enabled()','EXECUTE')
     OR has_function_privilege('service_role','public.is_account_enabled()','EXECUTE') THEN
    RAISE EXCEPTION 'required function EXECUTE privilege missing';
  END IF;
  IF has_column_privilege('anon','public.profiles','role','UPDATE')
     OR has_column_privilege('authenticated','public.profiles','role','UPDATE')
     OR has_column_privilege('service_role','public.profiles','role','UPDATE') THEN
    RAISE EXCEPTION 'profiles.role can still be updated through a Data API table write';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.clients'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.programs'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.nutrition_plans'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.trainer_profiles'::regclass) THEN
    RAISE EXCEPTION 'RLS disabled on an operational table';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='clients'
      AND policyname='clients_insert' AND position('programs' in lower(with_check)) > 0
  ) THEN RAISE EXCEPTION 'clients_insert recurses through programs'; END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.enforce_client_program_ownership()'::regprocedure) THEN
    RAISE EXCEPTION 'RLS1 ownership trigger is no longer invoker';
  END IF;
  IF has_table_privilege('authenticated','private.admin_audit_events','UPDATE')
     OR has_table_privilege('authenticated','private.admin_audit_events','DELETE')
     OR has_table_privilege('service_role','private.admin_audit_events','UPDATE')
     OR has_table_privilege('service_role','private.admin_audit_events','DELETE') THEN
    RAISE EXCEPTION 'audit log can be mutated directly by an application role';
  END IF;
END;
$acl$;

ROLLBACK;
