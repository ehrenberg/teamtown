import { defineConfig } from 'tsup';

export default defineConfig({
  // Electron's sandboxed preload must be CommonJS; the main process uses the same format for simplicity.
  entry: ['src/main.ts', 'src/preload.ts'],
  format: ['cjs'],
  outExtension: () => ({ js: '.cjs' }),
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  external: ['electron'],
});
