-- Block 3A: limit direct API EXECUTE grants without changing function bodies,
-- owners, search_path settings, trigger bindings, or any RLS policy.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enforce_client_program_ownership()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.enforce_client_structural_immutability()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.enforce_profile_role_immutability()
  FROM PUBLIC, anon, authenticated, service_role;
