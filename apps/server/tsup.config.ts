import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  // Internal packages ship TypeScript source (ADR-0028), so they are bundled into the server.
  noExternal: [/^@teamtown\//],
});
