import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    // the Dockerfile serves build/ and gh-pages publishes it
    build: {outDir: 'build'},
    server: {port: 3000},
});
