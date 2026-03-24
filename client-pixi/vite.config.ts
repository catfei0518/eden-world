import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    build: {
        outDir: '../dist-client',
        emptyOutDir: true,
        rollupOptions: {
            input: './index.html',
        },
    },
    server: {
        port: 3335,
        proxy: {
            '/api': 'http://localhost:3333',
            '/ws': {
                target: 'ws://localhost:3333',
                ws: true,
            }
        }
    }
});
