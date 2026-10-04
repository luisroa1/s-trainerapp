-- Rollback-safe RLS integration harness for the migration with the same name.
-- Runner: BEGIN; append the migration SQL at the marker below; append this
-- file after removing its first marker line; execute as one query; ROLLBACK.
-- The test uses existing isolated-project trainer/client/admin profiles only.
-- It creates table rows transactionally, creates no Auth users, and rolls back.

-- APPLY_CANDIDATE_MIGRATION_HERE

CREATE TEMP TABLE role_policy_test_context ON COMMIT DROP AS
WITH linked AS (
  SELECT tr.id AS trainer_a,
         tr_other.id AS trainer_b,
         client_profile.id AS client_a,
         c.id AS client_row_a,
         c.assigned_program_id AS assigned_program
  FROM public.clients c
  JOIN public.profiles client_profile ON client_profile.id = c.user_id
  JOIN public.programs assigned ON assigned.id = c.assigned_program_id
                               AND assigned.trainer_id = c.trainer_id
  JOIN public.profiles tr ON tr.id::text = c.trainer_id
                          AND tr.role = 'trainer'
  JOIN LATERAL (
    SELECT p.id
    FROM public.profiles p
    WHERE p.role = 'trainer' AND p.id <> tr.id
    ORDER BY p.id
    LIMIT 1
  ) tr_other ON true
  WHERE client_profile.role = 'client'
  ORDER BY c.id
  LIMIT 1
)
SELECT linked.*,
       (SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY id LIMIT 1) AS admin_id,
       '__rls_block2b_' || md5(clock_timestamp()::text || random()::text) AS test_key
FROM linked;

CREATE TEMP TABLE role_policy_test_results (
  case_name text NOT NULL,
  passed boolean NOT NULL,
  detail text NOT NULL
) ON COMMIT DROP;

DO $test$
DECLARE
  ctx role_policy_test_context%ROWTYPE;
  rows_affected integer;
  denied boolean;
  association_unchanged boolean;
  err_state text;
  visible_count integer;
  program_a text;
  program_b text;
  program_client_owned text;
  program_inserted text;
  program_admin text;
  plan_client text;
  plan_client_owned text;
  plan_trainer text;
  plan_move text;
  plan_admin text;
BEGIN
  SELECT * INTO STRICT ctx FROM role_policy_test_context;
  IF ctx.admin_id IS NULL OR ctx.trainer_a IS NULL OR ctx.trainer_b IS NULL
     OR ctx.client_a IS NULL OR ctx.client_row_a IS NULL
     OR ctx.assigned_program IS NULL THEN
    RAISE EXCEPTION 'Required role-policy test principals/data unavailable';
  END IF;

  program_a := ctx.test_key || '_program_a';
  program_b := ctx.test_key || '_program_b';
  program_client_owned := ctx.test_key || '_program_client';
  program_inserted := ctx.test_key || '_program_inserted';
  program_admin := ctx.test_key || '_program_admin';
  plan_client := ctx.test_key || '_plan_client';
  plan_client_owned := ctx.test_key || '_plan_client_owned';
  plan_trainer := ctx.test_key || '_plan_trainer';
  plan_move := ctx.test_key || '_plan_move';
  plan_admin := ctx.test_key || '_plan_admin';

  -- Seed rows as the transaction owner. They are all rolled back at the end.
  INSERT INTO public.clients (id, name, user_id, trainer_id, assigned_program_id, data)
  VALUES (ctx.test_key || '_client_b', 'RLS rollback test client', NULL,
          ctx.trainer_b::text, NULL, '{}'::jsonb);
  INSERT INTO public.programs (id, trainer_id, name, data) VALUES
    (program_a, ctx.trainer_a::text, 'RLS rollback test A', '{}'::jsonb),
    (program_b, ctx.trainer_b::text, 'RLS rollback test B', '{}'::jsonb),
    (program_client_owned, ctx.client_a::text, 'RLS rollback client-owned', '{}'::jsonb);
  INSERT INTO public.nutrition_plans (id, client_id, trainer_id, data) VALUES
    (plan_client, ctx.client_row_a, ctx.trainer_a::text, '{}'::jsonb),
    (plan_client_owned, ctx.client_row_a, ctx.client_a::text, '{}'::jsonb),
    (plan_move, ctx.client_row_a, ctx.trainer_a::text, '{}'::jsonb);

  -- Client cannot claim trainer ownership on INSERT.
  PERFORM set_config('request.jwt.claim.sub', ctx.client_a::text, true);
  PERFORM set_config('role', 'authenticated', true);
  denied := false; err_state := NULL;
  BEGIN
    INSERT INTO public.programs (id, trainer_id, name)
    VALUES (ctx.test_key || '_client_insert_program', ctx.client_a::text, 'forbidden');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
            WHEN OTHERS THEN err_state := SQLSTATE;
  END;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES
    ('client cannot INSERT program with own uid as trainer_id', denied,
     CASE WHEN denied THEN 'RLS rejected write' ELSE coalesce('not rejected; SQLSTATE=' || err_state, 'unexpected result') END);

  -- A client cannot exercise false ownership over a row labelled with its UID.
  PERFORM set_config('role', 'authenticated', true);
  UPDATE public.programs SET name = 'forbidden update' WHERE id = program_client_owned;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES
    ('client cannot UPDATE program by forged ownership', rows_affected = 0,
     'visible affected rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  DELETE FROM public.programs WHERE id = program_client_owned;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES
    ('client cannot DELETE program by forged ownership', rows_affected = 0,
     'visible affected rows=' || rows_affected::text);

  -- Client keeps the existing assigned-program SELECT path.
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO visible_count FROM public.programs WHERE id = ctx.assigned_program;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES
    ('client SELECT of assigned program remains allowed', visible_count = 1,
     'visible rows=' || visible_count::text);

  -- Client cannot claim trainer ownership on nutrition INSERT, but can read
  -- their linked plan using the preserved client_id/user_id branch.
  PERFORM set_config('role', 'authenticated', true);
  denied := false; err_state := NULL;
  BEGIN
    INSERT INTO public.nutrition_plans (id, client_id, trainer_id, data)
    VALUES (ctx.test_key || '_client_insert_plan', ctx.client_row_a,
            ctx.client_a::text, '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
            WHEN OTHERS THEN err_state := SQLSTATE;
  END;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES
    ('client cannot INSERT nutrition plan with own uid as trainer_id', denied,
     CASE WHEN denied THEN 'RLS rejected write' ELSE coalesce('not rejected; SQLSTATE=' || err_state, 'unexpected result') END);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO visible_count FROM public.nutrition_plans WHERE id = plan_client;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES
    ('client SELECT of linked nutrition plan remains allowed', visible_count = 1,
     'visible rows=' || visible_count::text);
  PERFORM set_config('role', 'authenticated', true);
  UPDATE public.nutrition_plans SET data = '{"test": "forbidden"}'::jsonb WHERE id = plan_client_owned;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES
    ('client cannot UPDATE nutrition plan by forged ownership', rows_affected = 0,
     'affected rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  DELETE FROM public.nutrition_plans WHERE id = plan_client_owned;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES
    ('client cannot DELETE nutrition plan by forged ownership', rows_affected = 0,
     'affected rows=' || rows_affected::text);

  -- Trainer A owns CRUD on its program, and cannot see/update/delete B's row.
  PERFORM set_config('request.jwt.claim.sub', ctx.trainer_a::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO visible_count FROM public.programs WHERE id = program_a;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer CRUD: SELECT own program', visible_count = 1, 'visible rows=' || visible_count::text);
  PERFORM set_config('role', 'authenticated', true);
  INSERT INTO public.programs (id, trainer_id, name) VALUES (program_inserted, ctx.trainer_a::text, 'trainer insert');
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer CRUD: INSERT own program', rows_affected = 1, 'inserted rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  UPDATE public.programs SET name = 'trainer updated' WHERE id = program_a;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer CRUD: UPDATE own program', rows_affected = 1, 'updated rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  DELETE FROM public.programs WHERE id = program_a;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer CRUD: DELETE own program', rows_affected = 1, 'deleted rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO visible_count FROM public.programs WHERE id = program_b;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer cannot SELECT other trainer program', visible_count = 0, 'visible rows=' || visible_count::text);
  PERFORM set_config('role', 'authenticated', true);
  UPDATE public.programs SET name = 'forbidden' WHERE id = program_b;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer cannot UPDATE other trainer program', rows_affected = 0, 'affected rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  DELETE FROM public.programs WHERE id = program_b;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer cannot DELETE other trainer program', rows_affected = 0, 'affected rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  denied := false; err_state := NULL;
  BEGIN
    INSERT INTO public.programs (id, trainer_id, name)
    VALUES (ctx.test_key || '_trainer_a_insert_b', ctx.trainer_b::text, 'forbidden');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
            WHEN OTHERS THEN err_state := SQLSTATE;
  END;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer cannot INSERT program for another trainer', denied,
    CASE WHEN denied THEN 'RLS rejected write' ELSE coalesce('not rejected; SQLSTATE=' || err_state, 'unexpected result') END);

  -- Trainer A may manage a plan for its own client. It cannot associate that
  -- plan with trainer B's client, whether at INSERT or in the resulting UPDATE.
  PERFORM set_config('role', 'authenticated', true);
  INSERT INTO public.nutrition_plans (id, client_id, trainer_id, data)
  VALUES (plan_trainer, ctx.client_row_a, ctx.trainer_a::text, '{}'::jsonb);
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer manages nutrition plan for own client: INSERT', rows_affected = 1, 'inserted rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  UPDATE public.nutrition_plans SET data = '{"test": "updated"}'::jsonb WHERE id = plan_trainer;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer manages nutrition plan for own client: UPDATE', rows_affected = 1, 'updated rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  DELETE FROM public.nutrition_plans WHERE id = plan_trainer;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer manages nutrition plan for own client: DELETE', rows_affected = 1, 'deleted rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  denied := false; err_state := NULL;
  BEGIN
    INSERT INTO public.nutrition_plans (id, client_id, trainer_id, data)
    VALUES (ctx.test_key || '_trainer_a_insert_b_plan', ctx.test_key || '_client_b', ctx.trainer_a::text, '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
            WHEN OTHERS THEN err_state := SQLSTATE;
  END;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('trainer cannot INSERT plan for another trainer client', denied,
    CASE WHEN denied THEN 'RLS rejected write' ELSE coalesce('not rejected; SQLSTATE=' || err_state, 'unexpected result') END);
  PERFORM set_config('role', 'authenticated', true);
  denied := false; err_state := NULL;
  BEGIN
    UPDATE public.nutrition_plans SET client_id = ctx.test_key || '_client_b' WHERE id = plan_move;
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
            WHEN OTHERS THEN err_state := SQLSTATE;
  END;
  PERFORM set_config('role', 'none', true);
  SELECT (client_id = ctx.client_row_a) INTO association_unchanged
  FROM public.nutrition_plans WHERE id = plan_move;
  INSERT INTO role_policy_test_results VALUES ('trainer cannot UPDATE plan to another trainer client', denied AND coalesce(association_unchanged, false),
    CASE WHEN denied THEN 'RLS rejected reassignment; original association retained' ELSE coalesce('not rejected; SQLSTATE=' || err_state, 'unexpected result') END);

  -- Admin branch remains independent of trainer ownership.
  PERFORM set_config('request.jwt.claim.sub', ctx.admin_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
  INSERT INTO public.programs (id, trainer_id, name) VALUES (program_admin, ctx.trainer_b::text, 'admin insert');
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('admin can INSERT/own arbitrary program ownership', rows_affected = 1, 'inserted rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO visible_count FROM public.programs WHERE id = program_admin;
  UPDATE public.programs SET name = 'admin updated' WHERE id = program_admin;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('admin can SELECT and UPDATE program', visible_count = 1 AND rows_affected = 1,
    'visible=' || visible_count::text || ', updated=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  DELETE FROM public.programs WHERE id = program_admin;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('admin can DELETE program', rows_affected = 1, 'deleted rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  INSERT INTO public.nutrition_plans (id, client_id, trainer_id, data)
  VALUES (plan_admin, ctx.test_key || '_nonexistent_client', ctx.trainer_b::text, '{}'::jsonb);
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('admin can INSERT plan outside trainer-client ownership', rows_affected = 1, 'inserted rows=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  SELECT count(*) INTO visible_count FROM public.nutrition_plans WHERE id = plan_admin;
  UPDATE public.nutrition_plans SET data = '{"test": "admin"}'::jsonb WHERE id = plan_admin;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('admin can SELECT and UPDATE nutrition plan', visible_count = 1 AND rows_affected = 1,
    'visible=' || visible_count::text || ', updated=' || rows_affected::text);
  PERFORM set_config('role', 'authenticated', true);
  DELETE FROM public.nutrition_plans WHERE id = plan_admin;
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  PERFORM set_config('role', 'none', true);
  INSERT INTO role_policy_test_results VALUES ('admin can DELETE nutrition plan', rows_affected = 1, 'deleted rows=' || rows_affected::text);
END
$test$;

SELECT case_name, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result, detail
FROM role_policy_test_results
ORDER BY case_name;
