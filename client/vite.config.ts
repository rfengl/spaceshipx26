import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Express server (src/app.js) serves the static site from ../public and
// exposes the REST API under /api. We build straight into that folder so the
// existing backend serves the compiled React app with no extra wiring.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Proxy API calls to the Express backend during local development.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
