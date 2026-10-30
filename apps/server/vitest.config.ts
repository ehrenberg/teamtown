import swc from 'unplugin-swc';
import { defineProject } from 'vitest/config';

export default defineProject({
  // SWC emits the decorator metadata NestJS needs for dependency injection.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    // The integration suite starts PostgreSQL in a container.
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
