/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const SERVER_URL = process.env['TEAMTOWN_SERVER_URL'] ?? 'http://localhost:3000';

/** Emoji data for the reaction picker, served from our own origin, never from a CDN (ADR-0034). */
const EMOJIBASE_DIR = dirname(createRequire(import.meta.url).resolve('emojibase-data/package.json'));
const EMOJIBASE_FILES = ['en/data.json', 'en/messages.json', 'de/data.json', 'de/messages.json'];

function selfHostedEmojiData(): Plugin {
  return {
    name: 'teamtown-emojibase',
    configureServer(server) {
      server.middlewares.use('/emojibase', (request, response, next) => {
        const file = request.url?.slice(1) ?? '';
        if (!EMOJIBASE_FILES.includes(file)) {
          next();
          return;
        }
        response.setHeader('content-type', 'application/json');
        response.end(readFileSync(join(EMOJIBASE_DIR, file)));
      });
    },
    generateBundle() {
      for (const file of EMOJIBASE_FILES) {
        this.emitFile({
          type: 'asset',
          fileName: `emojibase/${file}`,
          source: readFileSync(join(EMOJIBASE_DIR, file)),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), selfHostedEmojiData()],
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
