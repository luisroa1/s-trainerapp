-- CORE 1C: client prescription assignments point to immutable program_versions.
-- This migration is isolated-tested first. The legacy assigned_program_id is
-- maintained only as a database-derived projection for the cutover.

DO $preflight$
DECLARE
  v_has_assignments boolean := to_regclass('public.client_program_assignments') IS NOT NULL;
BEGIN
  IF to_regclass('public.clients') IS NULL
     OR to_regclass('public.programs') IS NULL
     OR to_regclass('public.program_versions') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('public.account_access') IS NULL
     OR to_regclass('private.account_operation_ledger') IS NULL THEN
    RAISE EXCEPTION 'CORE 1C requires CORE 1B and account governance objects.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clients c
    LEFT JOIN public.programs p ON p.id = c.assigned_program_id
    LEFT JOIN public.program_versions baseline
      ON baseline.program_id = c.assigned_program_id AND baseline.version_number = 1
    WHERE c.assigned_program_id IS NOT NULL
      AND (p.id IS NULL OR p.trainer_id::text IS DISTINCT FROM c.trainer_id::text OR baseline.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'CORE 1C cannot baseline an invalid, cross-owner, or unversioned legacy assignment.';
  END IF;

  IF v_has_assignments AND EXISTS (
    SELECT 1
    FROM public.client_program_assignments a
    JOIN public.program_versions pv ON pv.id = a.program_version_id
    JOIN public.clients c ON c.id = a.client_id
    WHERE a.ended_at IS NULL
      AND c.assigned_program_id IS DISTINCT FROM pv.program_id
  ) THEN
    RAISE EXCEPTION 'CORE 1C found an active assignment that disagrees with the legacy projection.';
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS public.client_program_assignments (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  client_id text NOT NULL
    REFERENCES public.clients(id) ON DELETE RESTRICT,
  program_version_id uuid NOT NULL
    REFERENCES public.program_versions(id) ON DELETE RESTRICT,
  assigned_by uuid NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  ended_at timestamptz NULL,
  CONSTRAINT client_program_assignments_end_after_start
    CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS client_program_assignments_one_active_per_client
  ON public.client_program_assignments(client_id)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS client_program_assignments_version_idx
  ON public.client_program_assignments(program_version_id);

ALTER TABLE public.client_program_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_program_assignments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.client_program_assignments TO authenticated;

DROP POLICY IF EXISTS client_program_assignments_select_authorized ON public.client_program_assignments;
CREATE POLICY client_program_assignments_select_authorized
  ON public.client_program_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_account_enabled()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.clients c
        JOIN public.profiles actor_profile ON actor_profile.id = (SELECT auth.uid())
        WHERE c.id = client_program_assignments.client_id
          AND c.trainer_id::text = (SELECT auth.uid())::text
          AND actor_profile.role = 'trainer'
      )
      OR (
        client_program_assignments.ended_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.clients c
          JOIN public.profiles client_profile ON client_profile.id = (SELECT auth.uid())
          WHERE c.id = client_program_assignments.client_id
            AND c.user_id = (SELECT auth.uid())
            AND client_profile.role = 'client'
        )
      )
    )
  );

-- Clients read exactly their assigned active version. Trainers/Admin retain the
-- existing CORE 1B read branches for programs they own or global Admin reads.
DROP POLICY IF EXISTS program_versions_select_client_assignment ON public.program_versions;
CREATE POLICY program_versions_select_client_assignment
  ON public.program_versions
  FOR SELECT TO authenticated
  USING (
    public.is_account_enabled()
    AND EXISTS (
      SELECT 1
      FROM public.client_program_assignments assignment
      JOIN public.clients c ON c.id = assignment.client_id
      JOIN public.profiles client_profile ON client_profile.id = (SELECT auth.uid())
      WHERE assignment.program_version_id = program_versions.id
        AND assignment.ended_at IS NULL
        AND c.user_id = (SELECT auth.uid())
        AND client_profile.role = 'client'
    )
  );

-- Do not let Client readers reach mutable program JSON after the cutover.
DROP POLICY IF EXISTS programs_select ON public.programs;
CREATE POLICY programs_select
  ON public.programs
  FOR SELECT TO authenticated
  USING (
    public.is_account_enabled()
    AND (
      (trainer_id::text = (SELECT auth.uid())::text
       AND EXISTS (
         SELECT 1 FROM public.profiles p
         WHERE p.id = (SELECT auth.uid()) AND p.role = 'trainer'
       ))
      OR public.is_admin()
    )
  );

CREATE OR REPLACE FUNCTION public.reject_client_program_assignment_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Client program assignment history is immutable.' USING ERRCODE = '42501';
  END IF;
  IF OLD.ended_at IS NOT NULL
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.program_version_id IS DISTINCT FROM OLD.program_version_id
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
     OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
     OR NEW.ended_at IS NULL THEN
    RAISE EXCEPTION 'Only closing an active Client program assignment is allowed.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.reject_client_program_assignment_history_mutation() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.reject_client_program_assignment_history_mutation() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_client_program_assignment_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_expected_program_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_program_id IS NOT NULL THEN
      RAISE EXCEPTION 'assigned_program_id is a managed compatibility projection.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.assigned_program_id IS DISTINCT FROM OLD.assigned_program_id THEN
    SELECT pv.program_id INTO v_expected_program_id
    FROM public.client_program_assignments assignment
    JOIN public.program_versions pv ON pv.id = assignment.program_version_id
    WHERE assignment.client_id = NEW.id AND assignment.ended_at IS NULL
    LIMIT 1;
    IF NEW.assigned_program_id IS DISTINCT FROM v_expected_program_id THEN
      RAISE EXCEPTION 'assigned_program_id is a managed compatibility projection.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.guard_client_program_assignment_projection() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guard_client_program_assignment_projection() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_client_program_assignment_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_client_id text := CASE WHEN TG_OP = 'DELETE' THEN OLD.client_id ELSE NEW.client_id END;
  v_program_id text;
BEGIN
  SELECT pv.program_id INTO v_program_id
  FROM public.client_program_assignments assignment
  JOIN public.program_versions pv ON pv.id = assignment.program_version_id
  WHERE assignment.client_id = v_client_id AND assignment.ended_at IS NULL
  LIMIT 1;

  UPDATE public.clients c
  SET assigned_program_id = v_program_id
  WHERE c.id = v_client_id AND c.assigned_program_id IS DISTINCT FROM v_program_id;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;
ALTER FUNCTION public.sync_client_program_assignment_projection() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_client_program_assignment_projection() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS client_program_assignments_immutable ON public.client_program_assignments;
CREATE TRIGGER client_program_assignments_immutable
  BEFORE UPDATE OR DELETE ON public.client_program_assignments
  FOR EACH ROW EXECUTE FUNCTION public.reject_client_program_assignment_history_mutation();

DROP TRIGGER IF EXISTS client_program_assignments_sync_projection ON public.client_program_assignments;
DROP TRIGGER IF EXISTS client_program_assignments_sync_projection_update ON public.client_program_assignments;
CREATE TRIGGER client_program_assignments_sync_projection
  AFTER INSERT OR DELETE ON public.client_program_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_program_assignment_projection();
CREATE TRIGGER client_program_assignments_sync_projection_update
  AFTER UPDATE OF ended_at ON public.client_program_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_program_assignment_projection();

DROP TRIGGER IF EXISTS clients_assignment_projection_guard ON public.clients;
CREATE TRIGGER clients_assignment_projection_guard
  BEFORE INSERT OR UPDATE OF assigned_program_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_program_assignment_projection();

-- Baseline is the state observable at cutover. Never manufacture past dates or
-- authors; do not duplicate an already-active equivalent assignment.
INSERT INTO public.client_program_assignments (client_id, program_version_id, assigned_by, assigned_at)
SELECT c.id, baseline.id, NULL, pg_catalog.transaction_timestamp()
FROM public.clients c
JOIN public.program_versions baseline
  ON baseline.program_id = c.assigned_program_id AND baseline.version_number = 1
WHERE c.assigned_program_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_program_assignments current_assignment
    WHERE current_assignment.client_id = c.id AND current_assignment.ended_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.apply_program_version(p_program_id text)
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
  SELECT p.* INTO v_program FROM public.programs p WHERE p.id = p_program_id FOR UPDATE;
  IF NOT FOUND
     OR v_program.trainer_id::text IS DISTINCT FROM v_actor::text
     OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.role = 'trainer')
     OR NOT EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id = v_actor AND a.state = 'enabled') THEN
    RAISE EXCEPTION 'Not authorized to apply this program.' USING ERRCODE = '42501';
  END IF;

  v_snapshot := public.build_program_version_snapshot(v_program.data->'days');
  SELECT pv.* INTO v_latest
  FROM public.program_versions pv
  WHERE pv.program_id = p_program_id
  ORDER BY pv.version_number DESC
  LIMIT 1;
  IF FOUND AND v_latest.snapshot = v_snapshot THEN RETURN v_latest; END IF;

  SELECT COALESCE(pg_catalog.max(pv.version_number), 0) + 1 INTO v_next
  FROM public.program_versions pv WHERE pv.program_id = p_program_id;
  INSERT INTO public.program_versions(program_id, version_number, snapshot, created_by)
  VALUES (p_program_id, v_next, v_snapshot, v_actor)
  RETURNING * INTO v_version;
  RETURN v_version;
END;
$function$;
ALTER FUNCTION public.apply_program_version(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.apply_program_version(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_program_to_client(
  p_assignment_id uuid,
  p_client_id text,
  p_program_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_client public.clients%ROWTYPE;
  v_program public.programs%ROWTYPE;
  v_version public.program_versions%ROWTYPE;
  v_assignment public.client_program_assignments%ROWTYPE;
  v_existing public.client_program_assignments%ROWTYPE;
  v_now timestamptz;
BEGIN
  IF v_actor IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.role = 'trainer')
     OR NOT EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id = v_actor AND a.state = 'enabled') THEN
    RAISE EXCEPTION 'Not authorized to assign this program.' USING ERRCODE = '42501';
  END IF;

  -- Lock order is always Client first, then Program inside apply_program_version.
  SELECT c.* INTO v_client FROM public.clients c WHERE c.id = p_client_id FOR UPDATE;
  IF NOT FOUND OR v_client.trainer_id::text IS DISTINCT FROM v_actor::text THEN
    RAISE EXCEPTION 'Not authorized to assign this program.' USING ERRCODE = '42501';
  END IF;

  IF p_program_id IS NULL THEN
    UPDATE public.client_program_assignments a
    SET ended_at = pg_catalog.clock_timestamp()
    WHERE a.client_id = p_client_id AND a.ended_at IS NULL;
    RETURN pg_catalog.jsonb_build_object('assignment', NULL, 'program_version', NULL);
  END IF;

  SELECT p.* INTO v_program FROM public.programs p WHERE p.id = p_program_id;
  IF NOT FOUND OR v_program.trainer_id::text IS DISTINCT FROM v_actor::text THEN
    RAISE EXCEPTION 'Not authorized to assign this program.' USING ERRCODE = '42501';
  END IF;

  v_version := public.apply_program_version(p_program_id);

  SELECT a.* INTO v_existing FROM public.client_program_assignments a
  WHERE a.client_id = p_client_id AND a.ended_at IS NULL;
  IF FOUND AND v_existing.program_version_id = v_version.id THEN
    RETURN pg_catalog.jsonb_build_object(
      'assignment', pg_catalog.to_jsonb(v_existing),
      'program_version', pg_catalog.to_jsonb(v_version)
    );
  END IF;

  IF p_assignment_id IS NOT NULL THEN
    SELECT a.* INTO v_assignment FROM public.client_program_assignments a WHERE a.id = p_assignment_id;
    IF FOUND THEN
      IF v_assignment.client_id IS DISTINCT FROM p_client_id
         OR v_assignment.assigned_by IS DISTINCT FROM v_actor
         OR v_assignment.program_version_id IS DISTINCT FROM v_version.id
         OR v_assignment.ended_at IS NOT NULL THEN
        RAISE EXCEPTION 'Assignment request conflicts with an existing operation.' USING ERRCODE = '23505';
      END IF;
      RETURN pg_catalog.jsonb_build_object(
        'assignment', pg_catalog.to_jsonb(v_assignment),
        'program_version', pg_catalog.to_jsonb(v_version)
      );
    END IF;
  END IF;

  UPDATE public.client_program_assignments a
  SET ended_at = pg_catalog.clock_timestamp()
  WHERE a.client_id = p_client_id AND a.ended_at IS NULL;

  v_now := pg_catalog.clock_timestamp();
  INSERT INTO public.client_program_assignments(id,client_id,program_version_id,assigned_by,assigned_at)
  VALUES (COALESCE(p_assignment_id,pg_catalog.gen_random_uuid()),p_client_id,v_version.id,v_actor,v_now)
  RETURNING * INTO v_assignment;

  RETURN pg_catalog.jsonb_build_object(
    'assignment', pg_catalog.to_jsonb(v_assignment),
    'program_version', pg_catalog.to_jsonb(v_version)
  );
END;
$function$;
ALTER FUNCTION public.apply_program_to_client(uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.apply_program_to_client(uuid,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.apply_program_to_client(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_invited_client(
  p_operation_id uuid,
  p_target_user_id uuid,
  p_client_id text,
  p_name text,
  p_email text,
  p_objective text,
  p_program_id text,
  p_assignment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_profile public.profiles%ROWTYPE;
  v_access public.account_access%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_result jsonb;
  v_operation private.account_operation_ledger%ROWTYPE;
BEGIN
  IF v_actor IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.role = 'trainer')
     OR NOT EXISTS (SELECT 1 FROM public.account_access a WHERE a.user_id = v_actor AND a.state = 'enabled') THEN
    RAISE EXCEPTION 'Not authorized to create this Client relation.' USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.btrim(COALESCE(p_name,'')) = '' OR p_target_user_id IS NULL OR p_client_id IS NULL
     OR p_operation_id IS NULL OR pg_catalog.btrim(COALESCE(p_email,'')) = '' THEN
    RAISE EXCEPTION 'Client invitation data is incomplete.' USING ERRCODE = '22023';
  END IF;

  SELECT op.* INTO v_operation FROM private.account_operation_ledger op
  WHERE op.operation_id = p_operation_id AND op.operation_type = 'client_invite' FOR UPDATE;
  IF NOT FOUND OR v_operation.actor_user_id IS DISTINCT FROM v_actor
     OR v_operation.target_email IS DISTINCT FROM pg_catalog.lower(pg_catalog.btrim(p_email))
     OR v_operation.state <> 'started' OR v_operation.target_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation operation is not valid for this Client.' USING ERRCODE = '42501';
  END IF;

  SELECT p.* INTO v_profile FROM public.profiles p WHERE p.id = p_target_user_id;
  SELECT a.* INTO v_access FROM public.account_access a WHERE a.user_id = p_target_user_id;
  IF v_profile.id IS NULL OR v_access.user_id IS NULL OR v_profile.role <> 'client' OR v_access.state <> 'pending'
     OR pg_catalog.lower(pg_catalog.btrim(v_profile.email)) <> pg_catalog.lower(pg_catalog.btrim(p_email))
     OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_target_user_id
       AND pg_catalog.lower(pg_catalog.btrim(u.email)) = pg_catalog.lower(pg_catalog.btrim(p_email)))
     OR EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Invited Client identity is not pending or already linked.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clients c WHERE c.id = p_client_id) THEN
    RAISE EXCEPTION 'Client relation already exists.' USING ERRCODE = '23505';
  END IF;
  IF p_program_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.programs p WHERE p.id = p_program_id AND p.trainer_id::text = v_actor::text
  ) THEN
    RAISE EXCEPTION 'Not authorized to assign this program.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.clients(id,user_id,trainer_id,name,email,objective,status,assigned_program_id,data)
  VALUES (
    p_client_id,p_target_user_id,v_actor,pg_catalog.btrim(p_name),
    pg_catalog.lower(pg_catalog.btrim(p_email)),NULLIF(pg_catalog.btrim(p_objective),''),
    'Pendiente',NULL,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'id',p_client_id,'name',pg_catalog.btrim(p_name),
      'email',pg_catalog.lower(pg_catalog.btrim(p_email)),'trainerId',v_actor
    ))
  ) RETURNING * INTO v_client;

  IF p_program_id IS NOT NULL THEN
    v_result := public.apply_program_to_client(p_assignment_id,p_client_id,p_program_id);
  ELSE
    v_result := pg_catalog.jsonb_build_object('assignment',NULL,'program_version',NULL);
  END IF;
  SELECT c.* INTO v_client FROM public.clients c WHERE c.id=p_client_id;
  RETURN pg_catalog.jsonb_build_object(
    'client',pg_catalog.jsonb_build_object(
      'id',v_client.id,'user_id',v_client.user_id,'trainer_id',v_client.trainer_id,
      'name',v_client.name,'email',v_client.email,'objective',v_client.objective,
      'status',v_client.status,'assigned_program_id',v_client.assigned_program_id,'data',v_client.data
    ),
    'assignment',v_result->'assignment','program_version',v_result->'program_version'
  );
END;
$function$;
ALTER FUNCTION public.complete_invited_client(uuid,uuid,text,text,text,text,text,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_invited_client(uuid,uuid,text,text,text,text,text,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.complete_invited_client(uuid,uuid,text,text,text,text,text,uuid) TO authenticated;

-- Apply the baseline to assigned legacy Clients, preserving an existing
-- active equivalent row and refusing a contradictory prior assignment.
DO $baseline_check$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.client_program_assignments a ON a.client_id = c.id AND a.ended_at IS NULL
    JOIN public.program_versions pv ON pv.id = a.program_version_id
    WHERE c.assigned_program_id IS DISTINCT FROM pv.program_id
  ) THEN
    RAISE EXCEPTION 'CORE 1C baseline would contradict an active assignment.';
  END IF;
END;
$baseline_check$;

-- Assignment operations only; direct table DML stays unavailable to app roles.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.client_program_assignments FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.client_program_assignments TO authenticated;
