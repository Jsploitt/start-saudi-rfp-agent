import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** The express backend. The operator UI never serves the document itself. */
const BACKEND = 'http://localhost:5173';

/**
 * Everything the express server owns, proxied through the dev server so the
 * app runs on one origin in development and in production alike.
 *
 * `/assets` matters most: the generated proposal hard-codes /assets/fonts/...
 * and /assets/logo-*.png, and those live in ../public/assets. See `assetsDir`
 * below for the other half of that story.
 */
const PROXIED = ['/api', '/runs', '/brand', '/assets', '/tokens.css', '/healthz'];

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': here('./src'),
      '@brand': here('../start-saudi-kit/brand'),
      '@contracts': here('../src/contracts.ts'),
      '@fixtures': here('../fixtures'),
    },
  },

  build: {
    /**
     * NOT the default 'assets'.
     *
     * The built app is served from the same root as ../public, and
     * ../public/assets holds the brand fonts and logos that the generated
     * proposal references by absolute path (/assets/fonts/plex-latin-400.woff2,
     * /assets/logo-horizontal-light.png, ...). If Vite also emitted its bundle
     * into /assets the two would collide on deploy and the proposal would lose
     * its typefaces and its lockup — in production only, where nobody is
     * watching the console. Emit to /app instead and the two never meet.
     */
    assetsDir: 'app',
    outDir: 'dist',
    sourcemap: true,
  },

  server: {
    port: 5174,
    strictPort: true,
    proxy: Object.fromEntries(
      PROXIED.map((path) => [
        path,
        {
          target: BACKEND,
          changeOrigin: false,
          /**
           * SSE survives this: the server already sends `X-Accel-Buffering: no`
           * and `Cache-Control: no-transform`, and http-proxy streams the
           * response body rather than buffering it, so /api/events arrives
           * event by event.
           */
          ws: false,
        },
      ])
    ),
    fs: {
      // tokens.css, contracts.ts and fixtures/cached-run.json all live above web/.
      allow: [here('..')],
    },
  },
});
