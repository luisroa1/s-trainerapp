const VALID_PROFILE_ROLES = new Set(['client', 'trainer', 'admin']);

export function resolveProfileRole({ profile, error }) {
  if (error || !profile || !VALID_PROFILE_ROLES.has(profile.role)) return null;
  return profile.role;
}

export function resolveAppView({ recoveryRequested, activationRequested, hasUser, accessStatus, roleStatus, role }) {
  if (recoveryRequested && hasUser) return 'recovery';
  if (activationRequested) return 'activation';
  if (!hasUser) return 'auth';
  if (accessStatus === 'loading' || accessStatus === 'idle' || !accessStatus) return 'access-loading';
  if (accessStatus === 'pending') return 'access-pending';
  if (accessStatus === 'suspended') return 'access-suspended';
  if (accessStatus === 'error' || accessStatus !== 'enabled') return 'access-error';
  if (roleStatus === 'loading') return 'profile-loading';
  if (roleStatus === 'error' || roleStatus !== 'resolved' || !VALID_PROFILE_ROLES.has(role)) return 'profile-error';
  if (role === 'admin') return 'admin';
  if (role === 'trainer') return 'trainer';
  return 'client';
}
