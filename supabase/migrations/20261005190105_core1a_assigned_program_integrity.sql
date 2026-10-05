-- CORE 1A: make clients.assigned_program_id an explicit nullable FK.
-- Existing rows are checked before changing schema; no assignment is repaired here.

DO $preflight$
DECLARE
  v_column_type text;
  v_default text;
  v_clients_attnum smallint;
  v_programs_attnum smallint;
  v_fk record;
BEGIN
  SELECT c.data_type
    INTO STRICT v_column_type
  FROM information_schema.columns AS c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'clients'
    AND c.column_name = 'assigned_program_id';

  IF v_column_type <> 'text' THEN
    RAISE EXCEPTION 'CORE 1A: clients.assigned_program_id debe seguir siendo text; encontrado %', v_column_type;
  END IF;

  SELECT pg_get_expr(d.adbin, d.adrelid)
    INTO v_default
  FROM pg_attrdef AS d
  JOIN pg_attribute AS a
    ON a.attrelid = d.adrelid AND a.attnum = d.adnum
  WHERE d.adrelid = 'public.clients'::regclass
    AND a.attname = 'assigned_program_id';

  IF v_default IS NOT NULL AND v_default <> '''prog-1''::text' THEN
    RAISE EXCEPTION 'CORE 1A: default inesperado para clients.assigned_program_id: %', v_default;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.assigned_program_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.programs AS p WHERE p.id = c.assigned_program_id
      )
  ) THEN
    RAISE EXCEPTION 'CORE 1A: existe assigned_program_id sin programa correspondiente; no se modificaron datos.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clients AS c
    JOIN public.programs AS p ON p.id = c.assigned_program_id
    WHERE c.assigned_program_id IS NOT NULL
      AND p.trainer_id IS DISTINCT FROM c.trainer_id
  ) THEN
    RAISE EXCEPTION 'CORE 1A: existe una asignación entre Trainers distintos; no se modificaron datos.';
  END IF;

  SELECT a.attnum INTO STRICT v_clients_attnum
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.clients'::regclass
    AND a.attname = 'assigned_program_id' AND NOT a.attisdropped;

  SELECT a.attnum INTO STRICT v_programs_attnum
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.programs'::regclass
    AND a.attname = 'id' AND NOT a.attisdropped;

  SELECT c.contype, c.conkey, c.confrelid, c.confkey, c.confdeltype, c.convalidated
    INTO v_fk
  FROM pg_constraint AS c
  WHERE c.conrelid = 'public.clients'::regclass
    AND c.conname = 'clients_assigned_program_id_fkey';

  IF FOUND AND NOT (
    v_fk.contype = 'f'
    AND v_fk.conkey = ARRAY[v_clients_attnum]::smallint[]
    AND v_fk.confrelid = 'public.programs'::regclass
    AND v_fk.confkey = ARRAY[v_programs_attnum]::smallint[]
    AND v_fk.confdeltype = 'r'
  ) THEN
    RAISE EXCEPTION 'CORE 1A: existe clients_assigned_program_id_fkey con una definición distinta.';
  END IF;
END;
$preflight$;

ALTER TABLE public.clients
  ALTER COLUMN assigned_program_id DROP DEFAULT;

DO $add_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clients'::regclass
      AND conname = 'clients_assigned_program_id_fkey'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_assigned_program_id_fkey
      FOREIGN KEY (assigned_program_id)
      REFERENCES public.programs(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END;
$add_fk$;

ALTER TABLE public.clients
  VALIDATE CONSTRAINT clients_assigned_program_id_fkey;
