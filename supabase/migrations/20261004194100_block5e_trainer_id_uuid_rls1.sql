-- Block 5E on top of canonical RLS1: normalize Trainer ownership to profile UUIDs.
-- RLS1 clients_insert is preserved semantically (no programs subquery), and its
-- INVOKER trigger remains the sole validator of assigned_program_id ownership.
-- Safe to rerun after successful conversion; all data checks fail closed.

DO $preflight$
DECLARE
  v_table text;
  v_type text;
  v_invalid bigint;
  v_insert_check text;
  v_function_def text;
  v_function_owner text;
  v_function_acl aclitem[];
  v_function_config text[];
  v_is_definer boolean;
  v_trigger_enabled "char";
BEGIN
  -- Do not silently remove the legacy profile if any ownership rows still use it.
  IF EXISTS (SELECT 1 FROM public.trainer_profiles WHERE id = 'trn-1') THEN
    IF EXISTS (SELECT 1 FROM public.clients WHERE trainer_id = 'trn-1')
       OR EXISTS (SELECT 1 FROM public.programs WHERE trainer_id = 'trn-1')
       OR EXISTS (SELECT 1 FROM public.nutrition_plans WHERE trainer_id = 'trn-1')
       OR EXISTS (SELECT 1 FROM public.profiles WHERE id::text = 'trn-1')
       OR EXISTS (SELECT 1 FROM auth.users WHERE id::text = 'trn-1')
       OR EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE contype = 'f' AND confrelid = 'public.trainer_profiles'::regclass
       ) THEN
      RAISE EXCEPTION 'Bloque 5E: trainer_profiles.trn-1 ya no está huérfano; no se elimina.';
    END IF;
    DELETE FROM public.trainer_profiles WHERE id = 'trn-1';
  END IF;

  -- This migration must start from the already-approved RLS1 state.
  SELECT with_check INTO STRICT v_insert_check
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'clients'
    AND policyname = 'clients_insert' AND cmd = 'INSERT';
  IF position('programs' IN lower(v_insert_check)) > 0
     OR position('profiles' IN lower(v_insert_check)) = 0
     OR position('role' IN lower(v_insert_check)) = 0
     OR position('trainer' IN lower(v_insert_check)) = 0
     OR position('auth.uid()' IN lower(v_insert_check)) = 0 THEN
    RAISE EXCEPTION 'Bloque 5E: clients_insert no coincide con la policy no recursiva de RLS1.';
  END IF;

  SELECT p.prosecdef, p.proconfig, p.proacl, pg_get_userbyid(p.proowner), pg_get_functiondef(p.oid)
    INTO STRICT v_is_definer, v_function_config, v_function_acl, v_function_owner, v_function_def
  FROM pg_proc AS p
  WHERE p.oid = 'public.enforce_client_program_ownership()'::regprocedure;
  SELECT t.tgenabled INTO STRICT v_trigger_enabled
  FROM pg_trigger AS t
  WHERE t.tgrelid = 'public.clients'::regclass
    AND t.tgname = 'trg_clients_program_ownership' AND NOT t.tgisinternal;

  IF v_is_definer
     OR v_function_owner <> 'postgres'
     OR v_function_config <> ARRAY['search_path=public, pg_temp']::text[]
     OR v_function_acl::text <> '{postgres=X/postgres}'
     OR v_trigger_enabled = 'D'
     OR position('new.trainer_id is distinct from old.trainer_id' IN lower(v_function_def)) = 0
     OR position('if not public.is_admin()' IN lower(v_function_def)) > 0 THEN
    RAISE EXCEPTION 'Bloque 5E: el trigger de ownership no conserva el estado RLS1 INVOKER validado.';
  END IF;

  -- Every current owner must be a real Trainer profile before conversion.
  FOREACH v_table IN ARRAY ARRAY['clients', 'programs', 'nutrition_plans'] LOOP
    SELECT data_type INTO v_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'trainer_id';

    IF v_type = 'text' THEN
      EXECUTE format($sql$
        SELECT count(*)
        FROM public.%I AS row_data
        WHERE row_data.trainer_id IS NULL
           OR CASE
                WHEN row_data.trainer_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN NOT EXISTS (
                  SELECT 1 FROM public.profiles AS profile
                  WHERE profile.id = row_data.trainer_id::uuid
                    AND profile.role = 'trainer'
                )
                ELSE true
              END
      $sql$, v_table) INTO v_invalid;
    ELSIF v_type = 'uuid' THEN
      EXECUTE format($sql$
        SELECT count(*)
        FROM public.%I AS row_data
        WHERE row_data.trainer_id IS NULL
           OR NOT EXISTS (
                SELECT 1 FROM public.profiles AS profile
                WHERE profile.id = row_data.trainer_id
                  AND profile.role = 'trainer'
              )
      $sql$, v_table) INTO v_invalid;
    ELSE
      RAISE EXCEPTION 'Bloque 5E: tipo inesperado para %.trainer_id: %', v_table, coalesce(v_type, '(ausente)');
    END IF;

    IF v_invalid > 0 THEN
      RAISE EXCEPTION 'Bloque 5E: % fila(s) de %.trainer_id no tienen propietario Trainer UUID válido.', v_invalid, v_table;
    END IF;
  END LOOP;

  -- Fail closed if the active policy set differs from the audited 12 policies.
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('clients', 'programs', 'nutrition_plans')) <> 12
     OR EXISTS (
       SELECT 1 FROM (VALUES
         ('clients', 'clients_select'), ('clients', 'clients_insert'),
         ('clients', 'clients_update'), ('clients', 'clients_delete'),
         ('programs', 'programs_select'), ('programs', 'programs_insert'),
         ('programs', 'programs_update'), ('programs', 'programs_delete'),
         ('nutrition_plans', 'nutrition_select'), ('nutrition_plans', 'nutrition_insert'),
         ('nutrition_plans', 'nutrition_update'), ('nutrition_plans', 'nutrition_delete')
       ) AS expected(tablename, policyname)
       WHERE NOT EXISTS (
         SELECT 1 FROM pg_policies actual
         WHERE actual.schemaname = 'public'
           AND actual.tablename = expected.tablename
           AND actual.policyname = expected.policyname
       )
     ) THEN
    RAISE EXCEPTION 'Bloque 5E: el conjunto de policies no coincide con las 12 policies auditadas.';
  END IF;
END;
$preflight$;

-- These policies depend on text equality. Recreate the audited set atomically
-- after the ownership columns become UUID; unrelated policies are untouched.
DROP POLICY IF EXISTS clients_select ON public.clients;
DROP POLICY IF EXISTS clients_insert ON public.clients;
DROP POLICY IF EXISTS clients_update ON public.clients;
DROP POLICY IF EXISTS clients_delete ON public.clients;
DROP POLICY IF EXISTS programs_select ON public.programs;
DROP POLICY IF EXISTS programs_insert ON public.programs;
DROP POLICY IF EXISTS programs_update ON public.programs;
DROP POLICY IF EXISTS programs_delete ON public.programs;
DROP POLICY IF EXISTS nutrition_select ON public.nutrition_plans;
DROP POLICY IF EXISTS nutrition_insert ON public.nutrition_plans;
DROP POLICY IF EXISTS nutrition_update ON public.nutrition_plans;
DROP POLICY IF EXISTS nutrition_delete ON public.nutrition_plans;

DO $convert$
DECLARE
  v_table text;
  v_type text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['clients', 'programs', 'nutrition_plans'] LOOP
    SELECT data_type INTO v_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'trainer_id';

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN trainer_id DROP DEFAULT', v_table);
    IF v_type = 'text' THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN trainer_id TYPE uuid USING trainer_id::uuid', v_table);
    ELSIF v_type <> 'uuid' THEN
      RAISE EXCEPTION 'Bloque 5E: tipo inesperado para %.trainer_id: %', v_table, coalesce(v_type, '(ausente)');
    END IF;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN trainer_id SET NOT NULL', v_table);
  END LOOP;
END;
$convert$;

-- RLS1 validation remains INVOKER and unchanged in behavior; replacing the
-- function after the type change refreshes its cached query plan for UUID.
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

-- This guard reads NEW.trainer_id too, so refresh its row-field plan after the
-- clients composite row changes from text to UUID. Its authorization is intact.
CREATE OR REPLACE FUNCTION public.enforce_client_structural_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF (NEW.trainer_id IS DISTINCT FROM OLD.trainer_id)
     OR (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    IF NOT (public.is_admin() OR current_user = 'service_role') THEN
      RAISE EXCEPTION 'No autorizado: trainer_id y user_id son columnas estructurales; solo un administrador o el backend (service_role) pueden modificarlas';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DO $foreign_keys$
DECLARE
  v_table text;
  v_constraint text;
  v_existing_definition text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['clients', 'programs', 'nutrition_plans'] LOOP
    v_constraint := v_table || '_trainer_id_fkey';
    SELECT pg_get_constraintdef(oid) INTO v_existing_definition
    FROM pg_constraint
    WHERE conrelid = format('public.%I', v_table)::regclass
      AND conname = v_constraint;

    IF v_existing_definition IS NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (trainer_id) REFERENCES public.profiles(id) ON DELETE RESTRICT',
        v_table, v_constraint
      );
    ELSIF v_existing_definition <> 'FOREIGN KEY (trainer_id) REFERENCES profiles(id) ON DELETE RESTRICT' THEN
      RAISE EXCEPTION 'Bloque 5E: la constraint % ya existe con definición inesperada: %', v_constraint, v_existing_definition;
    END IF;
  END LOOP;
END;
$foreign_keys$;

CREATE POLICY clients_select ON public.clients
  FOR SELECT TO authenticated
  USING (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR user_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY clients_insert ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      trainer_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer')
    )
  );

CREATE POLICY clients_update ON public.clients
  FOR UPDATE TO authenticated
  USING (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR user_id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR user_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY clients_delete ON public.clients
  FOR DELETE TO authenticated
  USING (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR public.is_admin()
  );

CREATE POLICY programs_select ON public.programs
  FOR SELECT TO authenticated
  USING (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id = auth.uid() AND c.assigned_program_id = programs.id
    )
  );

CREATE POLICY programs_insert ON public.programs
  FOR INSERT TO authenticated
  WITH CHECK (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR public.is_admin()
  );

CREATE POLICY programs_update ON public.programs
  FOR UPDATE TO authenticated
  USING (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR public.is_admin()
  )
  WITH CHECK (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR public.is_admin()
  );

CREATE POLICY programs_delete ON public.programs
  FOR DELETE TO authenticated
  USING (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR public.is_admin()
  );

CREATE POLICY nutrition_select ON public.nutrition_plans
  FOR SELECT TO authenticated
  USING (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id = auth.uid() AND c.id = nutrition_plans.client_id
    )
  );

CREATE POLICY nutrition_insert ON public.nutrition_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      trainer_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer')
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = nutrition_plans.client_id AND c.trainer_id = auth.uid()
      )
    )
    OR public.is_admin()
  );

CREATE POLICY nutrition_update ON public.nutrition_plans
  FOR UPDATE TO authenticated
  USING (
    (
      trainer_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer')
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = nutrition_plans.client_id AND c.trainer_id = auth.uid()
      )
    )
    OR public.is_admin()
  )
  WITH CHECK (
    (
      trainer_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer')
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = nutrition_plans.client_id AND c.trainer_id = auth.uid()
      )
    )
    OR public.is_admin()
  );

CREATE POLICY nutrition_delete ON public.nutrition_plans
  FOR DELETE TO authenticated
  USING (
    (trainer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'trainer'
    ))
    OR public.is_admin()
  );
