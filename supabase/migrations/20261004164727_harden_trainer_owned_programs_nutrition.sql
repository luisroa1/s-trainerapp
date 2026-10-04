-- Restrict trainer-owned programs and nutrition plans to users whose trusted
-- public.profiles.role is trainer. Admin access remains governed by is_admin().
-- Client read branches remain unchanged. No structural constraints or triggers.

ALTER POLICY programs_select ON public.programs
  USING (
    (
      trainer_id = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
    )
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.user_id = auth.uid()
        AND c.assigned_program_id = programs.id
    )
  );

ALTER POLICY programs_insert ON public.programs
  WITH CHECK (
    (
      trainer_id = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
    )
    OR public.is_admin()
  );

ALTER POLICY programs_update ON public.programs
  USING (
    (
      trainer_id = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
    )
    OR public.is_admin()
  )
  WITH CHECK (
    (
      trainer_id = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
    )
    OR public.is_admin()
  );

ALTER POLICY programs_delete ON public.programs
  USING (
    (
      trainer_id = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
    )
    OR public.is_admin()
  );

ALTER POLICY nutrition_select ON public.nutrition_plans
  USING (
    (
      trainer_id = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
    )
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.user_id = auth.uid()
        AND c.id = nutrition_plans.client_id
    )
  );

ALTER POLICY nutrition_insert ON public.nutrition_plans
  WITH CHECK (
    (
      trainer_id = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
      AND EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = nutrition_plans.client_id
          AND c.trainer_id = auth.uid()::text
      )
    )
    OR public.is_admin()
  );

ALTER POLICY nutrition_update ON public.nutrition_plans
  USING (
    (
      trainer_id = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
      AND EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = nutrition_plans.client_id
          AND c.trainer_id = auth.uid()::text
      )
    )
    OR public.is_admin()
  )
  WITH CHECK (
    (
      trainer_id = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
      AND EXISTS (
        SELECT 1
        FROM public.clients c
        WHERE c.id = nutrition_plans.client_id
          AND c.trainer_id = auth.uid()::text
      )
    )
    OR public.is_admin()
  );

ALTER POLICY nutrition_delete ON public.nutrition_plans
  USING (
    (
      trainer_id = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'trainer'
      )
    )
    OR public.is_admin()
  );
