-- Rollback-only CORE 1D validation. Uses only existing enabled identities;
-- all temporary program/version/assignment/session/result changes are reverted.
BEGIN;

DO $setup$
DECLARE
  v_trainer uuid;
  v_client text;
  v_client_user uuid;
  v_program text;
  v_cross_client_user uuid;
  v_second_trainer uuid;
  v_admin uuid;
  v_day uuid := pg_catalog.gen_random_uuid();
  v_exercise uuid := pg_catalog.gen_random_uuid();
BEGIN
  SELECT trainer.id, client.id, client.user_id, program.id
  INTO v_trainer, v_client, v_client_user, v_program
  FROM public.profiles trainer
  JOIN public.account_access trainer_access ON trainer_access.user_id=trainer.id AND trainer_access.state='enabled'
  JOIN public.clients client ON client.trainer_id::text=trainer.id::text
  JOIN public.profiles client_profile ON client_profile.id=client.user_id AND client_profile.role='client'
  JOIN public.account_access client_access ON client_access.user_id=client.user_id AND client_access.state='enabled'
  JOIN public.client_program_assignments assignment ON assignment.client_id=client.id AND assignment.ended_at IS NULL
  JOIN public.program_versions version ON version.id=assignment.program_version_id
  JOIN public.programs program ON program.id=version.program_id AND program.trainer_id::text=trainer.id::text
  WHERE trainer.role='trainer'
  ORDER BY client.id
  LIMIT 1;

  SELECT client.user_id INTO v_cross_client_user
  FROM public.clients client
  JOIN public.profiles profile ON profile.id=client.user_id AND profile.role='client'
  JOIN public.account_access access ON access.user_id=profile.id AND access.state='enabled'
  WHERE client.user_id IS NOT NULL AND client.id<>v_client
  ORDER BY client.id LIMIT 1;

  SELECT id INTO v_second_trainer FROM public.profiles
  WHERE role='trainer' AND id<>v_trainer ORDER BY id LIMIT 1;
  SELECT id INTO v_admin FROM public.profiles WHERE role='admin' ORDER BY id LIMIT 1;
  IF v_trainer IS NULL OR v_client IS NULL OR v_client_user IS NULL OR v_program IS NULL
     OR v_cross_client_user IS NULL OR v_second_trainer IS NULL OR v_admin IS NULL THEN
    RAISE EXCEPTION 'Harness requires existing enabled Trainer/Client, another Client, another Trainer and Admin.';
  END IF;

  PERFORM pg_catalog.set_config('core1d.trainer',v_trainer::text,true);
  PERFORM pg_catalog.set_config('core1d.client',v_client,true);
  PERFORM pg_catalog.set_config('core1d.client_user',v_client_user::text,true);
  PERFORM pg_catalog.set_config('core1d.cross_client_user',v_cross_client_user::text,true);
  PERFORM pg_catalog.set_config('core1d.second_trainer',v_second_trainer::text,true);
  PERFORM pg_catalog.set_config('core1d.admin',v_admin::text,true);
  PERFORM pg_catalog.set_config('core1d.program',v_program,true);
  PERFORM pg_catalog.set_config('core1d.day',v_day::text,true);
  PERFORM pg_catalog.set_config('core1d.exercise',v_exercise::text,true);
  PERFORM pg_catalog.set_config('core1d.assignment_request',pg_catalog.gen_random_uuid()::text,true);
END;
$setup$;

-- Existing isolated baseline snapshots are empty; they must not become a fake session.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.client_user'),true);
DO $empty_prescription$
DECLARE v_rejected boolean:=false;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.client_program_assignments assignment
    JOIN public.program_versions version ON version.id=assignment.program_version_id
    WHERE assignment.client_id=current_setting('core1d.client') AND assignment.ended_at IS NULL
      AND pg_catalog.jsonb_array_length(COALESCE(version.snapshot->'days','[]'::jsonb))>0
  ) THEN
    RAISE EXCEPTION 'Selected harness Client does not have the expected empty baseline snapshot.';
  END IF;
  BEGIN
    PERFORM public.start_workout_session(pg_catalog.gen_random_uuid());
  EXCEPTION WHEN SQLSTATE '22023' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'An empty snapshot produced a workout session.'; END IF;
END;
$empty_prescription$;
RESET ROLE;

-- The executable prescription is test-only and restored by the final ROLLBACK.
UPDATE public.programs program
SET data=pg_catalog.jsonb_set(
  COALESCE(program.data,'{}'::jsonb), '{days}',
  pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'id',current_setting('core1d.day'),'title','CORE 1D rollback test','focusArea','Test',
    'exercises',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id',current_setting('core1d.exercise'),'name','Rollback-only exercise','muscleGroup','Test',
      'sets',5,'reps',8,'weight','80 kg','rir',2,'restSeconds',60,'trainerTip','', 'videoUrl',''
    ))
  )), true
)
WHERE program.id=current_setting('core1d.program');

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.trainer'),true);
SELECT pg_catalog.set_config(
  'core1d.applied',
  public.apply_program_to_client(
    current_setting('core1d.assignment_request')::uuid,
    current_setting('core1d.client'),
    current_setting('core1d.program')
  )::text,
  true
);
SELECT pg_catalog.set_config('core1d.assignment',current_setting('core1d.applied')::jsonb #>> '{assignment,id}',true);
SELECT pg_catalog.set_config('core1d.version',current_setting('core1d.applied')::jsonb #>> '{program_version,id}',true);

-- Client explicitly chooses its stable day ID. Invalid day is rejected.
SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.client_user'),true);
DO $invalid_day$
DECLARE v_rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.start_workout_session(pg_catalog.gen_random_uuid());
  EXCEPTION WHEN SQLSTATE '22023' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Non-snapshot day was accepted.'; END IF;
END;
$invalid_day$;
SELECT pg_catalog.set_config('core1d.started',public.start_workout_session(current_setting('core1d.day')::uuid) #>> '{session,id}',true);
SELECT pg_catalog.set_config('core1d.started_retry',public.start_workout_session(current_setting('core1d.day')::uuid) #>> '{session,id}',true);
DO $start_idempotency$
BEGIN
  IF current_setting('core1d.started')<>current_setting('core1d.started_retry') THEN
    RAISE EXCEPTION 'Second start did not recover the existing session.';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM public.workout_sessions WHERE completed_at IS NULL)<>1 THEN
    RAISE EXCEPTION 'Double start produced multiple open sessions.';
  END IF;
END;
$start_idempotency$;
DO $incompatible_open_day$
DECLARE v_rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.start_workout_session(pg_catalog.gen_random_uuid());
  EXCEPTION WHEN SQLSTATE '23505' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'A different day silently reused the open session.'; END IF;
END;
$incompatible_open_day$;

DO $invalid_exercise$
DECLARE v_rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.save_workout_set_result(
      current_setting('core1d.started')::uuid,pg_catalog.gen_random_uuid(),1::smallint,1,NULL,NULL,NULL,NULL,NULL
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Exercise outside this day snapshot was accepted.'; END IF;
END;
$invalid_exercise$;

-- Reps + external load, then retry and intentional edit use one stable result row.
SELECT pg_catalog.set_config('core1d.result_one',public.save_workout_set_result(
  current_setting('core1d.started')::uuid,current_setting('core1d.exercise')::uuid,1::smallint,7,NULL,'external_kg',20,2,NULL
) #>> '{id}',true);
SELECT pg_catalog.set_config('core1d.result_retry',public.save_workout_set_result(
  current_setting('core1d.started')::uuid,current_setting('core1d.exercise')::uuid,1::smallint,7,NULL,'external_kg',20,2,NULL
) #>> '{id}',true);
SELECT public.save_workout_set_result(current_setting('core1d.started')::uuid,current_setting('core1d.exercise')::uuid,1::smallint,6,NULL,'external_kg',22,1,NULL);
SELECT public.save_workout_set_result(current_setting('core1d.started')::uuid,current_setting('core1d.exercise')::uuid,2::smallint,NULL,30,'bodyweight',NULL,NULL,NULL);
SELECT public.save_workout_set_result(current_setting('core1d.started')::uuid,current_setting('core1d.exercise')::uuid,3::smallint,10,NULL,'none',NULL,NULL,NULL);
SELECT public.save_workout_set_result(current_setting('core1d.started')::uuid,current_setting('core1d.exercise')::uuid,4::smallint,5,NULL,'external_kg_per_dumbbell',12.5,NULL,NULL);
SELECT public.save_workout_set_result(current_setting('core1d.started')::uuid,current_setting('core1d.exercise')::uuid,5::smallint,4,NULL,NULL,NULL,NULL,'Carga no informada');
DO $result_checks$
BEGIN
  IF current_setting('core1d.result_one')<>current_setting('core1d.result_retry') THEN
    RAISE EXCEPTION 'Retry created a different set result.';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM public.workout_set_results WHERE workout_session_id=current_setting('core1d.started')::uuid)<>5 THEN
    RAISE EXCEPTION 'Set retry duplicated results.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.workout_set_results
    WHERE workout_session_id=current_setting('core1d.started')::uuid AND set_number=1
      AND (reps_performed<>6 OR load_kg<>22 OR rir_performed<>1)
  ) THEN RAISE EXCEPTION 'Intentional set edit was not persisted.'; END IF;
END;
$result_checks$;

-- RLS: Client sees own rows, another Client does not; Trainers are read-only.
DO $client_rls$
DECLARE v_own integer; v_write_rejected boolean:=false;
BEGIN
  SELECT pg_catalog.count(*) INTO v_own FROM public.workout_sessions WHERE id=current_setting('core1d.started')::uuid;
  IF v_own<>1 THEN RAISE EXCEPTION 'Client cannot read its own session.'; END IF;
  BEGIN
    INSERT INTO public.workout_sessions(client_program_assignment_id,program_day_id)
    VALUES(current_setting('core1d.assignment')::uuid,current_setting('core1d.day')::uuid);
  EXCEPTION WHEN insufficient_privilege THEN v_write_rejected:=true;
  END;
  IF NOT v_write_rejected THEN RAISE EXCEPTION 'Client direct session INSERT was permitted.'; END IF;
END;
$client_rls$;

SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.cross_client_user'),true);
DO $cross_client$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.workout_sessions WHERE id=current_setting('core1d.started')::uuid)<>0
     OR (SELECT pg_catalog.count(*) FROM public.workout_set_results WHERE workout_session_id=current_setting('core1d.started')::uuid)<>0 THEN
    RAISE EXCEPTION 'Another Client can read this execution.';
  END IF;
END;
$cross_client$;

SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.trainer'),true);
DO $trainer_rls$
DECLARE v_rejected boolean:=false;
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.workout_sessions WHERE id=current_setting('core1d.started')::uuid)<>1 THEN
    RAISE EXCEPTION 'Trainer cannot read own Client execution.';
  END IF;
  BEGIN
    INSERT INTO public.workout_set_results(workout_session_id,exercise_id,set_number,reps_performed)
    VALUES(current_setting('core1d.started')::uuid,current_setting('core1d.exercise')::uuid,6::smallint,1);
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer direct result write was permitted.'; END IF;
END;
$trainer_rls$;

SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.second_trainer'),true);
DO $cross_trainer$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.workout_sessions WHERE id=current_setting('core1d.started')::uuid)<>0 THEN
    RAISE EXCEPTION 'Another Trainer can read this Client execution.';
  END IF;
END;
$cross_trainer$;

SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.admin'),true);
DO $admin_rls$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.workout_sessions WHERE id=current_setting('core1d.started')::uuid)<>1 THEN
    RAISE EXCEPTION 'Admin cannot read execution globally.';
  END IF;
END;
$admin_rls$;

-- Restore Client identity for payload recovery; it remains tied to the original immutable version.
SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.client_user'),true);
SELECT pg_catalog.set_config('core1d.recovered',public.get_open_workout_session()::text,true);
DO $recovery$
BEGIN
  IF current_setting('core1d.recovered')::jsonb #>> '{session,id}'<>current_setting('core1d.started') THEN
    RAISE EXCEPTION 'Recovery returned a different session.';
  END IF;
  IF current_setting('core1d.recovered')::jsonb #>> '{program_version_id}'<>current_setting('core1d.version') THEN
    RAISE EXCEPTION 'Recovery reinterpreted the session under another version.';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_array_elements(current_setting('core1d.recovered')::jsonb->'results'))<>5 THEN
    RAISE EXCEPTION 'Recovery did not return all persisted results.';
  END IF;
  IF current_setting('core1d.recovered')::jsonb #>> '{day,exercises,0,target_load}'<>'80 kg' THEN
    RAISE EXCEPTION 'Snapshot target was not preserved separately from performed values.';
  END IF;
END;
$recovery$;

-- New assignment while open: the existing session must remain on its original version.
RESET ROLE;
UPDATE public.programs program
SET data=pg_catalog.jsonb_set(program.data,'{days,0,exercises,0,reps}','10'::jsonb,true)
WHERE program.id=current_setting('core1d.program');
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.trainer'),true);
SELECT public.apply_program_to_client(pg_catalog.gen_random_uuid(),current_setting('core1d.client'),current_setting('core1d.program'));
SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.client_user'),true);
SELECT pg_catalog.set_config('core1d.recovered_after_reassignment',public.get_open_workout_session()::text,true);
DO $assignment_change$
BEGIN
  IF current_setting('core1d.recovered_after_reassignment')::jsonb #>> '{program_version_id}'<>current_setting('core1d.version') THEN
    RAISE EXCEPTION 'A later assignment changed the active session prescription.';
  END IF;
END;
$assignment_change$;

SELECT public.finish_workout_session(current_setting('core1d.started')::uuid);
SELECT public.finish_workout_session(current_setting('core1d.started')::uuid);
DO $finish_checks$
DECLARE v_rejected boolean:=false;
BEGIN
  IF (SELECT completed_at FROM public.workout_sessions WHERE id=current_setting('core1d.started')::uuid) IS NULL THEN
    RAISE EXCEPTION 'Finish did not persist completed_at.';
  END IF;
  BEGIN
    PERFORM public.save_workout_set_result(current_setting('core1d.started')::uuid,current_setting('core1d.exercise')::uuid,1::smallint,5,NULL,NULL,NULL,NULL,NULL);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Completed execution remained mutable.'; END IF;
END;
$finish_checks$;

RESET ROLE;
UPDATE public.account_access SET state='suspended'
WHERE user_id=current_setting('core1d.client_user')::uuid;
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub',current_setting('core1d.client_user'),true);
DO $suspended$
DECLARE v_rejected boolean:=false;
BEGIN
  BEGIN PERFORM public.get_open_workout_session();
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Suspended Client accessed execution RPC.'; END IF;
END;
$suspended$;

ROLLBACK;
