export const STAGING_PROJECT_REF = 'qgppeyplrrgiedsvsvst';
export const PRODUCTION_PROJECT_REF = 'rfxyisqvrukslnlgzzek';

function jwtRole(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).role ?? null;
  } catch {
    return null;
  }
}

function validatePublishableKey(key) {
  if (!key || key.startsWith('REPLACE_WITH_')) {
    throw new Error('Configura VITE_SUPABASE_ANON_KEY con la clave publicable del entorno.');
  }
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
    throw new Error('Build cancelado: no se permite una clave Supabase secreta/service_role en el frontend.');
  }
  if (!key.startsWith('sb_publishable_') && jwtRole(key) !== 'anon') {
    throw new Error('Build cancelado: la clave Supabase debe ser publicable o una clave anon heredada.');
  }
}

/** Validates the same Supabase target policy used by the Vite build and browser client. */
export function validateSupabaseTarget({ appTarget, supabaseUrl, publishableKey }) {
  if (!['local', 'staging', 'production'].includes(appTarget || '')) {
    throw new Error('Falta VITE_APP_TARGET; debe ser local, staging o production.');
  }
  if (!supabaseUrl) {
    throw new Error('Falta VITE_SUPABASE_URL. S-TRAINER no iniciará Supabase sin configuración explícita.');
  }
  validatePublishableKey(publishableKey);

  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('VITE_SUPABASE_URL no es una URL válida.');
  }

  const isLoopback = ['localhost', '127.0.0.1'].includes(parsedUrl.hostname);
  if (parsedUrl.protocol !== 'https:' && !(appTarget === 'local' && parsedUrl.protocol === 'http:' && isLoopback)) {
    throw new Error('VITE_SUPABASE_URL debe usar HTTPS, salvo Supabase local en localhost.');
  }
  if (parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash) {
    throw new Error('VITE_SUPABASE_URL debe ser el origen del proyecto, sin path, query ni fragmento.');
  }

  const expectedProjectRef = appTarget === 'staging'
    ? STAGING_PROJECT_REF
    : appTarget === 'production'
      ? PRODUCTION_PROJECT_REF
      : null;

  if (expectedProjectRef && parsedUrl.hostname !== `${expectedProjectRef}.supabase.co`) {
    throw new Error(`Configuración ${appTarget} rechazada: solo se permite el proyecto Supabase aprobado ${expectedProjectRef}.`);
  }
  if (appTarget === 'local' && [STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF].includes(parsedUrl.hostname.split('.')[0])) {
    throw new Error('Configuración local rechazada: no puede apuntar a staging ni a producción.');
  }

  return {
    supabaseUrl: parsedUrl.origin,
    projectRef: expectedProjectRef ?? (parsedUrl.hostname.endsWith('.supabase.co')
      ? parsedUrl.hostname.slice(0, -'.supabase.co'.length)
      : null),
    publishableKey,
  };
}
