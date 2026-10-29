import swc from 'unplugin-swc';
import { defineProject } from 'vitest/config';

export default defineProject({
  // SWC emits the decorator metadata NestJS needs for dependency injection.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
  },
});
