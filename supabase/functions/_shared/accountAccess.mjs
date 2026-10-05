export function resolveActorRole({ user, profile, profileError, expectedRole }) {
  if (!user?.id) return { ok: false, status: 401, reason: 'invalid_session' };
  if (profileError) return { ok: false, status: 500, reason: 'profile_unavailable' };
  if (!profile || profile.id !== user.id || profile.role !== expectedRole) {
    return { ok: false, status: 403, reason: 'role_not_authorized' };
  }
  return { ok: true };
}

export function resolveActorAccess({ access, accessError, allowedStates = ['enabled'] }) {
  if (accessError) return { ok: false, status: 500, reason: 'access_state_unavailable' };
  if (!access || !allowedStates.includes(access.state)) {
    return { ok: false, status: 403, reason: 'account_not_enabled' };
  }
  return { ok: true };
}
