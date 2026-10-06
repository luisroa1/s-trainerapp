-- CORE 1C transaction-safe isolated checks. Uses existing Auth identities only.
-- Temporary Client/program/ledger/audit writes are all rolled back.
BEGIN;

DO $setup$
DECLARE
  v_trainer_a uuid;
  v_trainer_b uuid;
  v_admin uuid;
  v_client_a text;
  v_user_a uuid;
  v_program_a text;
  v_version_a uuid;
  v_client_b text;
  v_user_b uuid;
  v_program_b text;
  v_pending_a uuid;
  v_pending_b uuid;
  v_email_a text;
  v_email_b text;
  v_snapshot jsonb;
BEGIN
  SELECT p.id INTO v_trainer_a
  FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='enabled'
  WHERE p.role='trainer' AND EXISTS (SELECT 1 FROM public.clients c WHERE c.trainer_id::text=p.id::text)
  ORDER BY p.id LIMIT 1;
  SELECT p.id INTO v_trainer_b
  FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='enabled'
  WHERE p.role='trainer' AND p.id<>v_trainer_a ORDER BY p.id LIMIT 1;
  SELECT p.id INTO v_admin FROM public.profiles p WHERE p.role='admin' ORDER BY p.id LIMIT 1;
  SELECT c.id,c.user_id,c.assigned_program_id,a.program_version_id,pv.snapshot
  INTO v_client_a,v_user_a,v_program_a,v_version_a,v_snapshot
  FROM public.clients c
  JOIN public.client_program_assignments a ON a.client_id=c.id AND a.ended_at IS NULL
  JOIN public.program_versions pv ON pv.id=a.program_version_id
  WHERE c.trainer_id::text=v_trainer_a::text AND c.user_id IS NOT NULL
  ORDER BY c.id LIMIT 1;
  SELECT c.id,c.user_id,c.assigned_program_id
  INTO v_client_b,v_user_b,v_program_b
  FROM public.clients c JOIN public.client_program_assignments a ON a.client_id=c.id AND a.ended_at IS NULL
  WHERE c.trainer_id::text=v_trainer_a::text AND c.user_id IS NOT NULL AND c.id<>v_client_a
  ORDER BY c.id LIMIT 1;
  SELECT p.id,u.email INTO v_pending_a,v_email_a
  FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='pending'
  JOIN auth.users u ON u.id=p.id
  WHERE p.role='client' AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE pg_catalog.lower(pg_catalog.btrim(c.email))=pg_catalog.lower(pg_catalog.btrim(u.email)))
  ORDER BY p.id LIMIT 1;
  SELECT p.id,u.email INTO v_pending_b,v_email_b
  FROM public.profiles p JOIN public.account_access aa ON aa.user_id=p.id AND aa.state='pending'
  JOIN auth.users u ON u.id=p.id
  WHERE p.role='client' AND p.id<>v_pending_a
    AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE pg_catalog.lower(pg_catalog.btrim(c.email))=pg_catalog.lower(pg_catalog.btrim(u.email)))
  ORDER BY p.id LIMIT 1;
  IF v_trainer_a IS NULL OR v_trainer_b IS NULL OR v_admin IS NULL OR v_client_a IS NULL
     OR v_user_a IS NULL OR v_program_a IS NULL OR v_version_a IS NULL OR v_snapshot IS NULL
     OR v_client_b IS NULL OR v_user_b IS NULL OR v_program_b IS NULL
     OR v_pending_a IS NULL OR v_pending_b IS NULL OR v_email_a IS NULL OR v_email_b IS NULL THEN
    RAISE EXCEPTION 'CORE 1C checks require enabled Trainer A/B, Admin, two assigned Clients and two existing pending Auth identities';
  END IF;
  PERFORM pg_catalog.set_config('core1c.trainer_a',v_trainer_a::text,true);
  PERFORM pg_catalog.set_config('core1c.trainer_b',v_trainer_b::text,true);
  PERFORM pg_catalog.set_config('core1c.admin',v_admin::text,true);
  PERFORM pg_catalog.set_config('core1c.client_a',v_client_a,true);
  PERFORM pg_catalog.set_config('core1c.user_a',v_user_a::text,true);
  PERFORM pg_catalog.set_config('core1c.program_a',v_program_a,true);
  PERFORM pg_catalog.set_config('core1c.version_a',v_version_a::text,true);
  PERFORM pg_catalog.set_config('core1c.snapshot_v1',v_snapshot::text,true);
  PERFORM pg_catalog.set_config('core1c.client_b',v_client_b,true);
  PERFORM pg_catalog.set_config('core1c.user_b',v_user_b::text,true);
  PERFORM pg_catalog.set_config('core1c.program_b',v_program_b,true);
  PERFORM pg_catalog.set_config('core1c.pending_a',v_pending_a::text,true);
  PERFORM pg_catalog.set_config('core1c.pending_b',v_pending_b::text,true);
  PERFORM pg_catalog.set_config('core1c.email_a',pg_catalog.lower(v_email_a),true);
  PERFORM pg_catalog.set_config('core1c.email_b',pg_catalog.lower(v_email_b),true);
  PERFORM pg_catalog.set_config('core1c.client_temp_a','core1c-'||pg_catalog.txid_current()::text||'-without-program',true);
  PERFORM pg_catalog.set_config('core1c.client_temp_b','core1c-'||pg_catalog.txid_current()::text||'-with-program',true);
END;
$setup$;

DO $schema_and_baseline$
DECLARE v_active_count bigint; v_legacy_count bigint;
BEGIN
  IF NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c WHERE c.oid='public.client_program_assignments'::regclass) THEN
    RAISE EXCEPTION 'RLS must be enabled on assignments';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_index i WHERE i.indexrelid='public.client_program_assignments_one_active_per_client'::regclass AND i.indisunique AND i.indisvalid) THEN
    RAISE EXCEPTION 'One-active unique index missing';
  END IF;
  IF pg_catalog.has_table_privilege('authenticated','public.client_program_assignments','INSERT')
     OR pg_catalog.has_table_privilege('authenticated','public.client_program_assignments','UPDATE')
     OR pg_catalog.has_table_privilege('authenticated','public.client_program_assignments','DELETE')
     OR pg_catalog.has_table_privilege('authenticated','public.client_program_assignments','TRUNCATE') THEN
    RAISE EXCEPTION 'Application role has direct assignment writes';
  END IF;
  IF pg_catalog.has_table_privilege('authenticated','public.program_versions','INSERT')
     OR pg_catalog.has_table_privilege('authenticated','public.program_versions','UPDATE')
     OR pg_catalog.has_table_privilege('authenticated','public.program_versions','DELETE')
     OR pg_catalog.has_table_privilege('authenticated','public.program_versions','TRUNCATE') THEN
    RAISE EXCEPTION 'Application role has direct version writes';
  END IF;
  SELECT pg_catalog.count(*) INTO v_active_count FROM public.client_program_assignments WHERE ended_at IS NULL;
  SELECT pg_catalog.count(*) INTO v_legacy_count FROM public.clients WHERE assigned_program_id IS NOT NULL;
  IF v_active_count<>v_legacy_count THEN RAISE EXCEPTION 'Baseline rows differ from legacy assignments'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.clients c
    LEFT JOIN public.client_program_assignments a ON a.client_id=c.id AND a.ended_at IS NULL
    LEFT JOIN public.program_versions pv ON pv.id=a.program_version_id
    WHERE (c.assigned_program_id IS NULL AND a.id IS NOT NULL)
       OR (c.assigned_program_id IS NOT NULL AND (a.id IS NULL OR pv.program_id IS DISTINCT FROM c.assigned_program_id))
  ) THEN RAISE EXCEPTION 'Legacy projection and active assignment diverge'; END IF;
END;
$schema_and_baseline$;

DO $unique_active_backstop$
DECLARE v_rejected boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.client_program_assignments(client_id,program_version_id,assigned_by,assigned_at)
    VALUES(current_setting('core1c.client_a'),current_setting('core1c.version_a')::uuid,current_setting('core1c.trainer_a')::uuid,pg_catalog.transaction_timestamp());
  EXCEPTION WHEN unique_violation THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Partial unique index allowed a second active assignment'; END IF;
END;
$unique_active_backstop$;

-- Rebuild the cutover baseline from the existing legacy column inside this
-- rollback-only transaction, then rerun it to prove idempotence.
ALTER TABLE public.client_program_assignments DISABLE TRIGGER client_program_assignments_immutable;
ALTER TABLE public.client_program_assignments DISABLE TRIGGER client_program_assignments_sync_projection;
ALTER TABLE public.client_program_assignments DISABLE TRIGGER client_program_assignments_sync_projection_update;
DELETE FROM public.client_program_assignments;
ALTER TABLE public.client_program_assignments ENABLE TRIGGER client_program_assignments_immutable;
ALTER TABLE public.client_program_assignments ENABLE TRIGGER client_program_assignments_sync_projection;
ALTER TABLE public.client_program_assignments ENABLE TRIGGER client_program_assignments_sync_projection_update;
INSERT INTO public.client_program_assignments(client_id,program_version_id,assigned_by,assigned_at)
SELECT c.id,pv.id,NULL,pg_catalog.transaction_timestamp()
FROM public.clients c JOIN public.program_versions pv
  ON pv.program_id=c.assigned_program_id AND pv.version_number=1
WHERE c.assigned_program_id IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM public.client_program_assignments a WHERE a.client_id=c.id AND a.ended_at IS NULL);
INSERT INTO public.client_program_assignments(client_id,program_version_id,assigned_by,assigned_at)
SELECT c.id,pv.id,NULL,pg_catalog.transaction_timestamp()
FROM public.clients c JOIN public.program_versions pv
  ON pv.program_id=c.assigned_program_id AND pv.version_number=1
WHERE c.assigned_program_id IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM public.client_program_assignments a WHERE a.client_id=c.id AND a.ended_at IS NULL);
DO $baseline_rebuilt$
DECLARE v_legacy_count bigint; v_active_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO v_legacy_count FROM public.clients WHERE assigned_program_id IS NOT NULL;
  SELECT pg_catalog.count(*) INTO v_active_count FROM public.client_program_assignments WHERE ended_at IS NULL;
  IF v_active_count<>v_legacy_count OR EXISTS(
    SELECT 1 FROM public.client_program_assignments WHERE ended_at IS NULL AND assigned_by IS NOT NULL
  ) THEN RAISE EXCEPTION 'Baseline must recreate exactly one unattributed active row per legacy assignment'; END IF;
END;
$baseline_rebuilt$;
DO $immutability_triggers$
DECLARE v_assignment uuid; v_version uuid; v_rejected boolean;
BEGIN
  SELECT a.id,a.program_version_id INTO v_assignment,v_version
  FROM public.client_program_assignments a WHERE a.ended_at IS NULL ORDER BY a.client_id LIMIT 1;
  v_rejected:=false;
  BEGIN
    UPDATE public.client_program_assignments SET assigned_by=assigned_by WHERE id=v_assignment;
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Assignment history trigger allowed a no-op update'; END IF;
  v_rejected:=false;
  BEGIN
    DELETE FROM public.client_program_assignments WHERE id=v_assignment;
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Assignment history trigger allowed deletion'; END IF;
  v_rejected:=false;
  BEGIN
    UPDATE public.program_versions SET snapshot=snapshot||'{"probe":true}'::jsonb WHERE id=v_version;
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Program version immutability trigger allowed update'; END IF;
  v_rejected:=false;
  BEGIN
    DELETE FROM public.program_versions WHERE id=v_version;
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Program version immutability trigger allowed delete'; END IF;
END;
$immutability_triggers$;

SELECT pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('core1c.trainer_a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $trainer_read_and_idempotence$
DECLARE v_result jsonb; v_old uuid; v_count bigint;
BEGIN
  SELECT id INTO v_old FROM public.client_program_assignments WHERE client_id=current_setting('core1c.client_a') AND ended_at IS NULL;
  v_result:=public.apply_program_to_client(pg_catalog.gen_random_uuid(),current_setting('core1c.client_a'),current_setting('core1c.program_a'));
  IF v_old IS DISTINCT FROM (v_result->'assignment'->>'id')::uuid THEN RAISE EXCEPTION 'Same active version did not return the existing assignment'; END IF;
  SELECT pg_catalog.count(*) INTO v_count FROM public.client_program_assignments WHERE client_id=current_setting('core1c.client_a') AND ended_at IS NULL;
  IF v_count<>1 THEN RAISE EXCEPTION 'Idempotent retry created extra active history'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_program_assignments WHERE id=v_old) THEN RAISE EXCEPTION 'Trainer cannot read own assignment'; END IF;
END;
$trainer_read_and_idempotence$;

SELECT pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('core1c.trainer_b'),'role','authenticated')::text,true);
DO $cross_trainer_denied$
DECLARE v_rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.apply_program_to_client(pg_catalog.gen_random_uuid(),current_setting('core1c.client_a'),current_setting('core1c.program_a'));
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Trainer B assigned another Trainer Client/program'; END IF;
  IF EXISTS (SELECT 1 FROM public.client_program_assignments WHERE client_id=current_setting('core1c.client_a')) THEN
    RAISE EXCEPTION 'Trainer B read another Trainer assignment';
  END IF;
  IF EXISTS (SELECT 1 FROM public.program_versions WHERE id=current_setting('core1c.version_a')::uuid) THEN
    RAISE EXCEPTION 'Trainer B read another Trainer program version';
  END IF;
END;
$cross_trainer_denied$;

RESET ROLE;
UPDATE public.account_access SET state='suspended'
WHERE user_id=current_setting('core1c.trainer_a')::uuid;
SELECT pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('core1c.trainer_a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $disabled_trainer_denied$
DECLARE v_rejected boolean:=false;
BEGIN
  BEGIN
    PERFORM public.apply_program_to_client(pg_catalog.gen_random_uuid(),current_setting('core1c.client_a'),current_setting('core1c.program_a'));
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Suspended Trainer must not apply a Client program'; END IF;
END;
$disabled_trainer_denied$;
RESET ROLE;
UPDATE public.account_access SET state='enabled'
WHERE user_id=current_setting('core1c.trainer_a')::uuid;

SELECT pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('core1c.user_a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
CREATE TEMP TABLE core1c_client_own_assignment ON COMMIT DROP AS
SELECT pg_catalog.count(*) AS row_count FROM public.client_program_assignments
WHERE client_id=current_setting('core1c.client_a') AND ended_at IS NULL;
CREATE TEMP TABLE core1c_client_foreign_assignment ON COMMIT DROP AS
SELECT pg_catalog.count(*) AS row_count FROM public.client_program_assignments
WHERE client_id=current_setting('core1c.client_b');
CREATE TEMP TABLE core1c_client_own_version ON COMMIT DROP AS
SELECT pg_catalog.count(*) AS row_count FROM public.program_versions WHERE id=current_setting('core1c.version_a')::uuid;
CREATE TEMP TABLE core1c_client_foreign_versions ON COMMIT DROP AS
SELECT pg_catalog.count(*) AS row_count FROM public.program_versions WHERE id<>current_setting('core1c.version_a')::uuid;
CREATE TEMP TABLE core1c_client_mutable_program ON COMMIT DROP AS
SELECT pg_catalog.count(*) AS row_count FROM public.programs WHERE id=current_setting('core1c.program_a');
DO $client_direct_write_denied$
DECLARE v_rejected boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.client_program_assignments(client_id,program_version_id)
    VALUES(current_setting('core1c.client_a'),current_setting('core1c.version_a')::uuid);
  EXCEPTION WHEN insufficient_privilege THEN v_rejected:=true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Client wrote an assignment directly'; END IF;
END;
$client_direct_write_denied$;
RESET ROLE;
DO $client_read_assertions$
BEGIN
  IF (SELECT row_count FROM core1c_client_own_assignment)<>1
     OR (SELECT row_count FROM core1c_client_foreign_assignment)<>0 THEN
    RAISE EXCEPTION 'Client can read only its own active assignment';
  END IF;
  IF (SELECT row_count FROM core1c_client_own_version)<>1
     OR (SELECT row_count FROM core1c_client_foreign_versions)<>0 THEN
    RAISE EXCEPTION 'Client can read only its active assigned version';
  END IF;
  IF (SELECT row_count FROM core1c_client_mutable_program)<>0 THEN
    RAISE EXCEPTION 'Client can read mutable program JSON';
  END IF;
END;
$client_read_assertions$;

SELECT pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('core1c.admin'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $admin_read$
DECLARE v_count bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO v_count FROM public.client_program_assignments;
  IF v_count<2 THEN RAISE EXCEPTION 'Admin lost global assignment read access'; END IF;
END;
$admin_read$;
RESET ROLE;

-- Edit the persisted editable program, then apply through the authenticated RPC.
DO $edit_program_v2$
DECLARE v_day uuid:=pg_catalog.gen_random_uuid(); v_ex uuid:=pg_catalog.gen_random_uuid();
BEGIN
  PERFORM pg_catalog.set_config('core1c.day_id',v_day::text,true);
  PERFORM pg_catalog.set_config('core1c.exercise_id',v_ex::text,true);
  UPDATE public.programs SET data=pg_catalog.jsonb_set(COALESCE(data,'{}'::jsonb),'{days}',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('id',v_day,'title','CORE 1C rollback test',
      'exercises',pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id',v_ex,'name','CORE 1C test exercise','sets',3,'reps',8,'weight','20 kg','rir',2,'restSeconds',90
      )))),true)
  WHERE id=current_setting('core1c.program_a');
END;
$edit_program_v2$;
SELECT pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('core1c.trainer_a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $apply_v2$
DECLARE v_result jsonb; v_assignment jsonb; v_old_id uuid; v_v1_id uuid; v_version_id uuid; v_count bigint; v_retry jsonb;
BEGIN
  SELECT id,program_version_id INTO v_old_id,v_v1_id FROM public.client_program_assignments
  WHERE client_id=current_setting('core1c.client_a') AND ended_at IS NULL;
  v_result:=public.apply_program_to_client(pg_catalog.gen_random_uuid(),current_setting('core1c.client_a'),current_setting('core1c.program_a'));
  v_assignment:=v_result->'assignment'; v_version_id:=(v_assignment->>'program_version_id')::uuid;
  IF v_assignment->>'assigned_by' IS DISTINCT FROM current_setting('core1c.trainer_a') THEN RAISE EXCEPTION 'RPC did not attribute assignment to actor'; END IF;
  IF v_version_id IS NULL OR v_version_id=v_v1_id THEN RAISE EXCEPTION 'Changed prescription did not produce next version'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_program_assignments WHERE id=v_old_id AND ended_at IS NOT NULL) THEN RAISE EXCEPTION 'Previous assignment was not closed'; END IF;
  IF (SELECT snapshot FROM public.program_versions WHERE id=v_v1_id) IS DISTINCT FROM current_setting('core1c.snapshot_v1')::jsonb THEN RAISE EXCEPTION 'V1 snapshot mutated'; END IF;
  IF (SELECT snapshot->'days'->0->'exercises'->0->>'id' FROM public.program_versions WHERE id=v_version_id) IS DISTINCT FROM current_setting('core1c.exercise_id') THEN RAISE EXCEPTION 'Stable exercise UUID not captured'; END IF;
  PERFORM pg_catalog.set_config('core1c.version_v2',v_version_id::text,true);
  PERFORM pg_catalog.set_config('core1c.snapshot_v2',(SELECT snapshot::text FROM public.program_versions WHERE id=v_version_id),true);
  PERFORM pg_catalog.set_config('core1c.assignment_v2',v_assignment->>'id',true);
  v_retry:=public.apply_program_to_client(pg_catalog.gen_random_uuid(),current_setting('core1c.client_a'),current_setting('core1c.program_a'));
  IF v_retry->'assignment'->>'id' IS DISTINCT FROM v_assignment->>'id' THEN RAISE EXCEPTION 'Retry created duplicate assignment history'; END IF;
  SELECT pg_catalog.count(*) INTO v_count FROM public.client_program_assignments WHERE client_id=current_setting('core1c.client_a');
  IF v_count<>2 THEN RAISE EXCEPTION 'Retry created a false historical row'; END IF;
END;
$apply_v2$;
RESET ROLE;

DO $edit_program_again$
BEGIN
  UPDATE public.programs SET data=pg_catalog.jsonb_set(data,'{days,0,exercises,0,reps}','10'::jsonb,true)
  WHERE id=current_setting('core1c.program_a');
END;
$edit_program_again$;
SELECT pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('core1c.trainer_a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $apply_v3$
DECLARE v_result jsonb; v_new_version uuid;
BEGIN
  v_result:=public.apply_program_to_client(pg_catalog.gen_random_uuid(),current_setting('core1c.client_a'),current_setting('core1c.program_a'));
  v_new_version:=(v_result->'assignment'->>'program_version_id')::uuid;
  IF v_new_version=current_setting('core1c.version_v2')::uuid THEN RAISE EXCEPTION 'Changed prescription did not create a later version'; END IF;
  IF (SELECT snapshot FROM public.program_versions WHERE id=current_setting('core1c.version_v2')::uuid)
     IS DISTINCT FROM current_setting('core1c.snapshot_v2')::jsonb THEN
    RAISE EXCEPTION 'Prior snapshot changed';
  END IF;
  IF (SELECT snapshot->'days'->0->>'id' FROM public.program_versions WHERE id=v_new_version)
       IS DISTINCT FROM current_setting('core1c.day_id')
     OR (SELECT snapshot->'days'->0->'exercises'->0->>'id' FROM public.program_versions WHERE id=v_new_version)
       IS DISTINCT FROM current_setting('core1c.exercise_id')
     OR (SELECT snapshot->'days'->0->'exercises'->0->>'target_reps' FROM public.program_versions WHERE id=v_new_version)<>'10' THEN
    RAISE EXCEPTION 'Day/exercise IDs changed across edit or edited prescription was not captured';
  END IF;
  PERFORM pg_catalog.set_config('core1c.version_v3',v_new_version::text,true);
END;
$apply_v3$;
RESET ROLE;

DO $edit_to_empty$
BEGIN
  UPDATE public.programs SET data=pg_catalog.jsonb_set(data,'{days}','[]'::jsonb,true)
  WHERE id=current_setting('core1c.program_a');
END;
$edit_to_empty$;
SELECT pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('core1c.trainer_a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $empty_program_and_remove$
DECLARE v_result jsonb; v_version uuid;
BEGIN
  v_result:=public.apply_program_to_client(pg_catalog.gen_random_uuid(),current_setting('core1c.client_a'),current_setting('core1c.program_a'));
  v_version:=(v_result->'assignment'->>'program_version_id')::uuid;
  IF (SELECT snapshot->'days' FROM public.program_versions WHERE id=v_version) <> '[]'::jsonb THEN RAISE EXCEPTION 'Empty prescription was replaced with demo content'; END IF;
  v_result:=public.apply_program_to_client(pg_catalog.gen_random_uuid(),current_setting('core1c.client_a'),NULL);
  IF v_result->'assignment' IS DISTINCT FROM 'null'::jsonb
     OR EXISTS (SELECT 1 FROM public.client_program_assignments WHERE client_id=current_setting('core1c.client_a') AND ended_at IS NULL)
     OR EXISTS (SELECT 1 FROM public.clients WHERE id=current_setting('core1c.client_a') AND assigned_program_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Removing assignment did not result in no-program state/projection';
  END IF;
END;
$empty_program_and_remove$;
RESET ROLE;

-- Exercise the invite completion DB step with existing pending Auth identities.
-- This is not an HTTP invite and does not create Auth users or send email.
SELECT pg_catalog.set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT pg_catalog.set_config('core1c.invite_op_a',
  (public.begin_client_invitation(current_setting('core1c.trainer_a')::uuid,current_setting('core1c.email_a'),
    pg_catalog.md5('core1c:'||pg_catalog.txid_current()::text||':a'),pg_catalog.gen_random_uuid())->>'operation_id'),true);
SELECT pg_catalog.set_config('core1c.invite_op_b',
  (public.begin_client_invitation(current_setting('core1c.trainer_a')::uuid,current_setting('core1c.email_b'),
    pg_catalog.md5('core1c:'||pg_catalog.txid_current()::text||':b'),pg_catalog.gen_random_uuid())->>'operation_id'),true);
SELECT pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',current_setting('core1c.trainer_a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $invite_without_program$
DECLARE v_result jsonb;
BEGIN
  v_result:=public.complete_invited_client(current_setting('core1c.invite_op_a')::uuid,current_setting('core1c.pending_a')::uuid,
    current_setting('core1c.client_temp_a'),'CORE 1C rollback test',current_setting('core1c.email_a'),NULL,NULL,NULL);
  IF v_result->'assignment' IS DISTINCT FROM 'null'::jsonb
     OR v_result->'client'->>'assigned_program_id' IS NOT NULL THEN RAISE EXCEPTION 'No-program invite did not stay unassigned'; END IF;
  PERFORM pg_catalog.set_config('core1c.invite_result_a',v_result::text,true);
END;
$invite_without_program$;
DO $invite_with_program$
DECLARE v_result jsonb;
BEGIN
  v_result:=public.complete_invited_client(current_setting('core1c.invite_op_b')::uuid,current_setting('core1c.pending_b')::uuid,
    current_setting('core1c.client_temp_b'),'CORE 1C rollback test',current_setting('core1c.email_b'),NULL,
    current_setting('core1c.program_a'),pg_catalog.gen_random_uuid());
  IF v_result->'assignment'->>'id' IS NULL OR v_result->'program_version'->>'id' IS NULL
     OR v_result->'client'->>'assigned_program_id' IS DISTINCT FROM current_setting('core1c.program_a') THEN
    RAISE EXCEPTION 'Program invite did not return confirmed assignment/version/projection';
  END IF;
  PERFORM pg_catalog.set_config('core1c.invite_result_b',v_result::text,true);
END;
$invite_with_program$;
RESET ROLE;
SELECT pg_catalog.set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT public.finish_client_invitation(current_setting('core1c.invite_op_a')::uuid,current_setting('core1c.pending_a')::uuid,'invited',NULL,pg_catalog.gen_random_uuid());
SELECT public.finish_client_invitation(current_setting('core1c.invite_op_b')::uuid,current_setting('core1c.pending_b')::uuid,'invited',NULL,pg_catalog.gen_random_uuid());

DO $temporary_rows_are_transactional$
DECLARE v_clients bigint; v_assignments bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO v_clients FROM public.clients WHERE id IN (current_setting('core1c.client_temp_a'),current_setting('core1c.client_temp_b'));
  SELECT pg_catalog.count(*) INTO v_assignments FROM public.client_program_assignments WHERE client_id IN (current_setting('core1c.client_temp_a'),current_setting('core1c.client_temp_b'));
  IF v_clients<>2 OR v_assignments<>1 THEN
    RAISE EXCEPTION 'Invite transaction did not create expected temporary Client/assignment rows';
  END IF;
END;
$temporary_rows_are_transactional$;

ROLLBACK;
