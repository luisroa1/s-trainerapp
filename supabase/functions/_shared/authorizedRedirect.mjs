function normalizePathname(pathname) {
  if (pathname === '/') return '/';
  return pathname.replace(/\/+$/, '');
}

export function normalizeAuthorizedBaseUrl(configuredBaseUrl) {
  let baseUrl;
  try {
    baseUrl = new URL(configuredBaseUrl);
  } catch {
    throw new Error('APP_URL o SITE_URL debe ser una URL absoluta válida.');
  }

  const baseIsLoopback = ['localhost', '127.0.0.1'].includes(baseUrl.hostname);
  if (
    (baseUrl.protocol !== 'https:' && !(baseUrl.protocol === 'http:' && baseIsLoopback)) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error('APP_URL o SITE_URL debe ser un origen HTTPS y una ruta base sin credenciales, query ni fragmento.');
  }

  baseUrl.pathname = baseUrl.pathname.endsWith('/') ? baseUrl.pathname : `${baseUrl.pathname}/`;
  return baseUrl.toString();
}

export function resolveAuthorizedRedirect(configuredBaseUrl, requestedRedirectUrl) {
  const baseUrl = new URL(normalizeAuthorizedBaseUrl(configuredBaseUrl));
  const authorizedPath = normalizePathname(baseUrl.pathname);

  if (requestedRedirectUrl === undefined || requestedRedirectUrl === null || requestedRedirectUrl === '') {
    baseUrl.searchParams.set('flow', 'activate');
    return baseUrl.toString();
  }

  if (typeof requestedRedirectUrl !== 'string') {
    throw new Error('redirectTo debe ser una URL absoluta autorizada.');
  }

  let redirectUrl;
  try {
    redirectUrl = new URL(requestedRedirectUrl);
  } catch {
    throw new Error('redirectTo debe ser una URL absoluta autorizada.');
  }

  if (
    redirectUrl.origin !== baseUrl.origin ||
    normalizePathname(redirectUrl.pathname) !== authorizedPath ||
    redirectUrl.username ||
    redirectUrl.password ||
    redirectUrl.hash
  ) {
    throw new Error('redirectTo no coincide con el origen y la ruta base autorizados.');
  }

  return redirectUrl.toString();
}
