import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

const STAGING_PROJECT_REF = 'qgppeyplrrgiedsvsvst';

export default defineConfig(({ mode }) => {
    const fileEnv = loadEnv(mode, process.cwd(), '');
    const getEnv = (name: string) => process.env[name] || fileEnv[name];
    const appTarget = getEnv('VITE_APP_TARGET')?.trim();
    const supabaseUrl = getEnv('VITE_SUPABASE_URL')?.trim();
    const publishableKey = getEnv('VITE_SUPABASE_ANON_KEY')?.trim();

    if (!['local', 'staging', 'production'].includes(appTarget || '')) {
        throw new Error('Falta VITE_APP_TARGET; debe ser local, staging o production.');
    }
    if (appTarget === 'production') {
        throw new Error('Build cancelado: el target production requiere aprobar y fijar antes una URL Supabase permitida.');
    }
    if (!supabaseUrl || !publishableKey || publishableKey.startsWith('REPLACE_WITH_')) {
        throw new Error('Build cancelado: configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY explícitamente.');
    }

    let parsedSupabaseUrl: URL;
    try {
        parsedSupabaseUrl = new URL(supabaseUrl);
    } catch {
        throw new Error('Build cancelado: VITE_SUPABASE_URL no es una URL válida.');
    }
    if (appTarget === 'staging' && parsedSupabaseUrl.hostname !== `${STAGING_PROJECT_REF}.supabase.co`) {
        throw new Error(`Build cancelado: staging solo puede usar ${STAGING_PROJECT_REF}.supabase.co.`);
    }
    if (parsedSupabaseUrl.pathname !== '/' || parsedSupabaseUrl.search || parsedSupabaseUrl.hash) {
        throw new Error('Build cancelado: VITE_SUPABASE_URL debe ser el origen del proyecto, sin path/query/hash.');
    }

    const requestedBasePath = getEnv('VITE_BASE_PATH')?.trim();
    const basePath = requestedBasePath || (process.env.GITHUB_PAGES === 'true' ? '/s-trainerapp/' : '/');
    if (!basePath.startsWith('/') || !basePath.endsWith('/')) {
        throw new Error('VITE_BASE_PATH debe empezar y terminar con "/" (por ejemplo "/s-trainerapp/" o "/").');
    }

    const disableHmr = getEnv('DISABLE_HMR') === 'true';
    return {
          // Configure /s-trainerapp/ for a GitHub Pages project site or / for a root host.
          base: basePath,
          plugins: [react(), tailwindcss()],
          resolve: {
                  alias: {
                            '@': path.resolve(__dirname, '.'),
                  },
          },
          server: {
            // Optional development-only switch for constrained editor environments.
            hmr: !disableHmr,
            watch: disableHmr ? null : {},
          },
    };
});
