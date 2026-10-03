export function isPasswordRecoveryRoute({ search = '', hash = '' } = {}) {
  const params = new URLSearchParams(search);
  return params.has('code') || params.get('flow') === 'recovery' || hash.includes('type=recovery');
}
