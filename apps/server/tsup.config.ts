import { defineConfig } from 'tsup';

export default defineConfig({
  // instrumentation.ts is loaded first with `node --import` (ADR-0019), so it is a separate entry.
  entry: ['src/main.ts', 'src/instrumentation.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  // Internal packages ship TypeScript source (ADR-0028), so they are bundled into the server.
  noExternal: [/^@teamtown\//],
});
