import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the build works at a domain root (Netlify/Vercel)
  // and under a sub-path (GitHub Pages project site) without reconfiguring.
  base: './',
});
