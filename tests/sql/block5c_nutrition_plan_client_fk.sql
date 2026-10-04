-- Run only against the isolated Supabase project after applying the migration.
-- All temporary writes are enclosed in a transaction that ends with ROLLBACK.
BEGIN;

-- Find an existing trainer/client pair and simulate only that authenticated
-- trainer's request claims; no Auth users or persistent fixture rows are made.
DO $setup$
DECLARE
  v_trainer_id text;
  v_client_id text;
BEGIN
  SELECT p.id::text, c.id
    INTO v_trainer_id, v_client_id
  FROM public.profiles AS p
  JOIN public.clients AS c ON c.trainer_id = p.id::text
  WHERE p.role = 'trainer'
  ORDER BY c.id
  LIMIT 1;

  IF v_trainer_id IS NULL OR v_client_id IS NULL THEN
    RAISE EXCEPTION 'Test requires an existing trainer profile with an owned client';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_trainer_id, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_trainer_id, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('block5c.trainer_id', v_trainer_id, true);
  PERFORM set_config('block5c.client_id', v_client_id, true);
END
$setup$;

SET LOCAL ROLE authenticated;

-- A legitimate Trainer INSERT, SELECT, and DELETE still works under the
-- existing RLS policies when client_id references their existing client.
DO $rls$
DECLARE
  v_trainer_id text := current_setting('block5c.trainer_id');
  v_client_id text := current_setting('block5c.client_id');
  v_plan_id text := 'block5c-rls-' || txid_current()::text;
BEGIN
  INSERT INTO public.nutrition_plans (id, client_id, trainer_id, data)
  VALUES (v_plan_id, v_client_id, v_trainer_id, '{}'::jsonb);

  IF NOT EXISTS (
    SELECT 1 FROM public.nutrition_plans WHERE id = v_plan_id
  ) THEN
    RAISE EXCEPTION 'Trainer RLS could not read its newly inserted plan';
  END IF;

  DELETE FROM public.nutrition_plans WHERE id = v_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trainer RLS could not delete its temporary plan';
  END IF;
END
$rls$;

RESET ROLE;

-- The FK rejects an invalid client_id specifically with the new constraint.
DO $fk_reject$
DECLARE
  v_constraint_name text;
BEGIN
  BEGIN
    INSERT INTO public.nutrition_plans (id, client_id, trainer_id, data)
    VALUES ('block5c-invalid-' || txid_current()::text,
            'block5c-client-does-not-exist',
            'block5c-test-trainer',
            '{}'::jsonb);
    RAISE EXCEPTION 'Expected a foreign_key_violation for nonexistent client_id';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF v_constraint_name <> 'nutrition_plans_client_id_fkey' THEN
      RAISE EXCEPTION 'Unexpected FK rejected invalid client_id: %', v_constraint_name;
    END IF;
  END;
END
$fk_reject$;

-- RESTRICT prevents deleting a client while a nutrition plan references it.
DO $restrict$
DECLARE
  v_client_id text;
  v_plan_id text := 'block5c-restrict-' || txid_current()::text;
  v_constraint_name text;
BEGIN
  SELECT c.id INTO v_client_id
  FROM public.clients AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.nutrition_plans AS np WHERE np.client_id = c.id
  )
  ORDER BY c.id
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Test requires one existing client without a nutrition plan';
  END IF;

  INSERT INTO public.nutrition_plans (id, client_id, trainer_id, data)
  VALUES (v_plan_id, v_client_id, 'block5c-test-trainer', '{}'::jsonb);

  BEGIN
    DELETE FROM public.clients WHERE id = v_client_id;
    RAISE EXCEPTION 'Expected RESTRICT to reject deleting a referenced client';
  EXCEPTION WHEN foreign_key_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF v_constraint_name <> 'nutrition_plans_client_id_fkey' THEN
      RAISE EXCEPTION 'Unexpected FK prevented client deletion: %', v_constraint_name;
    END IF;
  END;

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = v_client_id) THEN
    RAISE EXCEPTION 'RESTRICT test unexpectedly removed the client';
  END IF;

  DELETE FROM public.nutrition_plans WHERE id = v_plan_id;
END
$restrict$;

ROLLBACK;
