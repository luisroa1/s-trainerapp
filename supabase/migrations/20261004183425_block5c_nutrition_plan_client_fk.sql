-- Atomic and repeatable cleanup + referential integrity change.
-- Rollback: drop nutrition_plans_client_id_fkey. The deleted row is confirmed
-- disposable demo data; restore it only if explicitly needed, from the exact
-- pre-migration row snapshot (never synthesize or reassign it).
DO $migration$
DECLARE
  v_client_id_attnum smallint;
  v_client_pk_attnum smallint;
  v_exact_fk_exists boolean;
BEGIN
  -- Remove only the confirmed demo orphan, and only when both identifiers match.
  DELETE FROM public.nutrition_plans
  WHERE id = 'nut-juan'
    AND client_id = 'cli-juan';

  SELECT attnum::smallint
    INTO STRICT v_client_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.nutrition_plans'::regclass
    AND attname = 'client_id'
    AND NOT attisdropped;

  SELECT attnum::smallint
    INTO STRICT v_client_pk_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.clients'::regclass
    AND attname = 'id'
    AND NOT attisdropped;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint AS fk
    WHERE fk.contype = 'f'
      AND fk.conrelid = 'public.nutrition_plans'::regclass
      AND fk.confrelid = 'public.clients'::regclass
      AND fk.conkey = ARRAY[v_client_id_attnum]
      AND fk.confkey = ARRAY[v_client_pk_attnum]
      AND fk.confdeltype = 'r'
      AND fk.convalidated
  )
  INTO v_exact_fk_exists;

  IF NOT v_exact_fk_exists THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.nutrition_plans'::regclass
        AND conname = 'nutrition_plans_client_id_fkey'
    ) THEN
      RAISE EXCEPTION 'Constraint nutrition_plans_client_id_fkey exists with a different definition';
    END IF;

    ALTER TABLE public.nutrition_plans
      ADD CONSTRAINT nutrition_plans_client_id_fkey
      FOREIGN KEY (client_id)
      REFERENCES public.clients (id)
      ON DELETE RESTRICT;
  END IF;
END
$migration$;
