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
    // Proxy API calls (and the resource WebSocket) to the Express backend
    // during local development.
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
