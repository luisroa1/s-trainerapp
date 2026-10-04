-- Block 5E-RLS1: break the pre-existing clients -> programs -> clients RLS cycle.
-- The INSERT policy retains trainer identity/role checks; the existing trigger is
-- the sole validator of assigned_program_id ownership. The trigger remains INVOKER.
-- Re-runnable: the named policy is replaced and the trigger function is CREATE OR REPLACE.

DO $preflight$
DECLARE
  v_policy text;
  v_is_definer boolean;
  v_trigger_enabled "char";
  v_trainer_type text;
  v_program_type text;
BEGIN
  SELECT with_check INTO STRICT v_policy
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'clients'
    AND policyname = 'clients_insert'
    AND cmd = 'INSERT';

  IF position('role' IN v_policy) = 0
     OR position('trainer' IN v_policy) = 0
     OR position('auth.uid()' IN v_policy) = 0
     OR position('profiles' IN v_policy) = 0 THEN
    RAISE EXCEPTION 'Block 5E-RLS1 precondition failed: clients_insert lacks trainer role/ownership checks';
  END IF;

  SELECT p.prosecdef INTO STRICT v_is_definer
  FROM pg_proc AS p
  WHERE p.oid = 'public.enforce_client_program_ownership()'::regprocedure;

  IF v_is_definer THEN
    RAISE EXCEPTION 'Block 5E-RLS1 precondition failed: ownership trigger must remain INVOKER';
  END IF;

  SELECT t.tgenabled INTO STRICT v_trigger_enabled
  FROM pg_trigger AS t
  WHERE t.tgrelid = 'public.clients'::regclass
    AND t.tgname = 'trg_clients_program_ownership'
    AND NOT t.tgisinternal;

  IF v_trigger_enabled = 'D' THEN
    RAISE EXCEPTION 'Block 5E-RLS1 precondition failed: ownership trigger is disabled';
  END IF;

  SELECT data_type INTO STRICT v_trainer_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'trainer_id';
  SELECT data_type INTO STRICT v_program_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'trainer_id';

  IF v_trainer_type <> 'text' OR v_program_type <> 'text' THEN
    RAISE EXCEPTION 'Block 5E-RLS1 precondition failed: expected text ownership columns';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.enforce_client_program_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.assigned_program_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR (
         TG_OP = 'UPDATE'
         AND (
           NEW.assigned_program_id IS DISTINCT FROM OLD.assigned_program_id
           OR NEW.trainer_id IS DISTINCT FROM OLD.trainer_id
         )
       )
     ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.programs AS pr
      WHERE pr.id = NEW.assigned_program_id
        AND pr.trainer_id = NEW.trainer_id
    ) THEN
      RAISE EXCEPTION 'No autorizado: programa inválido para el entrenador'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      trainer_id = (auth.uid())::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
    )
  );
