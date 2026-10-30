/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const SERVER_URL = process.env['TEAMTOWN_SERVER_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The lazily loaded world chunk is dominated by three.js (~900 kB minified); the UI shell stays small.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': SERVER_URL,
      '/realtime': { target: SERVER_URL, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
