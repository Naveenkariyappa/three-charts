import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildRegistry } from './scripts/registry.mjs';

/** The plain-HTML pages (public/html, public/vanilla.html), built from the examples. */
const buildHtmlPages = () => promisify(execFile)(process.execPath, ['scripts/html-pages.mjs']);

/** Regenerates the copy-paste files (public/registry, public/r) and plain-HTML pages when chart source or examples change. */
function chartRegistry(): Plugin {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    name: 'chart-registry',
    apply: 'serve', // `npm run build` runs the generator itself
    async buildStart() {
      await buildRegistry();
      await buildHtmlPages();
    },
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (!/src[\\/]core[\\/]|src[\\/]demo[\\/]examples2?\.ts$/.test(file)) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          buildRegistry({ quiet: true })
            .then(buildHtmlPages)
            .catch((e) => server.config.logger.error(`chart-registry: ${e.message}`));
        }, 300);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), chartRegistry()],
  build: {
    // The gallery shows every chart at once, so three.js (~600 kB), React and all
    // 91 charts load together on purpose (~1.15 MB, ~320 kB gzip).
    chunkSizeWarningLimit: 1300,
  },
});
