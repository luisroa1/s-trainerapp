export function getPasswordRecoveryLoginPath(currentUrl) {
  const loginUrl = new URL(currentUrl);
  if (loginUrl.searchParams.get('flow') === 'recovery') loginUrl.searchParams.delete('flow');
  loginUrl.searchParams.delete('code');
  loginUrl.hash = '';
  return `${loginUrl.pathname}${loginUrl.search}`;
}

export async function signOutRecoverySession(auth, redirectToLogin) {
  try {
    const { error } = await auth.signOut({ scope: 'local' });
    if (error) return { ok: false, error };

    redirectToLogin();
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function completePasswordRecovery(auth, password, redirectToLogin) {
  let updateResult;
  try {
    updateResult = await auth.updateUser({ password });
  } catch (error) {
    return { passwordUpdated: false, signedOut: false, error };
  }

  if (updateResult.error) {
    return { passwordUpdated: false, signedOut: false, error: updateResult.error };
  }

  const signOutResult = await signOutRecoverySession(auth, redirectToLogin);
  return {
    passwordUpdated: true,
    signedOut: signOutResult.ok,
    error: signOutResult.error,
  };
}
