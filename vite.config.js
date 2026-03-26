import { defineConfig } from 'vite';

export default defineConfig({
  root: './client-pixi',
  base: '/',
  build: {
    outDir: '../dist-client',
    emptyOutDir: true,
  },
  server: {
    port: 3333,
  },
});
