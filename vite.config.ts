import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
    return {
          // Required for GitHub Pages project sites (served from /s-trainerapp/,
          // not from the domain root). Leave as '/' if this is ever deployed to
          // its own domain or to a Pages "user/organization site" instead.
          base: process.env.GITHUB_PAGES === 'true' ? '/s-trainerapp/' : '/',
          plugins: [react(), tailwindcss()],
          resolve: {
                  alias: {
                            '@': path.resolve(__dirname, '.'),
                  },
          },
          server: {
                  // HMR is disabled in AI Studio via DISABLE_HMR env var.
            // Do not modify—file watching is disabled to prevent flickering during agent edits.
            hmr: process.env.DISABLE_HMR !== 'true',
                  // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
                  watch: process.env.DISABLE_HMR === 'true' ? null : {},
          },
    };
});
