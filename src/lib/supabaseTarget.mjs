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
  if (!key.startsWith('sb_publishable_') && jwtRole(key) !== 'anon') {
    throw new Error('La clave Supabase debe ser publicable o una clave anon heredada.');
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

  const isSupabaseProject = parsedUrl.hostname.endsWith('.supabase.co')
    && parsedUrl.hostname.split('.').length === 3
    && parsedUrl.hostname.split('.')[0].length > 0;

  if (appTarget === 'production' && parsedUrl.hostname !== `${PRODUCTION_PROJECT_REF}.supabase.co`) {
    throw new Error(`Configuración production rechazada: solo se permite el proyecto Supabase aprobado ${PRODUCTION_PROJECT_REF}.`);
  }
  if (appTarget === 'staging' && (!isSupabaseProject || parsedUrl.hostname === `${PRODUCTION_PROJECT_REF}.supabase.co`)) {
    throw new Error('Configuración staging rechazada: se requiere un proyecto Supabase dedicado distinto de producción.');
  }
  if (appTarget === 'local' && !isLoopback) {
    throw new Error('Configuración local rechazada: solo se permite Supabase local en localhost.');
  }

  return {
    supabaseUrl: parsedUrl.origin,
    projectRef: parsedUrl.hostname.endsWith('.supabase.co')
      ? parsedUrl.hostname.slice(0, -'.supabase.co'.length)
      : null,
    publishableKey,
  };
}
