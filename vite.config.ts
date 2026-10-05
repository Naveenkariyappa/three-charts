import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildRegistry } from './scripts/registry.mjs';

/** Regenerates the copy-paste files (public/registry, public/r) when chart source changes. */
function chartRegistry(): Plugin {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    name: 'chart-registry',
    apply: 'serve', // `npm run build` runs the generator itself
    async buildStart() {
      await buildRegistry();
    },
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (!/src[\\/]core[\\/]|src[\\/]demo[\\/]examples\.ts$/.test(file)) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          buildRegistry({ quiet: true }).catch((e) => server.config.logger.error(`chart-registry: ${e.message}`));
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
