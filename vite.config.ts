import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {validateSupabaseTarget} from './src/lib/supabaseTarget.mjs';

export default defineConfig(({ mode }) => {
    const fileEnv = loadEnv(mode, process.cwd(), '');
    const getEnv = (name: string) => process.env[name] || fileEnv[name];
    const appTarget = getEnv('VITE_APP_TARGET')?.trim();
    const supabaseUrl = getEnv('VITE_SUPABASE_URL')?.trim();
    const publishableKey = getEnv('VITE_SUPABASE_ANON_KEY')?.trim();

    validateSupabaseTarget({appTarget, supabaseUrl, publishableKey});

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
