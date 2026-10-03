export function buildAppCallbackUrl(origin, basePath, query = {}) {
  const normalizedOrigin = new URL(origin).origin;
  const callbackUrl = new URL(basePath || '/', normalizedOrigin);

  if (callbackUrl.origin !== normalizedOrigin) {
    throw new Error('La URL base de la aplicación debe permanecer en el mismo origen del frontend.');
  }

  if (!callbackUrl.pathname.endsWith('/')) {
    callbackUrl.pathname = `${callbackUrl.pathname}/`;
  }

  callbackUrl.search = new URLSearchParams(query).toString();
  callbackUrl.hash = '';
  return callbackUrl.toString();
}
