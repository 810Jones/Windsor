import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    open: '/rethink/',
  },
  build: {
    // three.js alone is ~550 kB minified, which is expected.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        rethink: resolve(import.meta.dirname, 'rethink/index.html'),
      },
    },
  },
});
