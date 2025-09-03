import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    target: 'es2015',
    minify: false,
    sourcemap: true,
  },
});
