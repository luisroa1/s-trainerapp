-- CORE 1B: immutable program-prescription snapshots.
-- Apply only to the isolated project until separately approved.

DO $preflight$
BEGIN
  IF to_regclass('public.program_versions') IS NOT NULL
     OR to_regprocedure('public.apply_program_version(text)') IS NOT NULL
     OR to_regprocedure('public.build_program_version_snapshot(jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'CORE 1B precondition failed: versioning objects already exist; inspect before applying.';
  END IF;

  IF to_regclass('public.programs') IS NULL
     OR to_regclass('public.clients') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.account_access') IS NULL THEN
    RAISE EXCEPTION 'CORE 1B precondition failed: required CORE tables are missing.';
  END IF;
END;
$preflight$;

CREATE TABLE public.program_versions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  program_id text NOT NULL
    REFERENCES public.programs(id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK (version_number > 0),
  snapshot jsonb NOT NULL
    CHECK (pg_catalog.jsonb_typeof(snapshot) = 'object'),
  created_by uuid NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT program_versions_program_version_unique UNIQUE (program_id, version_number)
);

ALTER TABLE public.program_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.program_versions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.program_versions TO authenticated;

CREATE POLICY program_versions_select_authorized
  ON public.program_versions
  FOR SELECT TO authenticated
  USING (
    public.is_account_enabled()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.programs AS p
        JOIN public.profiles AS trainer_profile ON trainer_profile.id::text = p.trainer_id::text
        WHERE p.id = program_versions.program_id
          AND p.trainer_id::text = (SELECT auth.uid())::text
          AND trainer_profile.role = 'trainer'
      )
    )
  );

-- Build one allow-listed, executable snapshot shape from persisted program JSON.
-- This helper has no API EXECUTE grants; only the migration owner and the
-- publication function owner may call it.
CREATE FUNCTION public.build_program_version_snapshot(p_days jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_day jsonb;
  v_exercise jsonb;
  v_day_snapshot jsonb;
  v_exercise_snapshot jsonb;
  v_days jsonb := '[]'::jsonb;
  v_exercises jsonb;
  v_day_id uuid;
  v_exercise_id uuid;
  v_day_ids uuid[] := ARRAY[]::uuid[];
  v_exercise_ids uuid[] := ARRAY[]::uuid[];
  v_day_ordinal bigint;
  v_exercise_ordinal bigint;
  v_sets numeric;
  v_reps numeric;
  v_rir numeric;
  v_rest numeric;
BEGIN
  IF pg_catalog.jsonb_typeof(p_days) <> 'array' THEN
    RAISE EXCEPTION 'Program prescription has an invalid day list.' USING ERRCODE = '22023';
  END IF;

  FOR v_day, v_day_ordinal IN
    SELECT item.value, item.ordinality
    FROM pg_catalog.jsonb_array_elements(p_days) WITH ORDINALITY AS item(value, ordinality)
  LOOP
    IF pg_catalog.jsonb_typeof(v_day) <> 'object'
       OR COALESCE(v_day->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR COALESCE(pg_catalog.btrim(v_day->>'title'), '') = '' THEN
      RAISE EXCEPTION 'Program day is missing a stable identity or title.' USING ERRCODE = '22023';
    END IF;
    v_day_id := (v_day->>'id')::uuid;
    IF v_day_id = ANY(v_day_ids) THEN
      RAISE EXCEPTION 'Program day identities must be unique.' USING ERRCODE = '22023';
    END IF;
    v_day_ids := pg_catalog.array_append(v_day_ids, v_day_id);

    v_exercises := v_day->'exercises';
    IF pg_catalog.jsonb_typeof(v_exercises) <> 'array' THEN
      RAISE EXCEPTION 'Program day has an invalid exercise list.' USING ERRCODE = '22023';
    END IF;

    v_exercise_snapshot := '[]'::jsonb;
    FOR v_exercise, v_exercise_ordinal IN
      SELECT item.value, item.ordinality
      FROM pg_catalog.jsonb_array_elements(v_exercises) WITH ORDINALITY AS item(value, ordinality)
    LOOP
      IF pg_catalog.jsonb_typeof(v_exercise) <> 'object'
         OR COALESCE(v_exercise->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         OR COALESCE(pg_catalog.btrim(v_exercise->>'name'), '') = '' THEN
        RAISE EXCEPTION 'Program exercise is missing a stable identity or name.' USING ERRCODE = '22023';
      END IF;

      v_exercise_id := (v_exercise->>'id')::uuid;
      IF v_exercise_id = ANY(v_exercise_ids) THEN
        RAISE EXCEPTION 'Program exercise identities must be unique.' USING ERRCODE = '22023';
      END IF;
      v_exercise_ids := pg_catalog.array_append(v_exercise_ids, v_exercise_id);

      BEGIN
        v_sets := (v_exercise->>'sets')::numeric;
        v_reps := (v_exercise->>'reps')::numeric;
        v_rir := (v_exercise->>'rir')::numeric;
        v_rest := (v_exercise->>'restSeconds')::numeric;
      EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Program exercise has invalid prescription numbers.' USING ERRCODE = '22023';
      END;
      IF v_sets IS NULL OR v_reps IS NULL OR v_rir IS NULL OR v_rest IS NULL
         OR v_sets <= 0 OR v_sets <> pg_catalog.trunc(v_sets)
         OR v_reps <= 0 OR v_reps <> pg_catalog.trunc(v_reps)
         OR v_rir < 0 OR v_rest < 0 OR v_rest <> pg_catalog.trunc(v_rest) THEN
        RAISE EXCEPTION 'Program exercise has invalid prescription numbers.' USING ERRCODE = '22023';
      END IF;

      v_exercise_snapshot := v_exercise_snapshot || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'id', v_exercise_id,
          'order', v_exercise_ordinal,
          'name', pg_catalog.btrim(v_exercise->>'name'),
          'muscle_group', NULLIF(pg_catalog.btrim(v_exercise->>'muscleGroup'), ''),
          'target_sets', v_sets::integer,
          'target_reps', v_reps::integer,
          'target_load', NULLIF(pg_catalog.btrim(v_exercise->>'weight'), ''),
          'target_rir', v_rir,
          'rest_seconds', v_rest::integer,
          'instructions', NULLIF(pg_catalog.btrim(v_exercise->>'trainerTip'), ''),
          'video_url', NULLIF(pg_catalog.btrim(v_exercise->>'videoUrl'), '')
        )
      );
    END LOOP;

    v_day_snapshot := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'id', v_day_id,
      'order', v_day_ordinal,
      'title', pg_catalog.btrim(v_day->>'title'),
      'focus_area', NULLIF(pg_catalog.btrim(v_day->>'focusArea'), ''),
      'exercises', v_exercise_snapshot
    ));
    v_days := v_days || pg_catalog.jsonb_build_array(v_day_snapshot);
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('schema_version', 1, 'days', v_days);
END;
$function$;
ALTER FUNCTION public.build_program_version_snapshot(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.build_program_version_snapshot(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.reject_program_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'program versions are immutable' USING ERRCODE = '42501';
END;
$function$;
ALTER FUNCTION public.reject_program_version_mutation() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reject_program_version_mutation() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER program_versions_immutable
  BEFORE UPDATE OR DELETE ON public.program_versions
  FOR EACH ROW EXECUTE FUNCTION public.reject_program_version_mutation();

CREATE FUNCTION public.apply_program_version(p_program_id text)
RETURNS public.program_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_program public.programs%ROWTYPE;
  v_version public.program_versions%ROWTYPE;
  v_latest public.program_versions%ROWTYPE;
  v_snapshot jsonb;
  v_next integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to apply this program.' USING ERRCODE = '42501';
  END IF;

  -- Serialize all applies for one program and capture persisted content only.
  SELECT p.* INTO v_program
  FROM public.programs AS p
  WHERE p.id = p_program_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_program.trainer_id::text IS DISTINCT FROM v_actor::text
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles AS profile
       WHERE profile.id = v_actor AND profile.role = 'trainer'
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.account_access AS access
       WHERE access.user_id = v_actor AND access.state = 'enabled'
     ) THEN
    RAISE EXCEPTION 'Not authorized to apply this program.' USING ERRCODE = '42501';
  END IF;

  v_snapshot := public.build_program_version_snapshot(v_program.data->'days');
  IF pg_catalog.jsonb_array_length(v_snapshot->'days') = 0
     OR EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_array_elements(v_snapshot->'days') AS day(value)
       WHERE pg_catalog.jsonb_array_length(day.value->'exercises') = 0
     ) THEN
    RAISE EXCEPTION 'Add at least one day and one exercise before applying this program.' USING ERRCODE = '22023';
  END IF;

  SELECT pv.* INTO v_latest
  FROM public.program_versions AS pv
  WHERE pv.program_id = p_program_id
  ORDER BY pv.version_number DESC
  LIMIT 1;

  IF FOUND AND v_latest.snapshot = v_snapshot THEN
    RETURN v_latest;
  END IF;

  SELECT COALESCE(pg_catalog.max(pv.version_number), 0) + 1 INTO v_next
  FROM public.program_versions AS pv
  WHERE pv.program_id = p_program_id;

  INSERT INTO public.program_versions (program_id, version_number, snapshot, created_by)
  VALUES (p_program_id, v_next, v_snapshot, v_actor)
  RETURNING * INTO v_version;

  RETURN v_version;
END;
$function$;
ALTER FUNCTION public.apply_program_version(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.apply_program_version(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.apply_program_version(text) TO authenticated;

-- Capture a factual baseline for each currently assigned program. This is a
-- snapshot of today's observable state, not reconstructed history. Invalid or
-- reused legacy IDs are replaced once in the assigned programs' editable JSON
-- so later versions can preserve those identities. Empty programs stay empty.
DO $baseline$
DECLARE
  v_program record;
  v_data jsonb;
  v_days jsonb;
  v_day jsonb;
  v_exercises jsonb;
  v_exercise jsonb;
  v_new_days jsonb;
  v_new_exercises jsonb;
  v_day_ids uuid[];
  v_exercise_ids uuid[];
  v_id uuid;
  v_day_id_text text;
  v_exercise_id_text text;
  v_day_item record;
  v_exercise_item record;
  v_changed boolean;
  v_snapshot jsonb;
BEGIN
  FOR v_program IN
    SELECT DISTINCT p.id, p.data
    FROM public.programs AS p
    JOIN public.clients AS c ON c.assigned_program_id = p.id
    WHERE c.assigned_program_id IS NOT NULL
    ORDER BY p.id
  LOOP
    v_data := COALESCE(v_program.data, '{}'::jsonb);
    IF pg_catalog.jsonb_typeof(v_data) <> 'object' THEN
      RAISE EXCEPTION 'CORE 1B baseline failed: assigned program data must be an object.';
    END IF;
    v_days := COALESCE(v_data->'days', '[]'::jsonb);
    IF pg_catalog.jsonb_typeof(v_days) <> 'array' THEN
      RAISE EXCEPTION 'CORE 1B baseline failed: assigned program days must be an array.';
    END IF;

    v_new_days := '[]'::jsonb;
    v_day_ids := ARRAY[]::uuid[];
    v_exercise_ids := ARRAY[]::uuid[];
    v_changed := false;

    FOR v_day_item IN
      SELECT item.value, item.ordinality
      FROM pg_catalog.jsonb_array_elements(v_days) WITH ORDINALITY AS item(value, ordinality)
    LOOP
      v_day := v_day_item.value;
      IF pg_catalog.jsonb_typeof(v_day) <> 'object' THEN
        RAISE EXCEPTION 'CORE 1B baseline failed: assigned program day must be an object.';
      END IF;
      v_day_id_text := v_day->>'id';
      IF COALESCE(v_day_id_text, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        v_id := pg_catalog.gen_random_uuid();
        v_day := pg_catalog.jsonb_set(v_day, '{id}', pg_catalog.to_jsonb(v_id::text), true);
        v_changed := true;
      ELSE
        v_id := v_day_id_text::uuid;
        IF v_id = ANY(v_day_ids) THEN
          v_id := pg_catalog.gen_random_uuid();
          v_day := pg_catalog.jsonb_set(v_day, '{id}', pg_catalog.to_jsonb(v_id::text), true);
          v_changed := true;
        END IF;
      END IF;
      v_day_ids := pg_catalog.array_append(v_day_ids, v_id);

      v_exercises := COALESCE(v_day->'exercises', '[]'::jsonb);
      IF pg_catalog.jsonb_typeof(v_exercises) <> 'array' THEN
        RAISE EXCEPTION 'CORE 1B baseline failed: assigned program exercises must be an array.';
      END IF;
      v_new_exercises := '[]'::jsonb;
      FOR v_exercise_item IN
        SELECT item.value, item.ordinality
        FROM pg_catalog.jsonb_array_elements(v_exercises) WITH ORDINALITY AS item(value, ordinality)
      LOOP
        v_exercise := v_exercise_item.value;
        IF pg_catalog.jsonb_typeof(v_exercise) <> 'object' THEN
          RAISE EXCEPTION 'CORE 1B baseline failed: assigned program exercise must be an object.';
        END IF;
        v_exercise_id_text := v_exercise->>'id';
        IF COALESCE(v_exercise_id_text, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
          v_id := pg_catalog.gen_random_uuid();
          v_exercise := pg_catalog.jsonb_set(v_exercise, '{id}', pg_catalog.to_jsonb(v_id::text), true);
          v_changed := true;
        ELSE
          v_id := v_exercise_id_text::uuid;
          IF v_id = ANY(v_exercise_ids) THEN
            v_id := pg_catalog.gen_random_uuid();
            v_exercise := pg_catalog.jsonb_set(v_exercise, '{id}', pg_catalog.to_jsonb(v_id::text), true);
            v_changed := true;
          END IF;
        END IF;
        v_exercise_ids := pg_catalog.array_append(v_exercise_ids, v_id);
        v_new_exercises := v_new_exercises || pg_catalog.jsonb_build_array(v_exercise);
      END LOOP;
      v_day := pg_catalog.jsonb_set(v_day, '{exercises}', v_new_exercises, true);
      v_new_days := v_new_days || pg_catalog.jsonb_build_array(v_day);
    END LOOP;

    IF v_changed THEN
      UPDATE public.programs
      SET data = pg_catalog.jsonb_set(v_data, '{days}', v_new_days, true),
          updated_at = pg_catalog.now()
      WHERE id = v_program.id;
    ELSE
      v_new_days := v_days;
    END IF;

    v_snapshot := public.build_program_version_snapshot(v_new_days);
    INSERT INTO public.program_versions (program_id, version_number, snapshot, created_by)
    VALUES (v_program.id, 1, v_snapshot, NULL);
  END LOOP;
END;
$baseline$;
