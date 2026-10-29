import { contextBridge } from 'electron';

/**
 * Minimal, typed bridge to the web client (implements the web app's `PlatformBridge` port, ADR-0005).
 * Never expose Node or Electron APIs directly.
 */
const versionArgument = process.argv.find((arg) => arg.startsWith('--teamtown-version='));

contextBridge.exposeInMainWorld('teamtown', {
  kind: 'desktop',
  appVersion: versionArgument?.split('=')[1] ?? null,
});
