-- Isolated-only CORE 1B integration test.
-- Uses existing identities and program rows; all writes are rolled back.
BEGIN;

DO $setup$
DECLARE
  v_trainer_a uuid;
  v_trainer_b uuid;
  v_admin uuid;
  v_client uuid;
  v_program_a text;
  v_program_b text;
  v_expected_baselines bigint;
  v_actual_baselines bigint;
BEGIN
  SELECT p.id INTO v_trainer_a
  FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='enabled'
  WHERE p.role='trainer' ORDER BY p.id LIMIT 1;
  SELECT p.id INTO v_trainer_b
  FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='enabled'
  WHERE p.role='trainer' AND p.id<>v_trainer_a ORDER BY p.id LIMIT 1;
  SELECT p.id INTO v_admin
  FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='enabled'
  WHERE p.role='admin' ORDER BY p.id LIMIT 1;
  SELECT p.id INTO v_client
  FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='enabled'
  WHERE p.role='client' ORDER BY p.id LIMIT 1;
  SELECT pr.id INTO v_program_a
  FROM public.programs pr
  WHERE pr.trainer_id::text=v_trainer_a::text ORDER BY pr.id LIMIT 1;
  v_program_b := 'core1b-test-program-' || pg_catalog.txid_current()::text;

  IF v_trainer_a IS NULL OR v_trainer_b IS NULL OR v_admin IS NULL OR v_client IS NULL OR v_program_a IS NULL THEN
    RAISE EXCEPTION 'CORE 1B test requires enabled Trainer A/B, Admin, Client, and Trainer A program fixtures.';
  END IF;
  SELECT count(DISTINCT c.assigned_program_id) INTO v_expected_baselines
  FROM public.clients c WHERE c.assigned_program_id IS NOT NULL;
  SELECT count(*) INTO v_actual_baselines
  FROM public.program_versions pv
  WHERE pv.version_number=1 AND pv.created_by IS NULL
    AND pv.program_id IN (SELECT DISTINCT assigned_program_id FROM public.clients WHERE assigned_program_id IS NOT NULL);
  IF v_actual_baselines <> v_expected_baselines THEN
    RAISE EXCEPTION 'CORE 1B baseline count differs from currently assigned program count.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.assigned_program_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.program_versions pv
        WHERE pv.program_id=c.assigned_program_id AND pv.version_number=1 AND pv.created_by IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'An assigned program is missing its unattributed V1 baseline.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.programs p ON p.id=c.assigned_program_id
    JOIN public.program_versions pv ON pv.program_id=p.id AND pv.version_number=1
    WHERE c.assigned_program_id IS NOT NULL
      AND COALESCE(pg_catalog.jsonb_typeof(p.data->'days'),'null') IN ('null','array')
      AND COALESCE(pg_catalog.jsonb_array_length(CASE WHEN pg_catalog.jsonb_typeof(p.data->'days')='array' THEN p.data->'days' ELSE '[]'::jsonb END),0)=0
      AND pv.snapshot->'days' <> '[]'::jsonb
  ) THEN RAISE EXCEPTION 'Empty assigned programs did not remain empty in their baseline snapshots.'; END IF;

  PERFORM pg_catalog.set_config('core1b.trainer_a',v_trainer_a::text,true);
  PERFORM pg_catalog.set_config('core1b.trainer_b',v_trainer_b::text,true);
  PERFORM pg_catalog.set_config('core1b.admin',v_admin::text,true);
  PERFORM pg_catalog.set_config('core1b.client',v_client::text,true);
  PERFORM pg_catalog.set_config('core1b.program_a',v_program_a,true);
  PERFORM pg_catalog.set_config('core1b.program_b',v_program_b,true);
END
$setup$;

SET LOCAL ROLE authenticated;

DO $create_program_b$
DECLARE
  v_trainer_b uuid := current_setting('core1b.trainer_b')::uuid;
  v_program_b text := current_setting('core1b.program_b');
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_trainer_b::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',v_trainer_b,'role','authenticated')::text,true);
  INSERT INTO public.programs(id,name,trainer_id,data)
  VALUES(v_program_b,'CORE 1B transient isolated test',v_trainer_b,'{"days":[]}');
  BEGIN
    PERFORM public.apply_program_version(v_program_b);
    RAISE EXCEPTION 'Empty program unexpectedly created a version.';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
END
$create_program_b$;

DO $trainer_publish$
DECLARE
  v_trainer_a uuid := current_setting('core1b.trainer_a')::uuid;
  v_program_a text := current_setting('core1b.program_a');
  v_program_b text := current_setting('core1b.program_b');
  v_version_a public.program_versions%ROWTYPE;
  v_version_repeat public.program_versions%ROWTYPE;
  v_version_b public.program_versions%ROWTYPE;
  v_baseline_number integer;
  v_before_count bigint;
  v_after_count bigint;
  v_rejected boolean;
  v_mutation_rejected boolean;
  v_days jsonb := '[{"id":"11111111-1111-4111-8111-111111111111","dayNumber":1,"title":"Día de validación","focusArea":"Fuerza","exercises":[{"id":"22222222-2222-4222-8222-222222222222","order":1,"name":"Sentadilla de validación","muscleGroup":"Pierna","sets":3,"reps":8,"weight":"60 kg","rir":2,"restSeconds":90,"trainerTip":"Controla la ejecución","videoUrl":"https://example.test/guia","uiState":"selected","completedCount":2}]}]'::jsonb;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_trainer_a::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',v_trainer_a,'role','authenticated')::text,true);

  IF NOT public.is_account_enabled() THEN RAISE EXCEPTION 'Enabled Trainer failed account_access check.'; END IF;
  SELECT version_number INTO v_baseline_number
  FROM public.program_versions WHERE program_id=v_program_a ORDER BY version_number DESC LIMIT 1;
  SELECT count(*) INTO v_before_count FROM public.program_versions WHERE program_id=v_program_a;

  UPDATE public.programs SET data=pg_catalog.jsonb_build_object('id',v_program_a,'days',v_days)
  WHERE id=v_program_a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trainer could not persist editable program data.'; END IF;

  SELECT * INTO STRICT v_version_a FROM public.apply_program_version(v_program_a);
  IF v_version_a.created_by<>v_trainer_a OR v_version_a.program_id<>v_program_a
     OR v_version_a.version_number<>COALESCE(v_baseline_number,0)+1 THEN
    RAISE EXCEPTION 'V1/V2 sequence or actor ownership is incorrect.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.program_versions WHERE id=v_version_a.id) THEN
    RAISE EXCEPTION 'Enabled Trainer cannot read a version for an owned program.';
  END IF;
  IF v_version_a.snapshot->'days'->0->'exercises'->0 ? 'uiState'
     OR v_version_a.snapshot->'days'->0->'exercises'->0 ? 'completedCount'
     OR v_version_a.snapshot->'days'->0->'exercises'->0->>'target_load' <> '60 kg' THEN
    RAISE EXCEPTION 'Snapshot did not preserve only the expected executable prescription.';
  END IF;

  SELECT * INTO STRICT v_version_repeat FROM public.apply_program_version(v_program_a);
  SELECT count(*) INTO v_after_count FROM public.program_versions WHERE program_id=v_program_a;
  IF v_version_repeat.id<>v_version_a.id OR v_after_count<>v_before_count+1 THEN
    RAISE EXCEPTION 'Immediate identical apply was not idempotent.';
  END IF;

  v_days := pg_catalog.jsonb_set(v_days,'{0,exercises,0,reps}','10'::jsonb);
  v_days := pg_catalog.jsonb_set(v_days,'{0,exercises,1}',
    '{"id":"33333333-3333-4333-8333-333333333333","order":2,"name":"Remo de validación","muscleGroup":"Espalda","sets":2,"reps":12,"weight":"","rir":3,"restSeconds":60}'::jsonb,true);
  UPDATE public.programs SET data=pg_catalog.jsonb_build_object('id',v_program_a,'days',v_days)
  WHERE id=v_program_a;
  SELECT * INTO STRICT v_version_b FROM public.apply_program_version(v_program_a);
  IF v_version_b.id=v_version_a.id OR v_version_b.version_number<>v_version_a.version_number+1 THEN
    RAISE EXCEPTION 'Changed prescription did not create the next immutable version.';
  END IF;
  IF (SELECT snapshot FROM public.program_versions WHERE id=v_version_a.id) IS DISTINCT FROM
     '{"schema_version":1,"days":[{"id":"11111111-1111-4111-8111-111111111111","order":1,"title":"Día de validación","focus_area":"Fuerza","exercises":[{"id":"22222222-2222-4222-8222-222222222222","order":1,"name":"Sentadilla de validación","muscle_group":"Pierna","target_sets":3,"target_reps":8,"target_load":"60 kg","target_rir":2,"rest_seconds":90,"instructions":"Controla la ejecución","video_url":"https://example.test/guia"}]}]}'::jsonb THEN
    RAISE EXCEPTION 'V2 creation changed or replaced the previous snapshot.';
  END IF;
  IF v_version_b.snapshot->'days'->0->>'id' <> v_version_a.snapshot->'days'->0->>'id'
     OR v_version_b.snapshot->'days'->0->'exercises'->0->>'id' <> v_version_a.snapshot->'days'->0->'exercises'->0->>'id'
     OR v_version_b.snapshot->'days'->0->'exercises'->1->>'id' <> '33333333-3333-4333-8333-333333333333'
     OR v_version_b.snapshot->'days'->0->'exercises'->1->>'target_load' IS NOT NULL THEN
    RAISE EXCEPTION 'Stable/new IDs or unknown target-load NULL handling is incorrect.';
  END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.apply_program_version(v_program_b);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer A applied Trainer B program.'; END IF;

  v_rejected:=false;
  BEGIN
    INSERT INTO public.program_versions(program_id,version_number,snapshot,created_by)
    VALUES(v_program_a,999,'{"schema_version":1,"days":[]}'::jsonb,v_trainer_a);
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer directly inserted around apply validation.'; END IF;
  IF NOT pg_catalog.has_table_privilege('authenticated','public.program_versions','SELECT')
     OR pg_catalog.has_table_privilege('authenticated','public.program_versions','INSERT')
     OR pg_catalog.has_table_privilege('authenticated','public.program_versions','UPDATE')
     OR pg_catalog.has_table_privilege('authenticated','public.program_versions','DELETE')
     OR pg_catalog.has_table_privilege('authenticated','public.program_versions','TRUNCATE') THEN
    RAISE EXCEPTION 'Authenticated table privileges do not enforce append-only access.';
  END IF;

  v_mutation_rejected:=false;
  BEGIN
    UPDATE public.program_versions SET snapshot='{"schema_version":1,"days":[]}' WHERE id=v_version_a.id;
  EXCEPTION WHEN insufficient_privilege THEN v_mutation_rejected:=true;
  END;
  IF NOT v_mutation_rejected THEN RAISE EXCEPTION 'Authenticated Trainer updated a version row.'; END IF;
  v_mutation_rejected:=false;
  BEGIN
    DELETE FROM public.program_versions WHERE id=v_version_a.id;
  EXCEPTION WHEN insufficient_privilege THEN v_mutation_rejected:=true;
  END;
  IF NOT v_mutation_rejected THEN RAISE EXCEPTION 'Authenticated Trainer deleted a version row.'; END IF;
  v_mutation_rejected:=false;
  BEGIN
    EXECUTE 'TRUNCATE TABLE public.program_versions';
  EXCEPTION WHEN insufficient_privilege THEN v_mutation_rejected:=true;
  END;
  IF NOT v_mutation_rejected THEN RAISE EXCEPTION 'Authenticated Trainer truncated version rows.'; END IF;
END
$trainer_publish$;

DO $other_trainer_isolation$
DECLARE
  v_trainer_b uuid := current_setting('core1b.trainer_b')::uuid;
  v_program_a text := current_setting('core1b.program_a');
  v_program_b text := current_setting('core1b.program_b');
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_trainer_b::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',v_trainer_b,'role','authenticated')::text,true);
  IF EXISTS(SELECT 1 FROM public.program_versions WHERE program_id=v_program_a) THEN
    RAISE EXCEPTION 'Another Trainer can read versions owned by Trainer A.';
  END IF;
END
$other_trainer_isolation$;

DO $client_cannot_apply$
DECLARE
  v_client uuid := current_setting('core1b.client')::uuid;
  v_program_a text := current_setting('core1b.program_a');
  v_rejected boolean := false;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_client::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',v_client,'role','authenticated')::text,true);
  BEGIN
    PERFORM public.apply_program_version(v_program_a);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Client applied a Trainer program.'; END IF;
  IF EXISTS(SELECT 1 FROM public.program_versions WHERE program_id=v_program_a AND created_by=v_client) THEN
    RAISE EXCEPTION 'Client created a program version.';
  END IF;
END
$client_cannot_apply$;

DO $admin_read_only$
DECLARE
  v_admin uuid := current_setting('core1b.admin')::uuid;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  IF NOT public.is_account_enabled() OR NOT public.is_admin()
     OR NOT EXISTS(SELECT 1 FROM public.program_versions) THEN
    RAISE EXCEPTION 'Enabled Admin cannot read program versions.';
  END IF;
END
$admin_read_only$;

-- The database trigger is independently checked under the migration owner.
RESET ROLE;
DO $immutable_trigger$
DECLARE
  v_version_id uuid;
  v_rejected boolean;
BEGIN
  SELECT id INTO v_version_id FROM public.program_versions ORDER BY created_at DESC LIMIT 1;
  v_rejected:=false;
  BEGIN
    UPDATE public.program_versions SET snapshot='{"schema_version":1,"days":[]}' WHERE id=v_version_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Database trigger did not reject privileged UPDATE.'; END IF;
  v_rejected:=false;
  BEGIN
    DELETE FROM public.program_versions WHERE id=v_version_id;
  EXCEPTION WHEN SQLSTATE '42501' THEN v_rejected:=true;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Database trigger did not reject privileged DELETE.'; END IF;
END
$immutable_trigger$;

ROLLBACK;
