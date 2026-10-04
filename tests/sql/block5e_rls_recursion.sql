-- Run only against the isolated Supabase project after applying the RLS1 migration.
-- Existing Auth/profile identities are reused; all inserted rows are rolled back.
BEGIN;

DO $setup$
DECLARE
  v_trainer_a uuid;
  v_trainer_b uuid;
  v_admin uuid;
  v_client uuid;
  v_program_a text;
  v_assigned_program text;
BEGIN
  SELECT p.id INTO v_trainer_a
  FROM public.profiles AS p
  WHERE p.role = 'trainer'
    AND EXISTS (SELECT 1 FROM public.programs AS pr WHERE pr.trainer_id = p.id::text)
  ORDER BY p.id
  LIMIT 1;

  SELECT p.id INTO v_trainer_b
  FROM public.profiles AS p
  WHERE p.role = 'trainer' AND p.id <> v_trainer_a
  ORDER BY p.id
  LIMIT 1;

  SELECT p.id INTO v_admin FROM public.profiles AS p WHERE p.role = 'admin' ORDER BY p.id LIMIT 1;

  SELECT p.id, c.assigned_program_id
  INTO v_client, v_assigned_program
  FROM public.profiles AS p
  JOIN public.clients AS c ON c.user_id = p.id
  WHERE p.role = 'client' AND c.assigned_program_id IS NOT NULL
  ORDER BY p.id
  LIMIT 1;

  SELECT pr.id INTO v_program_a
  FROM public.programs AS pr
  WHERE pr.trainer_id = v_trainer_a::text
  ORDER BY pr.id
  LIMIT 1;

  IF v_trainer_a IS NULL OR v_trainer_b IS NULL OR v_admin IS NULL
     OR v_client IS NULL OR v_program_a IS NULL OR v_assigned_program IS NULL THEN
    RAISE EXCEPTION 'RLS1 test requires existing Trainer A/B, Admin, linked Client, and owned program fixtures';
  END IF;

  PERFORM set_config('block5e_rls1.trainer_a', v_trainer_a::text, true);
  PERFORM set_config('block5e_rls1.trainer_b', v_trainer_b::text, true);
  PERFORM set_config('block5e_rls1.admin', v_admin::text, true);
  PERFORM set_config('block5e_rls1.client', v_client::text, true);
  PERFORM set_config('block5e_rls1.program_a', v_program_a, true);
  PERFORM set_config('block5e_rls1.client_program', v_assigned_program, true);
  PERFORM set_config('block5e_rls1.program_b', 'block5e-rls1-program-b-' || txid_current()::text, true);
  PERFORM set_config('block5e_rls1.client_prefix', 'block5e-rls1-client-' || txid_current()::text, true);
END
$setup$;

-- If the old policy edge remains, this assertion fails with 42P17.
DO $policy_shape$
DECLARE
  v_check text;
BEGIN
  SELECT with_check INTO STRICT v_check
  FROM pg_policies
  WHERE schemaname='public' AND tablename='clients' AND policyname='clients_insert';
  IF position('programs' IN v_check) > 0 THEN
    RAISE EXCEPTION 'clients_insert still references programs';
  END IF;
  IF position('profiles' IN v_check) = 0 OR position('role' IN v_check) = 0
     OR position('trainer' IN v_check) = 0
     OR position('auth.uid()' IN v_check) = 0 THEN
    RAISE EXCEPTION 'clients_insert lost its trainer role or ownership checks';
  END IF;
END
$policy_shape$;

SET LOCAL ROLE authenticated;

DO $trainer_b_program$
DECLARE
  v_trainer_b text := current_setting('block5e_rls1.trainer_b');
  v_program_b text := current_setting('block5e_rls1.program_b');
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_trainer_b, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_trainer_b,'role','authenticated')::text, true);
  INSERT INTO public.programs (id, name, trainer_id, data)
  VALUES (v_program_b, 'RLS1 temporary program', v_trainer_b, '{}'::jsonb);
END
$trainer_b_program$;

DO $trainer_clients$
DECLARE
  v_trainer_a text := current_setting('block5e_rls1.trainer_a');
  v_trainer_b text := current_setting('block5e_rls1.trainer_b');
  v_program_a text := current_setting('block5e_rls1.program_a');
  v_program_b text := current_setting('block5e_rls1.program_b');
  v_prefix text := current_setting('block5e_rls1.client_prefix');
  v_rejected boolean;
  v_error text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_trainer_a, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_trainer_a,'role','authenticated')::text, true);

  -- NULL assignment must insert without recursive policy evaluation.
  INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
  VALUES (v_prefix || '-trainer-null', 'RLS1 temporary client', v_trainer_a, NULL);

  -- A Trainer may assign a program they own.
  INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
  VALUES (v_prefix || '-trainer-own', 'RLS1 temporary client', v_trainer_a, v_program_a);

  v_rejected := false;
  BEGIN
    INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
    VALUES (v_prefix || '-trainer-foreign', 'RLS1 temporary client', v_trainer_a, v_program_b);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer accepted another Trainer''s program'; END IF;

  v_error := NULL;
  BEGIN
    INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
    VALUES (v_prefix || '-trainer-foreign-message', 'RLS1 temporary client', v_trainer_a, v_program_b);
  EXCEPTION WHEN SQLSTATE '42501' THEN GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
  END;
  IF v_error <> 'No autorizado: programa inválido para el entrenador' THEN
    RAISE EXCEPTION 'Foreign program error was not generic';
  END IF;

  v_rejected := false;
  BEGIN
    INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
    VALUES (v_prefix || '-trainer-missing', 'RLS1 temporary client', v_trainer_a, 'block5e-missing-program');
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer accepted a nonexistent program'; END IF;

  v_error := NULL;
  BEGIN
    INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
    VALUES (v_prefix || '-trainer-missing-message', 'RLS1 temporary client', v_trainer_a, 'block5e-missing-program');
  EXCEPTION WHEN SQLSTATE '42501' THEN GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
  END;
  IF v_error <> 'No autorizado: programa inválido para el entrenador' THEN
    RAISE EXCEPTION 'Missing program error was not generic';
  END IF;

  v_rejected := false;
  BEGIN
    INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
    VALUES (v_prefix || '-wrong-owner', 'RLS1 temporary client', v_trainer_b, NULL);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer created a client for another Trainer'; END IF;

  v_rejected := false;
  BEGIN
    UPDATE public.clients SET assigned_program_id = v_program_b
    WHERE id = v_prefix || '-trainer-own';
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer changed assignment to another Trainer''s program'; END IF;

  v_rejected := false;
  BEGIN
    UPDATE public.clients SET trainer_id = v_trainer_b
    WHERE id = v_prefix || '-trainer-own';
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer changed owner while retaining previous Trainer''s program'; END IF;
END
$trainer_clients$;

DO $client_cannot_insert$
DECLARE
  v_client text := current_setting('block5e_rls1.client');
  v_trainer_a text := current_setting('block5e_rls1.trainer_a');
  v_prefix text := current_setting('block5e_rls1.client_prefix');
  v_rejected boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_client, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_client,'role','authenticated')::text, true);
  BEGIN
    INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
    VALUES (v_prefix || '-client-forbidden', 'RLS1 temporary client', v_trainer_a, NULL);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Client inserted a clients row'; END IF;

  -- A Client continues to read the program already assigned to their client row.
  IF NOT EXISTS (
    SELECT 1 FROM public.programs
    WHERE id = current_setting('block5e_rls1.client_program')
  ) THEN
    RAISE EXCEPTION 'Client can no longer read their assigned program';
  END IF;
END
$client_cannot_insert$;

DO $admin_consistency$
DECLARE
  v_admin text := current_setting('block5e_rls1.admin');
  v_trainer_a text := current_setting('block5e_rls1.trainer_a');
  v_trainer_b text := current_setting('block5e_rls1.trainer_b');
  v_program_a text := current_setting('block5e_rls1.program_a');
  v_program_b text := current_setting('block5e_rls1.program_b');
  v_prefix text := current_setting('block5e_rls1.client_prefix');
  v_rejected boolean;
  v_error text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin,'role','authenticated')::text, true);

  INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
  VALUES (v_prefix || '-admin-null', 'RLS1 temporary client', v_trainer_a, NULL);
  INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
  VALUES (v_prefix || '-admin-own', 'RLS1 temporary client', v_trainer_a, v_program_a);

  UPDATE public.clients SET assigned_program_id = NULL
  WHERE id = v_prefix || '-admin-own';
  UPDATE public.clients SET assigned_program_id = v_program_a
  WHERE id = v_prefix || '-admin-own';

  v_rejected := false;
  BEGIN
    INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
    VALUES (v_prefix || '-admin-foreign', 'RLS1 temporary client', v_trainer_a, v_program_b);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Admin inserted an inconsistent program/trainer relation'; END IF;

  v_error := NULL;
  BEGIN
    INSERT INTO public.clients (id, name, trainer_id, assigned_program_id)
    VALUES (v_prefix || '-admin-foreign-message', 'RLS1 temporary client', v_trainer_a, v_program_b);
  EXCEPTION WHEN SQLSTATE '42501' THEN GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
  END;
  IF v_error <> 'No autorizado: programa inválido para el entrenador' THEN
    RAISE EXCEPTION 'Admin foreign program error was not generic';
  END IF;

  v_rejected := false;
  BEGIN
    UPDATE public.clients SET assigned_program_id = v_program_b
    WHERE id = v_prefix || '-admin-own';
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Admin changed assignment to an incompatible program'; END IF;

  v_rejected := false;
  BEGIN
    UPDATE public.clients SET trainer_id = v_trainer_b
    WHERE id = v_prefix || '-admin-own';
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected := true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Admin changed owner while retaining previous Trainer''s program'; END IF;
END
$admin_consistency$;

RESET ROLE;

DO $postconditions$
DECLARE
  v_prefix text := current_setting('block5e_rls1.client_prefix');
  v_program_b text := current_setting('block5e_rls1.program_b');
  v_policy_count integer;
BEGIN
  SELECT count(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname='public' AND tablename IN ('clients','programs','nutrition_plans');
  IF v_policy_count <> 12 THEN RAISE EXCEPTION 'Expected all 12 relevant policies to remain'; END IF;

  IF (SELECT count(*) FROM public.clients WHERE id LIKE v_prefix || '%') <> 4 THEN
    RAISE EXCEPTION 'Unexpected temporary client row count';
  END IF;
  IF (SELECT count(*) FROM public.programs WHERE id = v_program_b) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one temporary Trainer B program';
  END IF;
END
$postconditions$;

ROLLBACK;
