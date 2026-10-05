-- Admin governance foundation (3B).
-- Adds an independent account-access gate, private operation/audit records,
-- closes direct profile-role updates, and preserves existing RLS predicates.
-- This migration intentionally does not provision Trainers, suspend users,
-- transfer ownership, or modify clients/programs/nutrition data.

DO $preflight$
BEGIN
  IF to_regclass('public.account_access') IS NOT NULL
     OR to_regclass('private.account_operation_ledger') IS NOT NULL
     OR to_regclass('private.admin_audit_events') IS NOT NULL THEN
    RAISE EXCEPTION '3B precondition failed: governance objects already exist; inspect and reconcile before applying.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clients'
      AND policyname = 'clients_insert' AND cmd = 'INSERT'
      AND with_check IS NOT NULL
      AND position('programs' IN lower(with_check)) = 0
      AND position('profiles' IN lower(with_check)) > 0
      AND position('role' IN lower(with_check)) > 0
      AND position('trainer' IN lower(with_check)) > 0
  ) THEN
    RAISE EXCEPTION '3B precondition failed: clients_insert is not the approved non-recursive RLS1 policy.';
  END IF;

  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.enforce_client_program_ownership()'::regprocedure) THEN
    RAISE EXCEPTION '3B precondition failed: enforce_client_program_ownership must remain SECURITY INVOKER.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE u.id IS NULL OR p.role IS NULL OR p.role NOT IN ('admin', 'trainer', 'client')
  ) OR EXISTS (
    SELECT 1 FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION '3B precondition failed: Auth users and profiles are not a complete valid identity mapping.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clients c
    LEFT JOIN public.profiles p ON p.id = c.user_id
    WHERE c.user_id IS NOT NULL AND (p.id IS NULL OR p.role <> 'client')
  ) THEN
    RAISE EXCEPTION '3B precondition failed: a linked client row has no matching Client profile.';
  END IF;

  IF EXISTS (
    SELECT c.user_id FROM public.clients c
    WHERE c.user_id IS NOT NULL
    GROUP BY c.user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '3B precondition failed: a user is linked to multiple client rows.';
  END IF;

  IF to_regnamespace('private') IS NOT NULL AND EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'private' AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
  ) THEN
    RAISE EXCEPTION '3B precondition failed: private schema already contains data objects; inspect privileges before proceeding.';
  END IF;
END;
$preflight$;

CREATE SCHEMA IF NOT EXISTS private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.account_access (
  user_id uuid PRIMARY KEY
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  state text NOT NULL
    CHECK (state IN ('pending', 'enabled', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version > 0),
  changed_by uuid
);
COMMENT ON TABLE public.account_access IS
  'Effective application access state. Missing rows deny access; profiles.role remains the role authority.';
COMMENT ON COLUMN public.account_access.changed_by IS
  'Actor UUID for the latest state transition; audit details are kept in private.admin_audit_events.';
ALTER TABLE public.account_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_access FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.account_access TO authenticated, service_role;
CREATE POLICY account_access_select_own ON public.account_access
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TABLE private.account_operation_ledger (
  operation_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  operation_type text NOT NULL CHECK (operation_type IN ('client_invite', 'trainer_provision')),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 32 AND 128),
  actor_user_id uuid NOT NULL,
  target_email text NOT NULL CHECK (
    length(target_email) BETWEEN 3 AND 320
    AND target_email = pg_catalog.lower(pg_catalog.btrim(target_email))
  ),
  target_user_id uuid,
  state text NOT NULL CHECK (state IN ('started', 'invited', 'accepted', 'failed', 'partial', 'cancelled', 'expired')),
  safe_error_code text CHECK (
    safe_error_code IS NULL OR safe_error_code ~ '^[a-z0-9_:-]{1,80}$'
  ),
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (actor_user_id, operation_type, idempotency_key)
);
CREATE INDEX account_operation_ledger_state_updated_idx
  ON private.account_operation_ledger (state, updated_at DESC);
CREATE INDEX account_operation_ledger_target_user_idx
  ON private.account_operation_ledger (target_user_id)
  WHERE target_user_id IS NOT NULL;
CREATE UNIQUE INDEX account_operation_ledger_active_target_idx
  ON private.account_operation_ledger (operation_type, target_email)
  WHERE state IN ('started', 'invited', 'partial');
ALTER TABLE private.account_operation_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.account_operation_ledger FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE private.admin_audit_events (
  event_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  correlation_id uuid NOT NULL,
  operation_id uuid,
  actor_user_id uuid,
  actor_origin text NOT NULL CHECK (actor_origin IN ('human', 'ai_assistant', 'system')),
  initiating_admin_id uuid,
  authorizing_admin_id uuid,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 120),
  target_type text NOT NULL CHECK (length(target_type) BETWEEN 1 AND 80),
  target_id text CHECK (target_id IS NULL OR length(target_id) <= 200),
  result text NOT NULL CHECK (result IN ('started', 'success', 'failure', 'partial')),
  reason text CHECK (reason IS NULL OR length(reason) <= 500)
);
CREATE INDEX admin_audit_events_target_time_idx
  ON private.admin_audit_events (target_type, target_id, occurred_at DESC);
CREATE INDEX admin_audit_events_actor_time_idx
  ON private.admin_audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX admin_audit_events_correlation_idx
  ON private.admin_audit_events (correlation_id);
ALTER TABLE private.admin_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.admin_audit_events FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.reject_admin_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  RAISE EXCEPTION 'admin audit events are append-only' USING ERRCODE = '42501';
END;
$function$;
REVOKE ALL ON FUNCTION private.reject_admin_audit_mutation() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER admin_audit_events_append_only
  BEFORE UPDATE OR DELETE ON private.admin_audit_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_admin_audit_mutation();

CREATE FUNCTION private.append_admin_audit_event(
  p_correlation_id uuid,
  p_operation_id uuid,
  p_actor_user_id uuid,
  p_actor_origin text,
  p_initiating_admin_id uuid,
  p_authorizing_admin_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_result text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO private.admin_audit_events (
    correlation_id, operation_id, actor_user_id, actor_origin,
    initiating_admin_id, authorizing_admin_id, action, target_type,
    target_id, result, reason
  ) VALUES (
    p_correlation_id, p_operation_id, p_actor_user_id, p_actor_origin,
    p_initiating_admin_id, p_authorizing_admin_id, p_action, p_target_type,
    p_target_id, p_result, p_reason
  ) RETURNING event_id INTO v_event_id;
  RETURN v_event_id;
END;
$function$;
ALTER FUNCTION private.append_admin_audit_event(uuid, uuid, uuid, text, uuid, uuid, text, text, text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.append_admin_audit_event(uuid, uuid, uuid, text, uuid, uuid, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.is_account_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT COALESCE((
    SELECT aa.state = 'enabled'
    FROM public.account_access AS aa
    WHERE aa.user_id = (SELECT auth.uid())
  ), false)
$function$;
REVOKE ALL ON FUNCTION public.is_account_enabled() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_account_enabled() TO authenticated;

CREATE FUNCTION private.set_account_access_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := pg_catalog.now();
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    NEW.state_version := OLD.state_version + 1;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.set_account_access_updated_at() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER account_access_updated_at
  BEFORE UPDATE ON public.account_access
  FOR EACH ROW EXECUTE FUNCTION private.set_account_access_updated_at();

CREATE FUNCTION private.guard_last_enabled_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_loses_admin boolean := false;
  v_remaining bigint;
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'profiles' THEN
    v_user_id := OLD.id;
    v_loses_admin := (TG_OP = 'DELETE' AND OLD.role = 'admin')
      OR (TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role IS DISTINCT FROM 'admin');
  ELSIF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'account_access' THEN
    v_user_id := OLD.user_id;
    v_loses_admin := (TG_OP = 'DELETE' AND OLD.state = 'enabled')
      OR (TG_OP = 'UPDATE' AND OLD.state = 'enabled' AND NEW.state IS DISTINCT FROM 'enabled');
  ELSE
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF NOT v_loses_admin THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(7319042201::bigint);

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS p
    JOIN public.account_access AS aa ON aa.user_id = p.id
    WHERE p.id = v_user_id AND p.role = 'admin' AND aa.state = 'enabled'
  ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT pg_catalog.count(*) INTO v_remaining
  FROM public.profiles AS p
  JOIN public.account_access AS aa ON aa.user_id = p.id
  WHERE p.role = 'admin' AND aa.state = 'enabled' AND p.id <> v_user_id;

  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'No se puede deshabilitar, degradar ni eliminar al último Admin habilitado.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION private.guard_last_enabled_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.guard_last_enabled_admin() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER profiles_last_enabled_admin_guard
  BEFORE UPDATE OF role OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_last_enabled_admin();
CREATE TRIGGER account_access_last_enabled_admin_guard
  BEFORE UPDATE OF state OR DELETE ON public.account_access
  FOR EACH ROW EXECUTE FUNCTION private.guard_last_enabled_admin();

CREATE FUNCTION public.begin_client_invitation(
  p_actor_user_id uuid,
  p_target_email text,
  p_idempotency_key text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_operation private.account_operation_ledger%ROWTYPE;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'backend authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_actor_user_id IS NULL OR p_correlation_id IS NULL
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 32 AND 128
     OR p_target_email IS NULL OR length(pg_catalog.btrim(p_target_email)) NOT BETWEEN 3 AND 320
     OR p_target_email <> pg_catalog.lower(pg_catalog.btrim(p_target_email)) THEN
    RAISE EXCEPTION 'invalid invitation operation' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.account_access aa ON aa.user_id = p.id
    WHERE p.id = p_actor_user_id AND p.role = 'trainer' AND aa.state = 'enabled'
  ) THEN
    RAISE EXCEPTION 'trainer account is not enabled' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_user_id::text || ':' || p_target_email, 3)
  );
  SELECT * INTO v_operation
  FROM private.account_operation_ledger o
  WHERE o.actor_user_id = p_actor_user_id
    AND o.operation_type = 'client_invite'
    AND o.idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'operation_id', v_operation.operation_id,
      'target_user_id', v_operation.target_user_id,
      'state', v_operation.state,
      'replayed', true
    );
  END IF;
  IF EXISTS (
    SELECT 1 FROM private.account_operation_ledger o
    WHERE o.operation_type = 'client_invite'
      AND o.target_email = p_target_email
      AND o.state IN ('started', 'invited', 'partial')
  ) THEN
    RAISE EXCEPTION 'an invitation for this address requires reconciliation' USING ERRCODE = '23505';
  END IF;

  INSERT INTO private.account_operation_ledger (
    operation_type, idempotency_key, actor_user_id, target_email, state, correlation_id
  ) VALUES (
    'client_invite', p_idempotency_key, p_actor_user_id, p_target_email, 'started', p_correlation_id
  ) RETURNING * INTO v_operation;
  PERFORM private.append_admin_audit_event(
    p_correlation_id, v_operation.operation_id, p_actor_user_id, 'human', NULL, NULL,
    'client.invitation.started', 'client_invitation', NULL, 'started', 'trainer_invitation'
  );
  RETURN pg_catalog.jsonb_build_object(
    'operation_id', v_operation.operation_id,
    'state', v_operation.state,
    'replayed', false
  );
END;
$function$;
ALTER FUNCTION public.begin_client_invitation(uuid, text, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.begin_client_invitation(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_client_invitation(uuid, text, text, uuid) TO service_role;

CREATE FUNCTION public.finish_client_invitation(
  p_operation_id uuid,
  p_target_user_id uuid,
  p_state text,
  p_safe_error_code text,
  p_correlation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_operation private.account_operation_ledger%ROWTYPE;
  v_result text;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'backend authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_state NOT IN ('invited', 'failed', 'partial') OR p_correlation_id IS NULL
     OR (p_safe_error_code IS NOT NULL AND p_safe_error_code !~ '^[a-z0-9_:-]{1,80}$') THEN
    RAISE EXCEPTION 'invalid invitation result' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_operation FROM private.account_operation_ledger o
  WHERE o.operation_id = p_operation_id AND o.operation_type = 'client_invite' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation operation not found' USING ERRCODE = 'P0002'; END IF;

  IF v_operation.state = p_state AND v_operation.target_user_id IS NOT DISTINCT FROM p_target_user_id THEN
    RETURN pg_catalog.jsonb_build_object('operation_id', p_operation_id, 'state', p_state, 'replayed', true);
  END IF;
  IF v_operation.state <> 'started' THEN
    RAISE EXCEPTION 'invitation operation is already terminal' USING ERRCODE = '23514';
  END IF;
  IF p_state = 'invited' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.account_access aa ON aa.user_id = p.id
      WHERE p.id = v_operation.actor_user_id AND p.role = 'trainer' AND aa.state = 'enabled'
    ) THEN
      RAISE EXCEPTION 'trainer account is no longer enabled' USING ERRCODE = '42501';
    END IF;
    IF p_target_user_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM auth.users u
        JOIN public.profiles p ON p.id = u.id AND p.role = 'client'
        JOIN public.account_access aa ON aa.user_id = u.id AND aa.state = 'pending'
        JOIN public.clients c ON c.user_id = u.id
          AND c.trainer_id::text = v_operation.actor_user_id::text
          AND pg_catalog.lower(pg_catalog.btrim(c.email)) = v_operation.target_email
        WHERE u.id = p_target_user_id
          AND pg_catalog.lower(pg_catalog.btrim(u.email)) = v_operation.target_email
      ) THEN
      RAISE EXCEPTION 'invitation is not backed by a pending linked Client account' USING ERRCODE = '23514';
    END IF;
    v_result := 'success';
  ELSIF p_state = 'failed' THEN
    v_result := 'failure';
  ELSE
    v_result := 'partial';
  END IF;

  UPDATE private.account_operation_ledger
  SET state = p_state, target_user_id = p_target_user_id,
      safe_error_code = p_safe_error_code, updated_at = pg_catalog.now(), correlation_id = p_correlation_id
  WHERE operation_id = p_operation_id;
  PERFORM private.append_admin_audit_event(
    p_correlation_id, p_operation_id, v_operation.actor_user_id, 'human', NULL, NULL,
    'client.invitation.' || p_state, 'client_invitation', p_target_user_id::text,
    v_result, p_safe_error_code
  );
  RETURN pg_catalog.jsonb_build_object('operation_id', p_operation_id, 'state', p_state, 'replayed', false);
END;
$function$;
ALTER FUNCTION public.finish_client_invitation(uuid, uuid, text, text, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.finish_client_invitation(uuid, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_client_invitation(uuid, uuid, text, text, uuid) TO service_role;

CREATE FUNCTION public.activate_client_account(p_user_id uuid, p_correlation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_email text;
  v_confirmed_at timestamptz;
  v_access_state text;
  v_client_id text;
  v_status text;
  v_match_count bigint;
  v_existing_user_id uuid;
  v_operation_id uuid;
  v_updated_count bigint;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'backend authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_correlation_id IS NULL THEN
    RAISE EXCEPTION 'invalid activation request' USING ERRCODE = '22023';
  END IF;

  SELECT u.email, u.email_confirmed_at INTO v_email, v_confirmed_at
  FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL OR v_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'confirmed Client identity required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id AND p.role = 'client') THEN
    RAISE EXCEPTION 'Client role required' USING ERRCODE = '42501';
  END IF;
  SELECT aa.state INTO v_access_state FROM public.account_access aa
  WHERE aa.user_id = p_user_id FOR UPDATE;
  IF v_access_state IS NULL OR v_access_state = 'suspended' THEN
    RAISE EXCEPTION 'Client account is not eligible for activation' USING ERRCODE = '42501';
  END IF;

  -- Prevent a concurrent client-row insert from racing the exact-match count.
  LOCK TABLE public.clients IN SHARE MODE;
  SELECT pg_catalog.count(*) INTO v_match_count
  FROM public.clients c
  WHERE pg_catalog.lower(pg_catalog.btrim(c.email)) = pg_catalog.lower(pg_catalog.btrim(v_email));
  IF v_match_count <> 1 THEN
    RAISE EXCEPTION 'No unique matching Client relation' USING ERRCODE = '42501';
  END IF;
  SELECT c.id, c.user_id INTO v_client_id, v_existing_user_id
  FROM public.clients c
  WHERE pg_catalog.lower(pg_catalog.btrim(c.email)) = pg_catalog.lower(pg_catalog.btrim(v_email))
  FOR UPDATE;
  IF v_existing_user_id IS NOT NULL AND v_existing_user_id <> p_user_id THEN
    RAISE EXCEPTION 'No unique matching Client relation' USING ERRCODE = '42501';
  END IF;

  UPDATE public.clients c
  SET user_id = p_user_id, status = 'Activo', updated_at = pg_catalog.now()
  WHERE c.id = v_client_id
    AND pg_catalog.lower(pg_catalog.btrim(c.email)) = pg_catalog.lower(pg_catalog.btrim(v_email))
    AND (c.user_id IS NULL OR c.user_id = p_user_id)
  RETURNING c.status INTO v_status;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'Client relation changed during activation' USING ERRCODE = '40001';
  END IF;

  UPDATE public.account_access aa
  SET state = 'enabled', changed_by = p_user_id
  WHERE aa.user_id = p_user_id AND aa.state = 'pending';
  IF NOT EXISTS (
    SELECT 1 FROM public.account_access aa WHERE aa.user_id = p_user_id AND aa.state = 'enabled'
  ) THEN
    RAISE EXCEPTION 'Client access state could not be enabled' USING ERRCODE = '23514';
  END IF;

  SELECT o.operation_id INTO v_operation_id
  FROM private.account_operation_ledger o
  WHERE o.operation_type = 'client_invite' AND o.target_user_id = p_user_id
    AND o.state IN ('started', 'invited', 'partial')
  ORDER BY o.created_at DESC LIMIT 1 FOR UPDATE;
  IF v_operation_id IS NOT NULL THEN
    UPDATE private.account_operation_ledger
    SET state = 'accepted', updated_at = pg_catalog.now(), correlation_id = p_correlation_id
    WHERE operation_id = v_operation_id;
  END IF;

  PERFORM private.append_admin_audit_event(
    p_correlation_id, v_operation_id, p_user_id, 'human', NULL, NULL,
    'client.activation.completed', 'client', v_client_id, 'success', 'confirmed_invitation'
  );
  RETURN pg_catalog.jsonb_build_object('id', v_client_id, 'status', v_status);
END;
$function$;
ALTER FUNCTION public.activate_client_account(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.activate_client_account(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_client_account(uuid, uuid) TO service_role;

CREATE FUNCTION public.list_admin_audit_events(p_limit integer DEFAULT 50, p_before timestamptz DEFAULT NULL)
RETURNS TABLE (
  event_id uuid,
  occurred_at timestamptz,
  correlation_id uuid,
  operation_id uuid,
  actor_user_id uuid,
  actor_origin text,
  initiating_admin_id uuid,
  authorizing_admin_id uuid,
  action text,
  target_type text,
  target_id text,
  result text,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.account_access aa ON aa.user_id = p.id
    WHERE p.id = auth.uid() AND p.role = 'admin' AND aa.state = 'enabled'
  ) THEN
    RAISE EXCEPTION 'enabled Admin required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT e.event_id, e.occurred_at, e.correlation_id, e.operation_id,
    e.actor_user_id, e.actor_origin, e.initiating_admin_id, e.authorizing_admin_id,
    e.action, e.target_type, e.target_id, e.result, e.reason
  FROM private.admin_audit_events e
  WHERE p_before IS NULL OR e.occurred_at < p_before
  ORDER BY e.occurred_at DESC, e.event_id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
END;
$function$;
ALTER FUNCTION public.list_admin_audit_events(integer, timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.list_admin_audit_events(integer, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_admin_audit_events(integer, timestamptz) TO authenticated;

-- New Auth identities are always Clients and start with no operational access.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'client',
    COALESCE(NEW.created_at, pg_catalog.now()),
    pg_catalog.now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.account_access (user_id, state)
  VALUES (NEW.id, 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;

-- Fail closed on ambiguous or broken identity mappings; never hardcode user IDs.
DO $backfill$
DECLARE
  v_profiles bigint;
  v_access bigint;
  v_enabled_admins bigint;
BEGIN
  INSERT INTO public.account_access (user_id, state)
  SELECT p.id,
    CASE
      WHEN u.deleted_at IS NOT NULL OR (u.banned_until IS NOT NULL AND u.banned_until > pg_catalog.now()) THEN 'suspended'
      WHEN u.email_confirmed_at IS NULL THEN 'pending'
      WHEN p.role IN ('admin', 'trainer') THEN 'enabled'
      WHEN p.role = 'client' AND EXISTS (
        SELECT 1 FROM public.clients c WHERE c.user_id = p.id
      ) THEN 'enabled'
      ELSE 'pending'
    END
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ON CONFLICT (user_id) DO NOTHING;

  SELECT count(*) INTO v_profiles FROM public.profiles;
  SELECT count(*) INTO v_access FROM public.account_access;
  IF v_profiles <> v_access OR EXISTS (
    SELECT 1 FROM public.profiles p LEFT JOIN public.account_access aa ON aa.user_id = p.id
    WHERE aa.user_id IS NULL
  ) THEN
    RAISE EXCEPTION '3B backfill failed: profile/access row counts do not match.';
  END IF;

  SELECT count(*) INTO v_enabled_admins
  FROM public.profiles p JOIN public.account_access aa ON aa.user_id = p.id
  WHERE p.role = 'admin' AND aa.state = 'enabled';
  IF v_enabled_admins < 1 THEN
    RAISE EXCEPTION '3B backfill failed: no enabled Admin remains.';
  END IF;
END;
$backfill$;

-- Apply the access gate to each current policy without changing its ownership
-- expression, role list, or operation. account_access is deliberately excluded.
DO $gate_policies$
DECLARE
  v_policy record;
  v_using text;
  v_check text;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'clients', 'programs', 'nutrition_plans', 'trainer_profiles')
  LOOP
    v_using := CASE WHEN v_policy.qual IS NULL THEN NULL
      ELSE '(SELECT public.is_account_enabled()) AND (' || v_policy.qual || ')' END;
    v_check := CASE WHEN v_policy.with_check IS NULL THEN NULL
      ELSE '(SELECT public.is_account_enabled()) AND (' || v_policy.with_check || ')' END;

    IF v_policy.cmd IN ('SELECT', 'DELETE') THEN
      EXECUTE pg_catalog.format('ALTER POLICY %I ON %I.%I USING (%s)',
        v_policy.policyname, v_policy.schemaname, v_policy.tablename, v_using);
    ELSIF v_policy.cmd = 'INSERT' THEN
      EXECUTE pg_catalog.format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        v_policy.policyname, v_policy.schemaname, v_policy.tablename, v_check);
    ELSIF v_policy.cmd = 'UPDATE' THEN
      EXECUTE pg_catalog.format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
        v_policy.policyname, v_policy.schemaname, v_policy.tablename, v_using, v_check);
    ELSIF v_policy.cmd = 'ALL' THEN
      EXECUTE pg_catalog.format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
        v_policy.policyname, v_policy.schemaname, v_policy.tablename,
        COALESCE(v_using, '(SELECT public.is_account_enabled())'),
        COALESCE(v_check, '(SELECT public.is_account_enabled())'));
    ELSE
      RAISE EXCEPTION '3B cannot safely gate policy % on %.%',
        v_policy.policyname, v_policy.schemaname, v_policy.tablename;
    END IF;
  END LOOP;
END;
$gate_policies$;

-- Admin retains global profile reads, but direct table updates are self-only and
-- limited to approved presentation fields. Role changes remain backend-only.
ALTER POLICY profiles_update ON public.profiles
  USING ((id = (SELECT auth.uid())) AND (SELECT public.is_account_enabled()))
  WITH CHECK ((id = (SELECT auth.uid())) AND (SELECT public.is_account_enabled()));
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated, service_role;
REVOKE UPDATE (role) ON public.profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT UPDATE (full_name, phone, avatar_url, updated_at) ON public.profiles TO authenticated;
