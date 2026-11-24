import { defineConfig } from 'vite';

const singleFile = !!process.env.SINGLE_FILE;

export default defineConfig({
  // Relative asset URLs so the build works at a domain root (Netlify/Vercel)
  // and under a sub-path (GitHub Pages project site) without reconfiguring.
  base: './',
  build: singleFile
    ? {
        // A single classic-script bundle can be inlined into one HTML file that
        // runs straight from file:// (ES modules would be blocked by CORS there).
        rollupOptions: { output: { format: 'iife' } },
      }
    : {},
});
