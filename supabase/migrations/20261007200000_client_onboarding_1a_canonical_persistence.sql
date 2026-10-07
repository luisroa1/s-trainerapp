-- Client Onboarding 1A: canonical profile/intake persistence and access boundaries.
-- Legacy clients.data and its columns are intentionally preserved and untouched.

CREATE OR REPLACE FUNCTION private.text_array_has_no_duplicates(p_values text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $function$
  SELECT COALESCE(cardinality(p_values), 0) = COALESCE((
    SELECT count(DISTINCT value)::integer FROM unnest(p_values) AS value
  ), 0)
$function$;

CREATE TABLE public.client_profile (
  client_id text PRIMARY KEY REFERENCES public.clients(id) ON DELETE RESTRICT,
  preferred_name text NULL CHECK (preferred_name IS NULL OR length(btrim(preferred_name)) BETWEEN 1 AND 80),
  date_of_birth date NULL,
  -- Self-declared physiological-sex category for future features with an explicit
  -- use case. This is not gender identity and is never inferred from clients.sex.
  -- NULL means unanswered; not_provided is an explicit Client choice.
  physiological_sex text NULL CHECK (physiological_sex IS NULL OR physiological_sex IN ('male', 'female', 'not_provided')),
  height_cm numeric(5,2) NULL CHECK (height_cm IS NULL OR height_cm BETWEEN 30 AND 300),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
COMMENT ON TABLE public.client_profile IS 'Canonical Client-declared stable profile fields. Never backfilled from clients.data.';
COMMENT ON COLUMN public.client_profile.physiological_sex IS 'Self-declared physiological-sex category, not gender identity. NULL=unanswered; not_provided=explicit choice. Never inferred from legacy clients.sex.';

CREATE TABLE public.client_training_context (
  client_id text PRIMARY KEY REFERENCES public.clients(id) ON DELETE RESTRICT,
  daily_activity_pattern text NULL CHECK (daily_activity_pattern IS NULL OR daily_activity_pattern IN ('mostly_seated', 'frequent_light_movement', 'mostly_standing_or_walking', 'physically_demanding', 'varies')),
  daily_steps_band text NULL CHECK (daily_steps_band IS NULL OR daily_steps_band IN ('unknown', 'under_4000', '4000_8000', '8000_12000', 'over_12000')),
  strength_training_status text NULL CHECK (strength_training_status IS NULL OR strength_training_status IN ('never', 'previously', 'currently')),
  experience_band text NULL CHECK (experience_band IS NULL OR experience_band IN ('under_6_months', '6_12_months', '1_3_years', 'over_3_years')),
  time_since_training_band text NULL CHECK (time_since_training_band IS NULL OR time_since_training_band IN ('under_1_month', '1_6_months', '6_months_2_years', 'over_2_years')),
  availability_days text NULL CHECK (availability_days IS NULL OR availability_days IN ('1', '2', '3', '4', '5', '6_plus')),
  training_location text NULL CHECK (training_location IS NULL OR training_location IN ('gym', 'home', 'both', 'unknown')),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT client_training_context_never_has_no_experience CHECK (
    strength_training_status IS DISTINCT FROM 'never'
    OR (experience_band IS NULL AND time_since_training_band IS NULL)
  ),
  CONSTRAINT client_training_context_current_has_no_gap CHECK (
    strength_training_status IS DISTINCT FROM 'currently' OR time_since_training_band IS NULL
  )
);
COMMENT ON TABLE public.client_training_context IS 'Current Client-declared daily activity and training context; NULL means unanswered.';

CREATE TABLE public.client_weight_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  weight_kg numeric(6,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 1000),
  measured_on date NOT NULL,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT client_weight_records_client_id_id_key UNIQUE (client_id, id)
);
CREATE INDEX client_weight_records_client_date_idx ON public.client_weight_records(client_id, measured_on DESC, recorded_at DESC);
COMMENT ON TABLE public.client_weight_records IS 'Append-only Client-reported dated weight observations. Weight is explicitly in kilograms.';

CREATE TABLE public.client_goal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  primary_goal text NOT NULL CHECK (primary_goal IN ('gain_muscle', 'lose_fat', 'gain_strength', 'health', 'performance', 'return_to_training', 'other')),
  primary_other_text text NULL CHECK (primary_other_text IS NULL OR length(btrim(primary_other_text)) BETWEEN 1 AND 240),
  secondary_goals text[] NULL,
  secondary_other_text text NULL CHECK (secondary_other_text IS NULL OR length(btrim(secondary_other_text)) BETWEEN 1 AND 240),
  started_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  ended_at timestamptz NULL,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT client_goal_history_end_after_start CHECK (ended_at IS NULL OR ended_at >= started_at),
  CONSTRAINT client_goal_history_primary_other CHECK ((primary_goal = 'other') = (primary_other_text IS NOT NULL)),
  CONSTRAINT client_goal_history_secondary_other CHECK (
    (secondary_goals IS NULL AND secondary_other_text IS NULL)
    OR (secondary_goals IS NOT NULL AND (('other' = ANY(secondary_goals)) = (secondary_other_text IS NOT NULL)))
  ),
  CONSTRAINT client_goal_history_secondary_valid CHECK (
    secondary_goals IS NULL OR (
      cardinality(secondary_goals) <= 2
      AND secondary_goals <@ ARRAY['gain_muscle','lose_fat','gain_strength','health','performance','return_to_training','other']::text[]
      AND private.text_array_has_no_duplicates(secondary_goals)
      AND NOT (primary_goal = ANY(secondary_goals))
    )
  )
);
CREATE UNIQUE INDEX client_goal_history_one_current_per_client ON public.client_goal_history(client_id) WHERE ended_at IS NULL;
CREATE INDEX client_goal_history_client_timeline_idx ON public.client_goal_history(client_id, started_at DESC);
COMMENT ON TABLE public.client_goal_history IS 'Client-declared primary/secondary goal snapshots with an effective-time history.';

CREATE TABLE public.client_health_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  has_relevant_information boolean NOT NULL,
  categories text[] NOT NULL DEFAULT ARRAY[]::text[],
  body_region text NULL CHECK (body_region IS NULL OR length(btrim(body_region)) BETWEEN 1 AND 100),
  description text NULL CHECK (description IS NULL OR length(btrim(description)) BETWEEN 1 AND 1000),
  supersedes_id uuid NULL,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT client_health_declarations_client_id_id_key UNIQUE (client_id, id),
  CONSTRAINT client_health_declarations_supersedes_same_client_fkey FOREIGN KEY (client_id, supersedes_id)
    REFERENCES public.client_health_declarations(client_id, id) ON DELETE RESTRICT,
  CONSTRAINT client_health_declarations_one_successor UNIQUE (client_id, supersedes_id),
  CONSTRAINT client_health_declarations_categories CHECK (
    cardinality(categories) <= 4
    AND categories <@ ARRAY['injury_or_discomfort','medical_condition','prior_surgery','other']::text[]
    AND private.text_array_has_no_duplicates(categories)
  ),
  CONSTRAINT client_health_declarations_answer_shape CHECK (
    (has_relevant_information AND cardinality(categories) > 0)
    OR (NOT has_relevant_information AND cardinality(categories) = 0 AND body_region IS NULL AND description IS NULL)
  ),
  CONSTRAINT client_health_declarations_region_requires_injury CHECK (
    body_region IS NULL OR 'injury_or_discomfort' = ANY(categories)
  )
);
CREATE UNIQUE INDEX client_health_declarations_one_root_per_client ON public.client_health_declarations(client_id) WHERE supersedes_id IS NULL;
CREATE INDEX client_health_declarations_client_timeline_idx ON public.client_health_declarations(client_id, recorded_at DESC);
COMMENT ON TABLE public.client_health_declarations IS 'Immutable, Client-declared current-state snapshots of training-relevant health information. Not a medical record.';

CREATE TABLE public.client_menstrual_profile (
  client_id text PRIMARY KEY REFERENCES public.clients(id) ON DELETE RESTRICT,
  tracking_choice text NOT NULL CHECK (tracking_choice IN ('yes', 'not_now')),
  last_menstrual_start date NULL,
  usual_cycle_days smallint NULL CHECK (usual_cycle_days IS NULL OR usual_cycle_days BETWEEN 1 AND 90),
  cycle_pattern text NULL CHECK (cycle_pattern IS NULL OR cycle_pattern IN ('regular', 'irregular', 'unknown')),
  recorded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  consent_recorded_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT client_menstrual_profile_declined_has_no_values CHECK (
    tracking_choice <> 'not_now' OR (last_menstrual_start IS NULL AND usual_cycle_days IS NULL AND cycle_pattern IS NULL)
  )
);
COMMENT ON TABLE public.client_menstrual_profile IS 'Private Client-only menstrual tracking choice and initial facts. No phase is persisted; no Trainer/Admin read policy.';

CREATE TABLE public.client_onboarding_state (
  client_id text PRIMARY KEY REFERENCES public.clients(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed')),
  flow_version integer NOT NULL CHECK (flow_version > 0),
  resume_step text NULL CHECK (resume_step IS NULL OR length(btrim(resume_step)) BETWEEN 1 AND 64),
  started_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  completed_at timestamptz NULL,
  updated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT client_onboarding_state_completion_shape CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND resume_step IS NULL)
    OR (status = 'in_progress' AND completed_at IS NULL)
  )
);
COMMENT ON TABLE public.client_onboarding_state IS 'Workflow state only; no answers and no prescription state. No row means not_started.';

-- A shared timestamp/provenance trigger derives actor identity from the session.
CREATE OR REPLACE FUNCTION private.touch_client_onboarding_row()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
    NEW.created_at := pg_catalog.clock_timestamp();
  ELSE
    IF NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Client profile identity/provenance is immutable.' USING ERRCODE = '42501';
    END IF;
    NEW.updated_by := auth.uid();
  END IF;
  NEW.updated_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.touch_client_training_context()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.updated_by := auth.uid();
    NEW.created_at := pg_catalog.clock_timestamp();
  ELSE
    IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
      RAISE EXCEPTION 'Client training context owner is immutable.' USING ERRCODE = '42501';
    END IF;
    NEW.updated_by := auth.uid();
  END IF;
  NEW.updated_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.reject_client_onboarding_history_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Client onboarding history is immutable.' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'Client onboarding history is append-only.' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION private.set_client_onboarding_event_provenance()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  NEW.recorded_by := auth.uid();
  NEW.recorded_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.touch_client_menstrual_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.recorded_by := auth.uid();
    NEW.updated_by := auth.uid();
    NEW.consent_recorded_at := pg_catalog.clock_timestamp();
  ELSE
    IF NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by THEN
      RAISE EXCEPTION 'Menstrual profile identity/provenance is immutable.' USING ERRCODE = '42501';
    END IF;
    NEW.updated_by := auth.uid();
    NEW.consent_recorded_at := pg_catalog.clock_timestamp();
  END IF;
  NEW.updated_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.guard_client_goal_history_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.ended_at IS NOT NULL
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.primary_goal IS DISTINCT FROM OLD.primary_goal
     OR NEW.primary_other_text IS DISTINCT FROM OLD.primary_other_text
     OR NEW.secondary_goals IS DISTINCT FROM OLD.secondary_goals
     OR NEW.secondary_other_text IS DISTINCT FROM OLD.secondary_other_text
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
     OR NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.ended_at IS NULL THEN
    RAISE EXCEPTION 'Client goal history may only close an active interval.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.guard_client_onboarding_state_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Onboarding state cannot be deleted.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.status = 'completed' OR NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.completed_at IS DISTINCT FROM OLD.completed_at AND OLD.status = 'completed') THEN
    RAISE EXCEPTION 'Completed onboarding state is immutable.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER client_profile_provenance BEFORE INSERT OR UPDATE ON public.client_profile
  FOR EACH ROW EXECUTE FUNCTION private.touch_client_onboarding_row();
CREATE TRIGGER client_training_context_provenance BEFORE INSERT OR UPDATE ON public.client_training_context
  FOR EACH ROW EXECUTE FUNCTION private.touch_client_training_context();
CREATE TRIGGER client_weight_records_append_only BEFORE UPDATE OR DELETE ON public.client_weight_records
  FOR EACH ROW EXECUTE FUNCTION private.reject_client_onboarding_history_mutation();
CREATE TRIGGER client_weight_records_provenance BEFORE INSERT ON public.client_weight_records
  FOR EACH ROW EXECUTE FUNCTION private.set_client_onboarding_event_provenance();
CREATE TRIGGER client_health_declarations_append_only BEFORE UPDATE OR DELETE ON public.client_health_declarations
  FOR EACH ROW EXECUTE FUNCTION private.reject_client_onboarding_history_mutation();
CREATE TRIGGER client_health_declarations_provenance BEFORE INSERT ON public.client_health_declarations
  FOR EACH ROW EXECUTE FUNCTION private.set_client_onboarding_event_provenance();
CREATE TRIGGER client_goal_history_guard BEFORE UPDATE OR DELETE ON public.client_goal_history
  FOR EACH ROW EXECUTE FUNCTION private.guard_client_goal_history_mutation();
CREATE TRIGGER client_onboarding_state_guard BEFORE UPDATE OR DELETE ON public.client_onboarding_state
  FOR EACH ROW EXECUTE FUNCTION private.guard_client_onboarding_state_mutation();
CREATE TRIGGER client_menstrual_profile_provenance BEFORE INSERT OR UPDATE ON public.client_menstrual_profile
  FOR EACH ROW EXECUTE FUNCTION private.touch_client_menstrual_profile();

CREATE OR REPLACE FUNCTION private.client_onboarding_actor_client_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $function$
  SELECT c.id FROM public.clients c
  JOIN public.profiles p ON p.id = (SELECT auth.uid()) AND p.role = 'client'
  WHERE c.user_id = (SELECT auth.uid())
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.save_client_goal_state(
  p_primary_goal text,
  p_primary_other_text text,
  p_secondary_goals text[],
  p_secondary_other_text text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_client_id text;
  v_current public.client_goal_history%ROWTYPE;
  v_new_id uuid;
  v_secondary text[] := p_secondary_goals;
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF v_uid IS NULL OR NOT public.is_account_enabled() THEN
    RAISE EXCEPTION 'Enabled Client account required.' USING ERRCODE = '42501';
  END IF;
  SELECT c.id INTO v_client_id FROM public.clients c
    JOIN public.profiles p ON p.id = v_uid AND p.role = 'client'
    WHERE c.user_id = v_uid FOR UPDATE OF c;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Client relation unavailable.' USING ERRCODE = '42501'; END IF;
  IF p_primary_goal NOT IN ('gain_muscle','lose_fat','gain_strength','health','performance','return_to_training','other')
     OR COALESCE(cardinality(v_secondary), 0) > 2
     OR NOT COALESCE(v_secondary <@ ARRAY['gain_muscle','lose_fat','gain_strength','health','performance','return_to_training','other']::text[], true)
     OR NOT private.text_array_has_no_duplicates(v_secondary)
     OR p_primary_goal = ANY(v_secondary)
     OR ((p_primary_goal = 'other') <> (NULLIF(btrim(p_primary_other_text),'') IS NOT NULL))
     OR (('other' = ANY(v_secondary)) <> (NULLIF(btrim(p_secondary_other_text),'') IS NOT NULL)) THEN
    RAISE EXCEPTION 'Invalid Client goal state.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_current FROM public.client_goal_history g
    WHERE g.client_id = v_client_id AND g.ended_at IS NULL FOR UPDATE;
  IF FOUND AND v_current.primary_goal = p_primary_goal
     AND v_current.primary_other_text IS NOT DISTINCT FROM NULLIF(btrim(p_primary_other_text),'')
     AND v_current.secondary_goals IS NOT DISTINCT FROM v_secondary
     AND v_current.secondary_other_text IS NOT DISTINCT FROM NULLIF(btrim(p_secondary_other_text),'') THEN
    RETURN v_current.id;
  END IF;
  IF FOUND THEN
    UPDATE public.client_goal_history SET ended_at = v_now WHERE id = v_current.id;
  END IF;
  INSERT INTO public.client_goal_history(client_id,primary_goal,primary_other_text,secondary_goals,secondary_other_text,started_at,recorded_by,recorded_at)
    VALUES (v_client_id,p_primary_goal,NULLIF(btrim(p_primary_other_text),''),v_secondary,NULLIF(btrim(p_secondary_other_text),''),v_now,v_uid,v_now)
    RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_client_onboarding_progress(p_flow_version integer, p_resume_step text)
RETURNS public.client_onboarding_state LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_client_id text;
  v_result public.client_onboarding_state%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_account_enabled() OR p_flow_version IS NULL OR p_flow_version < 1
     OR p_resume_step IS NULL OR length(btrim(p_resume_step)) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'Enabled Client account and valid progress are required.' USING ERRCODE = '42501';
  END IF;
  v_client_id := private.client_onboarding_actor_client_id();
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Client relation unavailable.' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.client_onboarding_state AS existing(client_id,status,flow_version,resume_step,updated_by)
    VALUES (v_client_id,'in_progress',p_flow_version,btrim(p_resume_step),v_uid)
  ON CONFLICT (client_id) DO UPDATE SET
    status = 'in_progress', flow_version = EXCLUDED.flow_version, resume_step = EXCLUDED.resume_step,
    updated_at = pg_catalog.clock_timestamp(), updated_by = v_uid
  WHERE existing.status = 'in_progress'
  RETURNING * INTO v_result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completed onboarding cannot be reopened through progress save.' USING ERRCODE = '42501'; END IF;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_client_onboarding(p_flow_version integer)
RETURNS public.client_onboarding_state LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_client_id text;
  v_result public.client_onboarding_state%ROWTYPE;
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF v_uid IS NULL OR NOT public.is_account_enabled() OR p_flow_version IS NULL OR p_flow_version < 1 THEN
    RAISE EXCEPTION 'Enabled Client account and valid flow version are required.' USING ERRCODE = '42501';
  END IF;
  v_client_id := private.client_onboarding_actor_client_id();
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Client relation unavailable.' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_profile p WHERE p.client_id = v_client_id AND p.date_of_birth IS NOT NULL AND p.date_of_birth <= CURRENT_DATE AND p.height_cm IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.client_training_context t WHERE t.client_id = v_client_id
       AND t.daily_activity_pattern IS NOT NULL AND t.strength_training_status IS NOT NULL
       AND t.availability_days IS NOT NULL AND t.training_location IS NOT NULL
       AND (t.strength_training_status = 'never' OR t.experience_band IS NOT NULL)
       AND (t.strength_training_status <> 'previously' OR t.time_since_training_band IS NOT NULL))
     OR NOT EXISTS (SELECT 1 FROM public.client_goal_history g WHERE g.client_id = v_client_id AND g.ended_at IS NULL)
     OR NOT EXISTS (SELECT 1 FROM public.client_health_declarations h WHERE h.client_id = v_client_id
       AND NOT EXISTS (SELECT 1 FROM public.client_health_declarations successor WHERE successor.client_id = h.client_id AND successor.supersedes_id = h.id)) THEN
    RAISE EXCEPTION 'Required Client intake declarations are incomplete.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.client_onboarding_state SET status='completed',flow_version=p_flow_version,resume_step=NULL,
    updated_at=v_now,completed_at=v_now,updated_by=v_uid
    WHERE client_id=v_client_id AND status='in_progress'
    RETURNING * INTO v_result;
  IF NOT FOUND THEN
    SELECT * INTO v_result FROM public.client_onboarding_state s WHERE s.client_id=v_client_id AND s.status='completed';
    IF NOT FOUND THEN RAISE EXCEPTION 'Onboarding must be started before completion.' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN v_result;
END;
$function$;

-- RLS: Trainer reads only non-menstrual Client context for owned Clients.
-- Admin has no routine access to intake or sensitive declaration content.
DO $policies$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['client_profile','client_training_context','client_weight_records','client_goal_history','client_health_declarations','client_menstrual_profile','client_onboarding_state'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
  END LOOP;
END;
$policies$;

CREATE POLICY client_profile_select ON public.client_profile FOR SELECT TO authenticated
  USING (public.is_account_enabled() AND (
    EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_profile.client_id)
    OR EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.trainer_id=p.id::text WHERE p.id=(SELECT auth.uid()) AND p.role='trainer' AND c.id=client_profile.client_id)
  ));
CREATE POLICY client_profile_client_insert ON public.client_profile FOR INSERT TO authenticated
  WITH CHECK (public.is_account_enabled() AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_profile.client_id));
CREATE POLICY client_profile_client_update ON public.client_profile FOR UPDATE TO authenticated
  USING (public.is_account_enabled() AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_profile.client_id))
  WITH CHECK (public.is_account_enabled() AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_profile.client_id));

CREATE POLICY client_training_context_select ON public.client_training_context FOR SELECT TO authenticated
  USING (public.is_account_enabled() AND (
    EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_training_context.client_id)
    OR EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.trainer_id=p.id::text WHERE p.id=(SELECT auth.uid()) AND p.role='trainer' AND c.id=client_training_context.client_id)
  ));
CREATE POLICY client_training_context_client_insert ON public.client_training_context FOR INSERT TO authenticated
  WITH CHECK (public.is_account_enabled() AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_training_context.client_id));
CREATE POLICY client_training_context_client_update ON public.client_training_context FOR UPDATE TO authenticated
  USING (public.is_account_enabled() AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_training_context.client_id))
  WITH CHECK (public.is_account_enabled() AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_training_context.client_id));

CREATE POLICY client_weight_records_select ON public.client_weight_records FOR SELECT TO authenticated
  USING (public.is_account_enabled() AND (
    EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_weight_records.client_id)
    OR EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.trainer_id=p.id::text WHERE p.id=(SELECT auth.uid()) AND p.role='trainer' AND c.id=client_weight_records.client_id)
  ));
CREATE POLICY client_weight_records_client_insert ON public.client_weight_records FOR INSERT TO authenticated
  WITH CHECK (public.is_account_enabled() AND recorded_by=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_weight_records.client_id));

CREATE POLICY client_goal_history_select ON public.client_goal_history FOR SELECT TO authenticated
  USING (public.is_account_enabled() AND (
    EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_goal_history.client_id)
    OR EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.trainer_id=p.id::text WHERE p.id=(SELECT auth.uid()) AND p.role='trainer' AND c.id=client_goal_history.client_id)
  ));

CREATE POLICY client_health_declarations_select ON public.client_health_declarations FOR SELECT TO authenticated
  USING (public.is_account_enabled() AND (
    EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_health_declarations.client_id)
    OR EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.trainer_id=p.id::text WHERE p.id=(SELECT auth.uid()) AND p.role='trainer' AND c.id=client_health_declarations.client_id)
  ));
CREATE POLICY client_health_declarations_client_insert ON public.client_health_declarations FOR INSERT TO authenticated
  WITH CHECK (public.is_account_enabled() AND recorded_by=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_health_declarations.client_id));

CREATE POLICY client_menstrual_profile_client_select ON public.client_menstrual_profile FOR SELECT TO authenticated
  USING (public.is_account_enabled() AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_menstrual_profile.client_id));
CREATE POLICY client_menstrual_profile_client_insert ON public.client_menstrual_profile FOR INSERT TO authenticated
  WITH CHECK (public.is_account_enabled() AND recorded_by=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_menstrual_profile.client_id));
CREATE POLICY client_menstrual_profile_client_update ON public.client_menstrual_profile FOR UPDATE TO authenticated
  USING (public.is_account_enabled() AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_menstrual_profile.client_id))
  WITH CHECK (public.is_account_enabled() AND recorded_by=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_menstrual_profile.client_id));

CREATE POLICY client_onboarding_state_select ON public.client_onboarding_state FOR SELECT TO authenticated
  USING (public.is_account_enabled() AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.clients c ON c.user_id=p.id WHERE p.id=(SELECT auth.uid()) AND p.role='client' AND c.id=client_onboarding_state.client_id));

REVOKE ALL ON FUNCTION private.touch_client_onboarding_row() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.touch_client_training_context() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.reject_client_onboarding_history_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.text_array_has_no_duplicates(text[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.set_client_onboarding_event_provenance() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.touch_client_menstrual_profile() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.guard_client_goal_history_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.guard_client_onboarding_state_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.client_onboarding_actor_client_id() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_client_goal_state(text,text,text[],text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.save_client_onboarding_progress(integer,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.complete_client_onboarding(integer) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_client_goal_state(text,text,text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_client_onboarding_progress(integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_client_onboarding(integer) TO authenticated;

GRANT INSERT, UPDATE ON TABLE public.client_profile, public.client_training_context TO authenticated;
GRANT SELECT, INSERT ON TABLE public.client_weight_records, public.client_health_declarations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.client_menstrual_profile TO authenticated;
-- Goal history and onboarding state are written only through validated operations.
