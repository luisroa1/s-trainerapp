-- Run only against an isolated project after the adapted Block 5E migration.
-- Uses existing Auth/profile identities; every temporary write is rolled back.
BEGIN;

DO $setup$
DECLARE
  v_trainer_a uuid;
  v_trainer_b uuid;
  v_admin uuid;
  v_client uuid;
  v_client_row text;
  v_client_program text;
  v_prefix text := 'block5e-rls1-' || txid_current()::text;
BEGIN
  SELECT p.id INTO v_trainer_a
  FROM public.profiles p
  WHERE p.role='trainer'
  ORDER BY p.id LIMIT 1;
  SELECT p.id INTO v_trainer_b
  FROM public.profiles p
  WHERE p.role='trainer' AND p.id<>v_trainer_a
  ORDER BY p.id LIMIT 1;
  SELECT p.id INTO v_admin FROM public.profiles p WHERE p.role='admin' ORDER BY p.id LIMIT 1;
  SELECT p.id,c.id,c.assigned_program_id
  INTO v_client,v_client_row,v_client_program
  FROM public.profiles p JOIN public.clients c ON c.user_id=p.id
  WHERE p.role='client' AND c.assigned_program_id IS NOT NULL
  ORDER BY p.id LIMIT 1;

  IF v_trainer_a IS NULL OR v_trainer_b IS NULL OR v_admin IS NULL
     OR v_client IS NULL OR v_client_row IS NULL OR v_client_program IS NULL THEN
    RAISE EXCEPTION '5E isolated test requires existing trainer A/B, Admin, and linked assigned Client fixtures';
  END IF;
  PERFORM set_config('block5e5.trainer_a',v_trainer_a::text,true);
  PERFORM set_config('block5e5.trainer_b',v_trainer_b::text,true);
  PERFORM set_config('block5e5.admin',v_admin::text,true);
  PERFORM set_config('block5e5.client',v_client::text,true);
  PERFORM set_config('block5e5.client_row',v_client_row,true);
  PERFORM set_config('block5e5.client_program',v_client_program,true);
  PERFORM set_config('block5e5.prefix',v_prefix,true);
  PERFORM set_config('block5e5.program_a',v_prefix||'-program-a',true);
  PERFORM set_config('block5e5.program_b',v_prefix||'-program-b',true);
  PERFORM set_config('block5e5.client_a',v_prefix||'-client-a',true);
  PERFORM set_config('block5e5.client_admin',v_prefix||'-client-admin',true);
  PERFORM set_config('block5e5.plan_a',v_prefix||'-plan-a',true);
END
$setup$;

DO $schema_assertions$
DECLARE
  v_table text;
  v_policy_count integer;
  v_insert_check text;
  v_trigger_definer boolean;
  v_trigger_owner text;
  v_trigger_acl text;
  v_trigger_config text[];
  v_trigger_body text;
  v_structural_body text;
  v_role_body text;
BEGIN
  FOR v_table IN SELECT unnest(ARRAY['clients','programs','nutrition_plans']) LOOP
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name=v_table AND column_name='trainer_id') <> 'uuid'
       OR (SELECT is_nullable FROM information_schema.columns
           WHERE table_schema='public' AND table_name=v_table AND column_name='trainer_id') <> 'NO'
       OR (SELECT column_default FROM information_schema.columns
           WHERE table_schema='public' AND table_name=v_table AND column_name='trainer_id') IS NOT NULL THEN
      RAISE EXCEPTION '% trainer_id must be UUID NOT NULL with no default',v_table;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',v_table)::regclass) THEN
      RAISE EXCEPTION 'RLS is not enabled for %',v_table;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_constraint
      WHERE conname IN ('clients_trainer_id_fkey','programs_trainer_id_fkey','nutrition_plans_trainer_id_fkey')
        AND contype='f' AND confrelid='public.profiles'::regclass AND confdeltype='r' AND convalidated) <> 3 THEN
    RAISE EXCEPTION 'Expected all three trainer_id -> profiles(id) RESTRICT FKs';
  END IF;

  SELECT count(*) INTO v_policy_count FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('clients','programs','nutrition_plans');
  IF v_policy_count<>12 THEN RAISE EXCEPTION 'Expected the audited set of 12 policies'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('clients','programs','nutrition_plans')
      AND concat_ws(' ',qual,with_check) ~* 'trainer_id\s*=\s*\(?auth\.uid\(\)\)?::text'
  ) THEN RAISE EXCEPTION 'A trainer_id policy comparison still casts to text'; END IF;

  SELECT with_check INTO STRICT v_insert_check
  FROM pg_policies WHERE schemaname='public' AND tablename='clients' AND policyname='clients_insert';
  IF position('programs' IN v_insert_check) > 0 THEN
    RAISE EXCEPTION 'clients_insert reintroduced the recursive programs subquery';
  END IF;
  IF position('role' IN v_insert_check)=0 OR position('auth.uid()' IN v_insert_check)=0
     OR position('trainer' IN v_insert_check)=0 THEN
    RAISE EXCEPTION 'clients_insert lost the role=trainer or auth ownership condition';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('clients','programs','nutrition_plans')
      AND concat_ws(' ',qual,with_check) LIKE '%trainer_id = auth.uid()%'
      AND concat_ws(' ',qual,with_check) NOT LIKE '%role%trainer%'
  ) THEN RAISE EXCEPTION 'A Trainer ownership policy lost its role=trainer condition'; END IF;

  SELECT p.prosecdef,pg_get_userbyid(p.proowner),p.proacl::text,p.proconfig,lower(pg_get_functiondef(p.oid))
  INTO v_trigger_definer,v_trigger_owner,v_trigger_acl,v_trigger_config,v_trigger_body
  FROM pg_proc p WHERE p.oid='public.enforce_client_program_ownership()'::regprocedure;
  IF v_trigger_definer OR v_trigger_owner<>'postgres'
     OR v_trigger_acl<>'{postgres=X/postgres}'
     OR v_trigger_config<>ARRAY['search_path=public, pg_temp']::text[]
     OR position('new.trainer_id is distinct from old.trainer_id' IN v_trigger_body)=0
     OR position('if not public.is_admin()' IN v_trigger_body)>0 THEN
    RAISE EXCEPTION 'RLS1 ownership trigger behavior/ACL/config changed';
  END IF;
  SELECT lower(pg_get_functiondef('public.enforce_client_structural_immutability()'::regprocedure))
  INTO v_structural_body;
  SELECT lower(pg_get_functiondef('public.enforce_profile_role_immutability()'::regprocedure))
  INTO v_role_body;
  IF position('new.trainer_id is distinct from old.trainer_id' IN v_structural_body)=0
     OR position('new.role is distinct from old.role' IN v_role_body)=0 THEN
    RAISE EXCEPTION 'An immutability trigger function lost its guard';
  END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgname IN
      ('trg_clients_program_ownership','trg_clients_structural_immutable','trg_profiles_role_immutable')
      AND tgenabled IN ('O','A') AND NOT tgisinternal)<>3 THEN
    RAISE EXCEPTION 'Expected all existing integrity triggers enabled';
  END IF;
END
$schema_assertions$;

SET LOCAL ROLE authenticated;

DO $create_program_b$
DECLARE
  v_trainer_b uuid := current_setting('block5e5.trainer_b')::uuid;
  v_program_b text := current_setting('block5e5.program_b');
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_trainer_b::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_trainer_b,'role','authenticated')::text,true);
  INSERT INTO public.programs(id,name,trainer_id,data)
  VALUES(v_program_b,'Temporary 5E program B',v_trainer_b,'{}'::jsonb);
END
$create_program_b$;

DO $trainer_a_crud$
DECLARE
  v_trainer_a uuid := current_setting('block5e5.trainer_a')::uuid;
  v_program_a text := current_setting('block5e5.program_a');
  v_client_a text := current_setting('block5e5.client_a');
  v_client_row text := current_setting('block5e5.client_row');
  v_plan_a text := current_setting('block5e5.plan_a');
  v_program_b text := current_setting('block5e5.program_b');
  v_trainer_b uuid := current_setting('block5e5.trainer_b')::uuid;
  v_rejected boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_trainer_a::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_trainer_a,'role','authenticated')::text,true);

  INSERT INTO public.programs(id,name,trainer_id,data)
  VALUES(v_program_a,'Temporary 5E program A',v_trainer_a,'{}'::jsonb);
  UPDATE public.programs SET name='Updated by owner' WHERE id=v_program_a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trainer could not update own program'; END IF;

  INSERT INTO public.clients(id,name,trainer_id,assigned_program_id,data)
  VALUES(v_client_a,'Temporary 5E client',v_trainer_a,v_program_a,'{}'::jsonb);
  IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=v_client_a) THEN
    RAISE EXCEPTION 'Trainer could not read own client';
  END IF;

  v_rejected:=false;
  BEGIN
    UPDATE public.clients SET user_id=v_trainer_b WHERE id=v_client_row;
  EXCEPTION WHEN raise_exception THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer bypassed structural user_id immutability'; END IF;

  INSERT INTO public.nutrition_plans(id,client_id,trainer_id,data)
  VALUES(v_plan_a,v_client_a,v_trainer_a,'{}'::jsonb);
  UPDATE public.nutrition_plans SET data='{"ok":true}'::jsonb WHERE id=v_plan_a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trainer could not update own nutrition plan'; END IF;

  v_rejected:=false;
  BEGIN
    INSERT INTO public.clients(id,name,trainer_id,assigned_program_id)
    VALUES(v_client_a||'-foreign', 'Temporary 5E client',v_trainer_a,v_program_b);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer accepted another Trainer''s program'; END IF;

  v_rejected:=false;
  BEGIN
    INSERT INTO public.clients(id,name,trainer_id,assigned_program_id)
    VALUES(v_client_a||'-missing', 'Temporary 5E client',v_trainer_a,'missing-5e-program');
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer accepted a nonexistent program'; END IF;

  v_rejected:=false;
  BEGIN
    UPDATE public.clients SET assigned_program_id=v_program_b WHERE id=v_client_a;
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer reassigned client to another Trainer''s program'; END IF;

  v_rejected:=false;
  BEGIN
    UPDATE public.clients SET trainer_id=v_trainer_b WHERE id=v_client_a;
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer changed owner while retaining previous Trainer''s program'; END IF;
END
$trainer_a_crud$;

DO $trainer_b_isolation$
DECLARE
  v_trainer_b uuid := current_setting('block5e5.trainer_b')::uuid;
  v_program_a text := current_setting('block5e5.program_a');
  v_client_a text := current_setting('block5e5.client_a');
  v_plan_a text := current_setting('block5e5.plan_a');
  v_rows bigint;
  v_rejected boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_trainer_b::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_trainer_b,'role','authenticated')::text,true);
  IF EXISTS(SELECT 1 FROM public.programs WHERE id=v_program_a)
     OR EXISTS(SELECT 1 FROM public.clients WHERE id=v_client_a)
     OR EXISTS(SELECT 1 FROM public.nutrition_plans WHERE id=v_plan_a) THEN
    RAISE EXCEPTION 'Another Trainer can read Trainer A data';
  END IF;
  UPDATE public.programs SET name='forbidden' WHERE id=v_program_a;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>0 THEN RAISE EXCEPTION 'Another Trainer updated Trainer A program'; END IF;
  DELETE FROM public.programs WHERE id=v_program_a;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>0 THEN RAISE EXCEPTION 'Another Trainer deleted Trainer A program'; END IF;
  UPDATE public.clients SET name='forbidden' WHERE id=v_client_a;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>0 THEN RAISE EXCEPTION 'Another Trainer updated Trainer A client'; END IF;
  DELETE FROM public.clients WHERE id=v_client_a;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>0 THEN RAISE EXCEPTION 'Another Trainer deleted Trainer A client'; END IF;
  UPDATE public.nutrition_plans SET data='{}'::jsonb WHERE id=v_plan_a;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>0 THEN RAISE EXCEPTION 'Another Trainer updated Trainer A plan'; END IF;
  DELETE FROM public.nutrition_plans WHERE id=v_plan_a;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>0 THEN RAISE EXCEPTION 'Another Trainer deleted Trainer A plan'; END IF;

  v_rejected:=false;
  BEGIN
    INSERT INTO public.clients(id,name,trainer_id,assigned_program_id)
    VALUES(v_client_a||'-wrong-owner','Temporary 5E client',current_setting('block5e5.trainer_a')::uuid,NULL);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer B created client owned by Trainer A'; END IF;

  v_rejected:=false;
  BEGIN
    INSERT INTO public.programs(id,name,trainer_id,data)
    VALUES(v_program_a||'-wrong-owner','forbidden',current_setting('block5e5.trainer_a')::uuid,'{}'::jsonb);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer B created program owned by Trainer A'; END IF;

  v_rejected:=false;
  BEGIN
    INSERT INTO public.nutrition_plans(id,client_id,trainer_id,data)
    VALUES(v_plan_a||'-wrong-owner',v_client_a,v_trainer_b,'{}'::jsonb);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer B created plan for Trainer A client'; END IF;
END
$trainer_b_isolation$;

DO $client_role$
DECLARE
  v_client uuid := current_setting('block5e5.client')::uuid;
  v_client_row text := current_setting('block5e5.client_row');
  v_client_program text := current_setting('block5e5.client_program');
  v_prefix text := current_setting('block5e5.prefix');
  v_rejected boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_client,'role','authenticated')::text,true);

  IF NOT EXISTS(SELECT 1 FROM public.programs WHERE id=v_client_program) THEN
    RAISE EXCEPTION 'Client lost SELECT access to its assigned program';
  END IF;

  v_rejected:=false;
  BEGIN
    INSERT INTO public.programs(id,name,trainer_id,data)
    VALUES(v_prefix||'-client-program', 'forbidden',v_client,'{}'::jsonb);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Client UID was accepted as Trainer ownership'; END IF;

  v_rejected:=false;
  BEGIN
    INSERT INTO public.clients(id,name,trainer_id,assigned_program_id)
    VALUES(v_prefix||'-client-row','forbidden',v_client,NULL);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Client inserted a clients row with its UID as trainer_id'; END IF;

  v_rejected:=false;
  BEGIN
    INSERT INTO public.nutrition_plans(id,client_id,trainer_id,data)
    VALUES(v_prefix||'-client-plan',v_client_row,v_client,'{}'::jsonb);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Client UID was accepted as nutrition Trainer ownership'; END IF;
END
$client_role$;

DO $admin_integrity$
DECLARE
  v_admin uuid := current_setting('block5e5.admin')::uuid;
  v_trainer_a uuid := current_setting('block5e5.trainer_a')::uuid;
  v_trainer_b uuid := current_setting('block5e5.trainer_b')::uuid;
  v_program_a text := current_setting('block5e5.program_a');
  v_program_b text := current_setting('block5e5.program_b');
  v_client_admin text := current_setting('block5e5.client_admin');
  v_rejected boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_admin,'role','authenticated')::text,true);
  INSERT INTO public.clients(id,name,trainer_id,assigned_program_id)
  VALUES(v_client_admin,'Temporary Admin client',v_trainer_a,v_program_a);
  UPDATE public.clients SET name='Admin updated coherent client' WHERE id=v_client_admin;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin could not update a coherent client'; END IF;

  v_rejected:=false;
  BEGIN
    UPDATE public.clients SET assigned_program_id=v_program_b WHERE id=v_client_admin;
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Admin changed assignment to incompatible program'; END IF;

  v_rejected:=false;
  BEGIN
    UPDATE public.clients SET trainer_id=v_trainer_b WHERE id=v_client_admin;
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Admin changed owner while retaining incompatible program'; END IF;
  DELETE FROM public.clients WHERE id=v_client_admin;
  IF NOT FOUND THEN RAISE EXCEPTION 'Admin could not delete coherent client'; END IF;
END
$admin_integrity$;

DO $trainer_a_delete$
DECLARE
  v_trainer_a uuid := current_setting('block5e5.trainer_a')::uuid;
  v_program_a text := current_setting('block5e5.program_a');
  v_client_a text := current_setting('block5e5.client_a');
  v_plan_a text := current_setting('block5e5.plan_a');
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_trainer_a::text,true);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_trainer_a,'role','authenticated')::text,true);
  DELETE FROM public.nutrition_plans WHERE id=v_plan_a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trainer could not delete own nutrition plan'; END IF;
  DELETE FROM public.clients WHERE id=v_client_a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trainer could not delete own client'; END IF;
  DELETE FROM public.programs WHERE id=v_program_a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trainer could not delete own program'; END IF;
END
$trainer_a_delete$;

RESET ROLE;

DO $constraints$
DECLARE
  v_missing uuid := '00000000-0000-0000-0000-000000000099';
  v_trainer uuid := current_setting('block5e5.trainer_a')::uuid;
  v_client text := current_setting('block5e5.client_a');
  v_prefix text := current_setting('block5e5.prefix');
  v_blocked boolean;
  v_constraint text;
BEGIN
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id=v_missing) THEN
    RAISE EXCEPTION 'Chosen missing owner UUID unexpectedly exists';
  END IF;

  v_blocked:=false;
  BEGIN
    INSERT INTO public.clients(id,name,trainer_id,assigned_program_id) VALUES(v_prefix||'-invalid-client','invalid',v_missing,NULL);
  EXCEPTION WHEN foreign_key_violation THEN v_blocked:=true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'clients accepted an owner without a profile'; END IF;

  v_blocked:=false;
  BEGIN
    INSERT INTO public.programs(id,name,trainer_id) VALUES(v_prefix||'-invalid-program','invalid',v_missing);
  EXCEPTION WHEN foreign_key_violation THEN v_blocked:=true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'programs accepted an owner without a profile'; END IF;

  v_blocked:=false;
  BEGIN
    INSERT INTO public.nutrition_plans(id,client_id,trainer_id) VALUES(v_prefix||'-invalid-plan',v_client,v_missing);
  EXCEPTION WHEN foreign_key_violation THEN v_blocked:=true;
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'nutrition_plans accepted an owner without a profile'; END IF;

  v_blocked:=false;
  BEGIN INSERT INTO public.clients(id,name,trainer_id,assigned_program_id) VALUES(v_prefix||'-null-client','null',NULL,NULL);
  EXCEPTION WHEN not_null_violation THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'clients accepted NULL trainer_id'; END IF;
  v_blocked:=false;
  BEGIN INSERT INTO public.programs(id,name,trainer_id) VALUES(v_prefix||'-null-program','null',NULL);
  EXCEPTION WHEN not_null_violation THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'programs accepted NULL trainer_id'; END IF;
  v_blocked:=false;
  BEGIN INSERT INTO public.nutrition_plans(id,client_id,trainer_id) VALUES(v_prefix||'-null-plan',v_client,NULL);
  EXCEPTION WHEN not_null_violation THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'nutrition_plans accepted NULL trainer_id'; END IF;

  v_blocked:=false;
  BEGIN DELETE FROM public.profiles WHERE id=v_trainer;
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
    v_blocked:=v_constraint IN ('clients_trainer_id_fkey','programs_trainer_id_fkey','nutrition_plans_trainer_id_fkey');
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'RESTRICT did not protect a referenced Trainer profile'; END IF;
END
$constraints$;

ROLLBACK;
