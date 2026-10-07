-- Uses existing enabled isolated identities; all test rows are rolled back.
BEGIN;
-- Prevent the previous isolated text/UUID schema drift from yielding a false PASS.
DO $identifier_contract$ DECLARE v_type text; BEGIN
  SELECT data_type INTO v_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clients' AND column_name='trainer_id';
  IF v_type IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION 'Test requires production-compatible clients.trainer_id uuid; found %', coalesce(v_type,'missing');
  END IF;
END $identifier_contract$;
SELECT set_config('test.onb_trainer_a', (
  SELECT p.id::text FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='enabled'
  WHERE p.role='trainer' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.trainer_id=p.id AND c.user_id IS NOT NULL)
  ORDER BY p.id LIMIT 1), true);
SELECT set_config('test.onb_trainer_b', (
  SELECT p.id::text FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='enabled'
  WHERE p.role='trainer' AND p.id::text<>current_setting('test.onb_trainer_a') ORDER BY p.id LIMIT 1), true);
SELECT set_config('test.onb_client_a', (
  SELECT c.id FROM public.clients c WHERE c.trainer_id::text=current_setting('test.onb_trainer_a') AND c.user_id IS NOT NULL ORDER BY c.id LIMIT 1), true);
SELECT set_config('test.onb_client_b', (
  SELECT c.id FROM public.clients c WHERE c.trainer_id::text=current_setting('test.onb_trainer_a') AND c.user_id IS NOT NULL AND c.id<>current_setting('test.onb_client_a') ORDER BY c.id LIMIT 1), true);
SELECT set_config('test.onb_client_a_user', (SELECT c.user_id::text FROM public.clients c WHERE c.id=current_setting('test.onb_client_a')), true);
SELECT set_config('test.onb_client_b_user', (SELECT c.user_id::text FROM public.clients c WHERE c.id=current_setting('test.onb_client_b')), true);
SELECT set_config('test.onb_admin', (
  SELECT p.id::text FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='enabled'
  WHERE p.role='admin' ORDER BY p.id LIMIT 1), true);
DO $$ BEGIN
  IF current_setting('test.onb_trainer_a',true) IS NULL OR current_setting('test.onb_trainer_b',true) IS NULL
     OR current_setting('test.onb_client_a',true) IS NULL OR current_setting('test.onb_client_b',true) IS NULL
     OR current_setting('test.onb_client_a_user',true) IS NULL OR current_setting('test.onb_client_b_user',true) IS NULL
     OR current_setting('test.onb_admin',true) IS NULL THEN
    RAISE EXCEPTION 'Requires existing enabled isolated Trainers, two linked Clients, and Admin';
  END IF;
END $$;

SELECT set_config('test.onb_client_data_before', (SELECT data::text FROM public.clients WHERE id=current_setting('test.onb_client_a')), true);
SELECT set_config('test.onb_active_assignments_before', (SELECT count(*)::text FROM public.client_program_assignments WHERE client_id=current_setting('test.onb_client_a') AND ended_at IS NULL), true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub',current_setting('test.onb_client_a_user'),true);

-- An absent row means not_started. A missing physiology/step value stays NULL.
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.client_onboarding_state WHERE client_id=current_setting('test.onb_client_a');
  IF n<>0 THEN RAISE EXCEPTION 'Onboarding state should be absent/not_started'; END IF;
END $$;
INSERT INTO public.client_profile(client_id,date_of_birth,height_cm,created_by,updated_by)
VALUES (current_setting('test.onb_client_a'),'1990-01-01',175,current_setting('test.onb_client_a_user')::uuid,current_setting('test.onb_client_a_user')::uuid);
DO $$ DECLARE row_value public.client_profile%ROWTYPE; BEGIN
  SELECT * INTO row_value FROM public.client_profile WHERE client_id=current_setting('test.onb_client_a');
  IF row_value.physiological_sex IS NOT NULL THEN RAISE EXCEPTION 'Unknown physiology was defaulted'; END IF;
  IF row_value.created_by<>current_setting('test.onb_client_a_user')::uuid THEN RAISE EXCEPTION 'Profile provenance was not session-derived'; END IF;
END $$;
INSERT INTO public.client_training_context(client_id,daily_activity_pattern,strength_training_status,experience_band,time_since_training_band,availability_days,training_location,updated_by)
VALUES (current_setting('test.onb_client_a'),'varies','previously','1_3_years','6_months_2_years','3','unknown',current_setting('test.onb_client_a_user')::uuid);

-- Weight facts are dated, positive, self-reported kilograms and append-only.
INSERT INTO public.client_weight_records(id,client_id,weight_kg,measured_on,recorded_by)
VALUES ('a1000000-0000-4000-8000-000000000001',current_setting('test.onb_client_a'),75.25,'2026-10-01',current_setting('test.onb_client_a_user')::uuid);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.client_weight_records(client_id,weight_kg,measured_on,recorded_by)
      VALUES (current_setting('test.onb_client_a'),0,'2026-10-02',current_setting('test.onb_client_a_user')::uuid);
    RAISE EXCEPTION 'Zero weight was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.client_weight_records SET weight_kg=76 WHERE id='a1000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Weight history was mutable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- Goal changes close the prior interval; replaying the same state does not add history.
SELECT set_config('test.onb_goal_v1',public.save_client_goal_state('gain_strength',NULL,ARRAY['health']::text[],NULL)::text,true);
SELECT set_config('test.onb_goal_v1_retry',public.save_client_goal_state('gain_strength',NULL,ARRAY['health']::text[],NULL)::text,true);
SELECT set_config('test.onb_goal_v2',public.save_client_goal_state('performance',NULL,NULL,NULL)::text,true);
DO $$ DECLARE n integer; BEGIN
  IF current_setting('test.onb_goal_v1')<>current_setting('test.onb_goal_v1_retry') THEN RAISE EXCEPTION 'Goal retry created a new logical state'; END IF;
  SELECT count(*) INTO n FROM public.client_goal_history WHERE client_id=current_setting('test.onb_client_a');
  IF n<>2 THEN RAISE EXCEPTION 'Expected two goal history states'; END IF;
  SELECT count(*) INTO n FROM public.client_goal_history WHERE client_id=current_setting('test.onb_client_a') AND ended_at IS NULL AND id=current_setting('test.onb_goal_v2')::uuid;
  IF n<>1 THEN RAISE EXCEPTION 'V2 goal state is not current'; END IF;
END $$;

-- Health root answer and correction are append-only; NULL/absence is not a "no" answer.
INSERT INTO public.client_health_declarations(id,client_id,has_relevant_information,recorded_by)
VALUES ('a2000000-0000-4000-8000-000000000001',current_setting('test.onb_client_a'),false,current_setting('test.onb_client_a_user')::uuid);
INSERT INTO public.client_health_declarations(id,client_id,has_relevant_information,categories,body_region,description,supersedes_id,recorded_by)
VALUES ('a2000000-0000-4000-8000-000000000002',current_setting('test.onb_client_a'),true,ARRAY['injury_or_discomfort']::text[],'knee','Short Client declaration','a2000000-0000-4000-8000-000000000001',current_setting('test.onb_client_a_user')::uuid);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.client_health_declarations h WHERE h.client_id=current_setting('test.onb_client_a')
    AND NOT EXISTS (SELECT 1 FROM public.client_health_declarations s WHERE s.client_id=h.client_id AND s.supersedes_id=h.id);
  IF n<>1 THEN RAISE EXCEPTION 'Health declaration chain has no unique current head'; END IF;
  BEGIN
    UPDATE public.client_health_declarations SET description='rewritten' WHERE id='a2000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'Health history was mutable';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.client_health_declarations(client_id,has_relevant_information,categories,supersedes_id,recorded_by)
      VALUES (current_setting('test.onb_client_a'),false,ARRAY[]::text[],'a2000000-0000-4000-8000-000000000001',current_setting('test.onb_client_a_user')::uuid);
    RAISE EXCEPTION 'A superseded health declaration accepted a second branch';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;

-- Menstrual consent and data are Client-only; no persisted phase exists.
INSERT INTO public.client_menstrual_profile(client_id,tracking_choice,last_menstrual_start,cycle_pattern,recorded_by,updated_by)
VALUES (current_setting('test.onb_client_a'),'yes','2026-09-28','irregular',current_setting('test.onb_client_a_user')::uuid,current_setting('test.onb_client_a_user')::uuid);
SELECT public.save_client_onboarding_progress(1,'health');
SELECT public.complete_client_onboarding(1);
DO $$ DECLARE current_status text; BEGIN
  SELECT status INTO current_status FROM public.client_onboarding_state WHERE client_id=current_setting('test.onb_client_a');
  IF current_status IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'Onboarding did not complete after required facts existed'; END IF;
END $$;

-- Own Client read; other Client, Trainer, Admin cannot read menstrual details.
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.client_profile WHERE client_id=current_setting('test.onb_client_a'); IF n<>1 THEN RAISE EXCEPTION 'Client cannot read own profile'; END IF;
  SELECT count(*) INTO n FROM public.client_menstrual_profile WHERE client_id=current_setting('test.onb_client_a'); IF n<>1 THEN RAISE EXCEPTION 'Client cannot read own menstrual choice'; END IF;
  SELECT count(*) INTO n FROM public.client_profile WHERE client_id=current_setting('test.onb_client_b'); IF n<>0 THEN RAISE EXCEPTION 'Client A read Client B profile'; END IF;
  SELECT count(*) INTO n FROM public.client_health_declarations WHERE client_id=current_setting('test.onb_client_b'); IF n<>0 THEN RAISE EXCEPTION 'Client A read Client B health data'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub',current_setting('test.onb_trainer_a'),true);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.client_profile WHERE client_id=current_setting('test.onb_client_a'); IF n<>1 THEN RAISE EXCEPTION 'Owner Trainer cannot read allowed profile'; END IF;
  SELECT count(*) INTO n FROM public.client_health_declarations WHERE client_id=current_setting('test.onb_client_a'); IF n<>2 THEN RAISE EXCEPTION 'Owner Trainer cannot read health declaration'; END IF;
  SELECT count(*) INTO n FROM public.client_menstrual_profile WHERE client_id=current_setting('test.onb_client_a'); IF n<>0 THEN RAISE EXCEPTION 'Trainer read menstrual profile'; END IF;
  SELECT count(*) INTO n FROM public.client_profile WHERE client_id=current_setting('test.onb_client_b'); IF n<>0 THEN RAISE EXCEPTION 'Trainer A read non-owned Client B'; END IF;
  SELECT count(*) INTO n FROM public.client_onboarding_state WHERE client_id=current_setting('test.onb_client_a'); IF n<>0 THEN RAISE EXCEPTION 'Trainer read Client-only onboarding state'; END IF;
  BEGIN
    PERFORM public.save_client_goal_state('health',NULL,NULL,NULL);
    RAISE EXCEPTION 'Trainer invoked Client goal write RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claim.sub',current_setting('test.onb_trainer_b'),true);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.client_profile WHERE client_id=current_setting('test.onb_client_a'); IF n<>0 THEN RAISE EXCEPTION 'Other Trainer read Client A'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub',current_setting('test.onb_admin'),true);
DO $$ DECLARE n integer; BEGIN
  SELECT count(*) INTO n FROM public.client_health_declarations WHERE client_id=current_setting('test.onb_client_a'); IF n<>0 THEN RAISE EXCEPTION 'Admin has unnecessary health access'; END IF;
  SELECT count(*) INTO n FROM public.client_menstrual_profile WHERE client_id=current_setting('test.onb_client_a'); IF n<>0 THEN RAISE EXCEPTION 'Admin has unnecessary menstrual access'; END IF;
END $$;

RESET ROLE;
DO $$ DECLARE n integer; before_data jsonb; after_data jsonb; BEGIN
  SELECT data INTO before_data FROM public.clients WHERE id=current_setting('test.onb_client_a');
  n := (SELECT count(*) FROM public.client_program_assignments WHERE client_id=current_setting('test.onb_client_a') AND ended_at IS NULL);
  IF before_data::text<>current_setting('test.onb_client_data_before') THEN RAISE EXCEPTION 'Legacy clients.data changed'; END IF;
  IF n::text<>current_setting('test.onb_active_assignments_before') THEN RAISE EXCEPTION 'Existing program assignment changed'; END IF;
END $$;

-- Authenticated is the only application role with table reads; anonymous has no grant.
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM 1 FROM public.client_profile; RAISE EXCEPTION 'Anonymous read was granted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
