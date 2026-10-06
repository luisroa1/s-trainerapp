-- CORE 1D follow-up: a retry for the same day recovers the open session;
-- a request for another day must not silently execute the first day instead.
CREATE OR REPLACE FUNCTION public.start_workout_session(p_program_day_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_client_id text;
  v_open_session_id uuid;
  v_open_day_id uuid;
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

  -- The row lock serializes double clicks/two tabs. A same-day retry recovers;
  -- a different-day request is rejected instead of being silently reinterpreted.
  SELECT session.id, session.program_day_id
    INTO v_open_session_id, v_open_day_id
  FROM public.workout_sessions AS session
  JOIN public.client_program_assignments AS assignment
    ON assignment.id = session.client_program_assignment_id
  WHERE assignment.client_id = v_client_id AND session.completed_at IS NULL
  ORDER BY session.started_at DESC
  LIMIT 1;
  IF v_open_session_id IS NOT NULL THEN
    IF p_program_day_id IS DISTINCT FROM v_open_day_id THEN
      RAISE EXCEPTION 'Another workout day is already in progress.' USING ERRCODE = '23505';
    END IF;
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
