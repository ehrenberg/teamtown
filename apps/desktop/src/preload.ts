import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DesktopSession } from './auth/desktop-auth-session.ts';
import { IpcChannel } from './ipc-channels.ts';

/**
 * Minimal, typed bridge to the web client (implements the web app's `PlatformBridge` port, ADR-0005).
 * Never expose Node or Electron APIs directly.
 */
const versionArgument = process.argv.find((arg) => arg.startsWith('--teamtown-version='));

contextBridge.exposeInMainWorld('teamtown', {
  kind: 'desktop',
  appVersion: versionArgument?.split('=')[1] ?? null,
  // Login runs in the main process (ADR-0023); the UI only receives short-lived access tokens.
  auth: {
    getSession: (): Promise<DesktopSession | null> => ipcRenderer.invoke(IpcChannel.getSession),
    signIn: (): Promise<void> => ipcRenderer.invoke(IpcChannel.signIn),
    signOut: (): Promise<void> => ipcRenderer.invoke(IpcChannel.signOut),
    onSessionChanged: (listener: (session: DesktopSession | null) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, session: DesktopSession | null) => {
        listener(session);
      };
      ipcRenderer.on(IpcChannel.sessionChanged, handler);
      return () => {
        ipcRenderer.removeListener(IpcChannel.sessionChanged, handler);
      };
    },
  },
});
