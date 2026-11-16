import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    // CI builds with CDN_BASE set to the jsDelivr URL of the build's own files (.github/workflows/docker-image.yml),
    // so the server sends only index.html
    base: process.env.CDN_BASE || '/',
    // the Dockerfile serves build/ and gh-pages publishes it
    build: {outDir: 'build'},
    server: {port: 3000},
});
