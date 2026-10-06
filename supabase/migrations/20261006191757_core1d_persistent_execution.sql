-- CORE 1D: canonical Client execution, anchored to immutable CORE 1C assignments.
-- Apply to isolated first; production is explicitly out of scope.

DO $preflight$
BEGIN
  IF to_regclass('public.workout_sessions') IS NOT NULL
     OR to_regclass('public.workout_set_results') IS NOT NULL
     OR to_regprocedure('public.start_workout_session(uuid)') IS NOT NULL
     OR to_regprocedure('public.save_workout_set_result(uuid,uuid,smallint,integer,integer,text,numeric,numeric,text)') IS NOT NULL
     OR to_regprocedure('public.finish_workout_session(uuid)') IS NOT NULL
     OR to_regprocedure('public.get_open_workout_session()') IS NOT NULL THEN
    RAISE EXCEPTION 'CORE 1D precondition failed: execution objects already exist; inspect before applying.';
  END IF;

  IF to_regclass('public.clients') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.account_access') IS NULL
     OR to_regclass('public.program_versions') IS NULL
     OR to_regclass('public.client_program_assignments') IS NULL THEN
    RAISE EXCEPTION 'CORE 1D precondition failed: CORE 1A/1B/1C tables are required.';
  END IF;
END;
$preflight$;

CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  client_program_assignment_id uuid NOT NULL
    REFERENCES public.client_program_assignments(id) ON DELETE RESTRICT,
  program_day_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  completed_at timestamptz NULL,
  CONSTRAINT workout_sessions_completion_after_start
    CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX workout_sessions_assignment_started_idx
  ON public.workout_sessions(client_program_assignment_id, started_at DESC);
CREATE INDEX workout_sessions_open_assignment_idx
  ON public.workout_sessions(client_program_assignment_id)
  WHERE completed_at IS NULL;

CREATE TABLE public.workout_set_results (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  workout_session_id uuid NOT NULL
    REFERENCES public.workout_sessions(id) ON DELETE RESTRICT,
  exercise_id uuid NOT NULL,
  set_number smallint NOT NULL CHECK (set_number > 0),
  reps_performed integer NULL CHECK (reps_performed IS NULL OR reps_performed > 0),
  duration_seconds integer NULL CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  load_kind text NULL
    CHECK (load_kind IS NULL OR load_kind IN ('external_kg', 'external_kg_per_dumbbell', 'bodyweight', 'none')),
  load_kg numeric NULL CHECK (load_kg IS NULL OR load_kg >= 0),
  rir_performed numeric NULL CHECK (rir_performed IS NULL OR rir_performed >= 0),
  note text NULL CHECK (note IS NULL OR pg_catalog.char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT workout_set_results_one_performed_measure
    CHECK (pg_catalog.num_nonnulls(reps_performed, duration_seconds) = 1),
  CONSTRAINT workout_set_results_load_semantics
    CHECK (
      (load_kind IN ('external_kg', 'external_kg_per_dumbbell') AND load_kg IS NOT NULL)
      OR (load_kind IN ('bodyweight', 'none') AND load_kg IS NULL)
      OR (load_kind IS NULL AND load_kg IS NULL)
    ),
  CONSTRAINT workout_set_results_session_exercise_set_unique
    UNIQUE (workout_session_id, exercise_id, set_number)
);

COMMENT ON TABLE public.workout_sessions IS
  'CORE 1D performed sessions. The immutable client_program_assignment anchors the exact program version.';
COMMENT ON TABLE public.workout_set_results IS
  'CORE 1D performed set values only; prescribed target values remain in the immutable program-version snapshot.';

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_set_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.workout_sessions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.workout_set_results FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.workout_sessions, public.workout_set_results TO authenticated;

-- This predicate is deliberately SECURITY DEFINER so Client reads can remain
-- scoped to the Client through an assignment that may have ended after the
-- session began. It returns only a boolean and does not expose joined rows.
CREATE FUNCTION public.can_access_workout_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public.workout_sessions AS session
    JOIN public.client_program_assignments AS assignment
      ON assignment.id = session.client_program_assignment_id
    JOIN public.clients AS client ON client.id = assignment.client_id
    JOIN public.profiles AS actor ON actor.id = (SELECT auth.uid())
    JOIN public.account_access AS access ON access.user_id = actor.id
    WHERE session.id = p_session_id
      AND access.state = 'enabled'
      AND (
        actor.role = 'admin'
        OR (actor.role = 'trainer' AND client.trainer_id::text = actor.id::text)
        OR (actor.role = 'client' AND client.user_id = actor.id)
      )
  ), false)
$function$;
ALTER FUNCTION public.can_access_workout_session(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_access_workout_session(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_workout_session(uuid) TO authenticated;

CREATE POLICY workout_sessions_select_authorized
  ON public.workout_sessions FOR SELECT TO authenticated
  USING (public.can_access_workout_session(id));

CREATE POLICY workout_set_results_select_authorized
  ON public.workout_set_results FOR SELECT TO authenticated
  USING (public.can_access_workout_session(workout_session_id));

-- Lock the owning Client row before insertion. CORE 1C's assignment RPC uses
-- the same lock order; this serializes session starts against assignment
-- changes and prevents two open sessions across old/new assignments without
-- duplicating client_id on workout_sessions.
CREATE FUNCTION public.guard_single_open_workout_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_client_id text;
  v_assignment_active boolean;
BEGIN
  SELECT assignment.client_id, assignment.ended_at IS NULL
    INTO v_client_id, v_assignment_active
  FROM public.client_program_assignments AS assignment
  WHERE assignment.id = NEW.client_program_assignment_id;

  IF NOT FOUND OR NOT v_assignment_active THEN
    RAISE EXCEPTION 'An open workout session requires an active Client assignment.' USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM public.clients AS client WHERE client.id = v_client_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout Client no longer exists.' USING ERRCODE = '23503';
  END IF;

  IF NEW.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'A new workout session must begin open.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workout_sessions AS existing_session
    JOIN public.client_program_assignments AS existing_assignment
      ON existing_assignment.id = existing_session.client_program_assignment_id
    WHERE existing_assignment.client_id = v_client_id
      AND existing_session.completed_at IS NULL
      AND existing_session.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'This Client already has an open workout session.' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.guard_single_open_workout_session() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guard_single_open_workout_session() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER workout_sessions_single_open_per_client
  BEFORE INSERT ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_single_open_workout_session();

CREATE FUNCTION public.guard_workout_session_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Workout session history cannot be deleted.' USING ERRCODE = '42501';
  END IF;
  IF OLD.completed_at IS NOT NULL
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.client_program_assignment_id IS DISTINCT FROM OLD.client_program_assignment_id
     OR NEW.program_day_id IS DISTINCT FROM OLD.program_day_id
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR OLD.completed_at IS NOT NULL
     OR NEW.completed_at IS NULL THEN
    RAISE EXCEPTION 'Only finalizing an open workout session is allowed.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.guard_workout_session_mutation() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guard_workout_session_mutation() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER workout_sessions_immutable_history
  BEFORE UPDATE OR DELETE ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_workout_session_mutation();

CREATE FUNCTION public.guard_workout_set_result_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_completed_at timestamptz;
  v_program_day_id uuid;
  v_snapshot jsonb;
  v_created_at timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Workout set results cannot be deleted.' USING ERRCODE = '42501';
  END IF;

  SELECT session.completed_at, session.program_day_id, version.snapshot
    INTO v_completed_at, v_program_day_id, v_snapshot
  FROM public.workout_sessions AS session
  JOIN public.client_program_assignments AS assignment
    ON assignment.id = session.client_program_assignment_id
  JOIN public.program_versions AS version
    ON version.id = assignment.program_version_id
  WHERE session.id = NEW.workout_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout session does not exist.' USING ERRCODE = '23503';
  END IF;
  IF v_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Completed workout results are immutable.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(COALESCE(v_snapshot->'days', '[]'::jsonb)) AS day(value)
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(COALESCE(day.value->'exercises', '[]'::jsonb)) AS exercise(value)
    WHERE day.value->>'id' = v_program_day_id::text
      AND exercise.value->>'id' = NEW.exercise_id::text
  ) THEN
    RAISE EXCEPTION 'Exercise is not part of this session day snapshot.' USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.workout_session_id IS DISTINCT FROM OLD.workout_session_id
       OR NEW.exercise_id IS DISTINCT FROM OLD.exercise_id
       OR NEW.set_number IS DISTINCT FROM OLD.set_number
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Workout set identity is immutable.' USING ERRCODE = '42501';
    END IF;
    v_created_at := OLD.created_at;
  ELSE
    v_created_at := NEW.created_at;
  END IF;
  NEW.created_at := v_created_at;
  NEW.updated_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.guard_workout_set_result_mutation() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guard_workout_set_result_mutation() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER workout_set_results_validate_and_freeze
  BEFORE INSERT OR UPDATE OR DELETE ON public.workout_set_results
  FOR EACH ROW EXECUTE FUNCTION public.guard_workout_set_result_mutation();

-- Returns only the exact immutable prescribed day for a persisted session and
-- the Client's persisted set results. It also supports recovery after the
-- assignment later ends, without opening direct Client access to old versions.
CREATE FUNCTION public.workout_session_payload(p_session_id uuid, p_recovered boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_session public.workout_sessions%ROWTYPE;
  v_assignment public.client_program_assignments%ROWTYPE;
  v_snapshot jsonb;
  v_day jsonb;
  v_results jsonb;
BEGIN
  SELECT session.* INTO v_session
  FROM public.workout_sessions AS session
  WHERE session.id = p_session_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT assignment.* INTO v_assignment
  FROM public.client_program_assignments AS assignment
  WHERE assignment.id = v_session.client_program_assignment_id;
  SELECT version.snapshot INTO v_snapshot
  FROM public.program_versions AS version
  WHERE version.id = v_assignment.program_version_id;

  SELECT day.value INTO v_day
  FROM pg_catalog.jsonb_array_elements(COALESCE(v_snapshot->'days', '[]'::jsonb)) AS day(value)
  WHERE day.value->>'id' = v_session.program_day_id::text;
  IF v_day IS NULL THEN
    RAISE EXCEPTION 'The persisted workout day is missing from its immutable snapshot.' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(result) ORDER BY result.exercise_id, result.set_number), '[]'::jsonb)
    INTO v_results
  FROM public.workout_set_results AS result
  WHERE result.workout_session_id = v_session.id;

  RETURN pg_catalog.jsonb_build_object(
    'session', pg_catalog.to_jsonb(v_session),
    'program_version_id', v_assignment.program_version_id,
    'day', v_day,
    'results', v_results,
    'recovered', p_recovered
  );
END;
$function$;
ALTER FUNCTION public.workout_session_payload(uuid, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.workout_session_payload(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.get_open_workout_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_client_id text;
  v_session_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    JOIN public.account_access AS access ON access.user_id = profile.id
    WHERE profile.id = v_actor AND profile.role = 'client' AND access.state = 'enabled'
  ) THEN
    RAISE EXCEPTION 'Not authorized to read this workout session.' USING ERRCODE = '42501';
  END IF;

  SELECT client.id INTO v_client_id
  FROM public.clients AS client WHERE client.user_id = v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No Client record is linked to this account.' USING ERRCODE = '42501';
  END IF;

  SELECT session.id INTO v_session_id
  FROM public.workout_sessions AS session
  JOIN public.client_program_assignments AS assignment
    ON assignment.id = session.client_program_assignment_id
  WHERE assignment.client_id = v_client_id AND session.completed_at IS NULL
  ORDER BY session.started_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.workout_session_payload(v_session_id, true);
END;
$function$;
ALTER FUNCTION public.get_open_workout_session() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_open_workout_session() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_open_workout_session() TO authenticated;

CREATE FUNCTION public.start_workout_session(p_program_day_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_client_id text;
  v_open_session_id uuid;
  v_assignment public.client_program_assignments%ROWTYPE;
  v_snapshot jsonb;
  v_day jsonb;
  v_session public.workout_sessions%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    JOIN public.account_access AS access ON access.user_id = profile.id
    WHERE profile.id = v_actor AND profile.role = 'client' AND access.state = 'enabled'
  ) THEN
    RAISE EXCEPTION 'Not authorized to start this workout.' USING ERRCODE = '42501';
  END IF;

  SELECT client.id INTO v_client_id
  FROM public.clients AS client WHERE client.user_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No Client record is linked to this account.' USING ERRCODE = '42501';
  END IF;

  -- Retry/double-click recovery is primary: return the existing open session,
  -- even if the Trainer has since applied another assignment.
  SELECT session.id INTO v_open_session_id
  FROM public.workout_sessions AS session
  JOIN public.client_program_assignments AS assignment
    ON assignment.id = session.client_program_assignment_id
  WHERE assignment.client_id = v_client_id AND session.completed_at IS NULL
  ORDER BY session.started_at DESC
  LIMIT 1;
  IF v_open_session_id IS NOT NULL THEN
    RETURN public.workout_session_payload(v_open_session_id, true);
  END IF;

  SELECT assignment.* INTO v_assignment
  FROM public.client_program_assignments AS assignment
  WHERE assignment.client_id = v_client_id AND assignment.ended_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active program assignment exists.' USING ERRCODE = '22023';
  END IF;

  SELECT version.snapshot INTO v_snapshot
  FROM public.program_versions AS version
  WHERE version.id = v_assignment.program_version_id;
  IF p_program_day_id IS NULL THEN
    RAISE EXCEPTION 'A program day must be selected.' USING ERRCODE = '22023';
  END IF;

  SELECT day.value INTO v_day
  FROM pg_catalog.jsonb_array_elements(COALESCE(v_snapshot->'days', '[]'::jsonb)) AS day(value)
  WHERE day.value->>'id' = p_program_day_id::text;
  IF v_day IS NULL OR pg_catalog.jsonb_typeof(v_day->'exercises') <> 'array'
     OR pg_catalog.jsonb_array_length(v_day->'exercises') = 0 THEN
    RAISE EXCEPTION 'The selected day is not executable in the assigned snapshot.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.workout_sessions(client_program_assignment_id, program_day_id)
  VALUES (v_assignment.id, p_program_day_id)
  RETURNING * INTO v_session;
  RETURN public.workout_session_payload(v_session.id, false);
END;
$function$;
ALTER FUNCTION public.start_workout_session(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.start_workout_session(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.start_workout_session(uuid) TO authenticated;

CREATE FUNCTION public.save_workout_set_result(
  p_workout_session_id uuid,
  p_exercise_id uuid,
  p_set_number smallint,
  p_reps_performed integer,
  p_duration_seconds integer,
  p_load_kind text,
  p_load_kg numeric,
  p_rir_performed numeric,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_client_id text;
  v_session public.workout_sessions%ROWTYPE;
  v_result public.workout_set_results%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    JOIN public.account_access AS access ON access.user_id = profile.id
    WHERE profile.id = v_actor AND profile.role = 'client' AND access.state = 'enabled'
  ) THEN
    RAISE EXCEPTION 'Not authorized to record this workout.' USING ERRCODE = '42501';
  END IF;

  SELECT client.id INTO v_client_id
  FROM public.workout_sessions AS session
  JOIN public.client_program_assignments AS assignment
    ON assignment.id = session.client_program_assignment_id
  JOIN public.clients AS client ON client.id = assignment.client_id
  WHERE session.id = p_workout_session_id AND client.user_id = v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout session does not belong to this Client.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.clients AS client WHERE client.id = v_client_id FOR UPDATE;
  SELECT session.* INTO v_session
  FROM public.workout_sessions AS session
  WHERE session.id = p_workout_session_id
  FOR UPDATE;
  IF NOT FOUND OR v_session.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Workout session is unavailable or already completed.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.workout_set_results(
    workout_session_id, exercise_id, set_number, reps_performed,
    duration_seconds, load_kind, load_kg, rir_performed, note
  ) VALUES (
    p_workout_session_id, p_exercise_id, p_set_number, p_reps_performed,
    p_duration_seconds, p_load_kind, p_load_kg, p_rir_performed, p_note
  )
  ON CONFLICT (workout_session_id, exercise_id, set_number)
  DO UPDATE SET
    reps_performed = EXCLUDED.reps_performed,
    duration_seconds = EXCLUDED.duration_seconds,
    load_kind = EXCLUDED.load_kind,
    load_kg = EXCLUDED.load_kg,
    rir_performed = EXCLUDED.rir_performed,
    note = EXCLUDED.note,
    updated_at = pg_catalog.clock_timestamp()
  RETURNING * INTO v_result;

  RETURN pg_catalog.to_jsonb(v_result);
END;
$function$;
ALTER FUNCTION public.save_workout_set_result(uuid,uuid,smallint,integer,integer,text,numeric,numeric,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.save_workout_set_result(uuid,uuid,smallint,integer,integer,text,numeric,numeric,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_workout_set_result(uuid,uuid,smallint,integer,integer,text,numeric,numeric,text) TO authenticated;

CREATE FUNCTION public.finish_workout_session(p_workout_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_client_id text;
  v_session public.workout_sessions%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    JOIN public.account_access AS access ON access.user_id = profile.id
    WHERE profile.id = v_actor AND profile.role = 'client' AND access.state = 'enabled'
  ) THEN
    RAISE EXCEPTION 'Not authorized to finish this workout.' USING ERRCODE = '42501';
  END IF;

  SELECT client.id INTO v_client_id
  FROM public.workout_sessions AS session
  JOIN public.client_program_assignments AS assignment
    ON assignment.id = session.client_program_assignment_id
  JOIN public.clients AS client ON client.id = assignment.client_id
  WHERE session.id = p_workout_session_id AND client.user_id = v_actor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout session does not belong to this Client.' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.clients AS client WHERE client.id = v_client_id FOR UPDATE;
  SELECT session.* INTO v_session
  FROM public.workout_sessions AS session
  WHERE session.id = p_workout_session_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout session does not exist.' USING ERRCODE = '42501';
  END IF;

  IF v_session.completed_at IS NULL THEN
    UPDATE public.workout_sessions AS session
    SET completed_at = pg_catalog.clock_timestamp()
    WHERE session.id = v_session.id
    RETURNING * INTO v_session;
  END IF;

  RETURN public.workout_session_payload(v_session.id, false);
END;
$function$;
ALTER FUNCTION public.finish_workout_session(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.finish_workout_session(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.finish_workout_session(uuid) TO authenticated;
