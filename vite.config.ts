import { defineConfig } from 'vite';

export default defineConfig({
  // Relative URLs support both a domain root and /repository/ on GitHub Pages.
  base: './',
  worker: { format: 'es' },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
});
