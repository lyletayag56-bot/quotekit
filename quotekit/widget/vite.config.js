import { defineConfig } from 'vite';

// Builds src/main.js into ONE self-contained IIFE at ../dist/widget.js.
// The exports of main.js become the `window.QuoteKit` global (scan/mount),
// which the dashboard reuses for its live preview.
export default defineConfig({
  build: {
    outDir: '../dist',
    emptyOutDir: false,
    target: 'es2018',
    lib: {
      entry: 'src/main.js',
      name: 'QuoteKit',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
