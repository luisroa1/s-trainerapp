export async function resolveInitialSession(loadSession, getAuthEventGeneration, handlers) {
  const initialGeneration = getAuthEventGeneration();
  const isCurrent = () => getAuthEventGeneration() === initialGeneration;

  try {
    const { data, error } = await loadSession();
    if (!isCurrent()) return { status: 'superseded' };
    if (error) throw error;

    const session = data?.session ?? null;
    if (session?.user) {
      await handlers.onSession(session, isCurrent);
    } else {
      await handlers.onNoSession(isCurrent);
    }
    if (!isCurrent()) return { status: 'superseded' };
    return { status: session?.user ? 'session' : 'empty' };
  } catch (error) {
    if (!isCurrent()) return { status: 'superseded' };
    await handlers.onError(error, isCurrent);
    return { status: 'error' };
  } finally {
    await handlers.onSettled();
  }
}
