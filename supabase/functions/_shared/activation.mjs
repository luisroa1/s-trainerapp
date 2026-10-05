export function resolveActivationPrincipal({ user, profile, profileError, access, accessError }) {
  if (!user?.id) return { ok: false, status: 401, reason: 'invalid_session' };
  if (profileError || accessError) return { ok: false, status: 500, reason: 'identity_state_unavailable' };
  if (!profile || profile.id !== user.id || profile.role !== 'client') {
    return { ok: false, status: 403, reason: 'client_role_required' };
  }
  if (!access || !['pending', 'enabled'].includes(access.state)) {
    return { ok: false, status: 403, reason: 'account_not_eligible' };
  }
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!email || !user.email_confirmed_at) return { ok: false, status: 403, reason: 'confirmed_email_required' };
  return { ok: true, userId: user.id, email };
}
