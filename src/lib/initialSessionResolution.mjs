export async function resolveInitialSession(loadSession, handlers) {
  try {
    const { data, error } = await loadSession();
    if (error) throw error;

    const session = data?.session ?? null;
    if (session?.user) {
      await handlers.onSession(session);
    } else {
      await handlers.onNoSession();
    }
    return { status: session?.user ? 'session' : 'empty' };
  } catch (error) {
    await handlers.onError(error);
    return { status: 'error' };
  } finally {
    await handlers.onSettled();
  }
}
