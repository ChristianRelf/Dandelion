import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/**
 * Shared module aliases. These must be kept in sync with the `paths` entry in
 * `tsconfig.base.json` so that the TypeScript language server and the bundler
 * resolve imports identically.
 */
const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@main': resolve(__dirname, 'src/main'),
  '@preload': resolve(__dirname, 'src/preload'),
  '@renderer': resolve(__dirname, 'src/renderer'),
  '@': resolve(__dirname, 'src/renderer'),
};

/** The token `src/renderer/index.html` carries in place of a literal policy. */
const CSP_TOKEN = '__DANDELION_CSP__';

/**
 * The chrome's Content-Security-Policy, built for one mode.
 *
 * Dev needs `'unsafe-inline'` and `'unsafe-eval'` in `script-src`: Vite serves
 * the renderer from its dev server and injects the HMR client inline. The
 * production bundle is static and needs neither — dropping them there is the
 * entire point of splitting this.
 *
 * It has to be resolved at build time. The chrome is served over `file://` via
 * `loadFile`, where `webRequest` header injection never fires, so the meta tag
 * is the only place a policy can be enforced and nothing can intersect it at
 * runtime.
 *
 * `img-src` allows **no remote origin**. Every remote image the chrome shows —
 * favicons and the reader's inline images — goes through `dandelion-media:`,
 * which main resolves in the owning profile's session. Fetching one directly
 * would land it in the default session: a persistent jar shared by every
 * profile, private ones included, with none of the privacy engine's filters
 * attached. Leaving `https:` here would leave that door open regardless of what
 * the components do, so the policy is what makes the routing enforced rather
 * than merely intended.
 */
export function chromeCsp(dev: boolean): string {
  const scriptSrc = dev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'";
  return (
    [
      "default-src 'self'",
      "img-src 'self' data: blob: dandelion-media:",
      "style-src 'self' 'unsafe-inline'",
      `script-src ${scriptSrc}`,
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: http: https:",
    ].join('; ') + ';'
  );
}

/** Swaps {@link CSP_TOKEN} for the policy this build's mode gets. */
function chromeCspPlugin(): Plugin {
  let dev = false;
  return {
    name: 'dandelion-chrome-csp',
    configResolved(config) {
      dev = config.command === 'serve';
    },
    transformIndexHtml(html) {
      return html.replace(CSP_TOKEN, chromeCsp(dev));
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      outDir: 'out/main',
      minify: false,
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    // Preload runs in a sandboxed context and must be emitted as CommonJS.
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      outDir: 'out/preload',
      sourcemap: 'inline',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    resolve: { alias },
    plugins: [react(), tailwindcss(), chromeCspPlugin()],
    build: {
      outDir: 'out/renderer',
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
    server: {
      // Deterministic dev port so the main process can load the renderer URL.
      port: 5273,
      strictPort: true,
    },
  },
});
