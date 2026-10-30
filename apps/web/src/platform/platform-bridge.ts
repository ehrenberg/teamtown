import type { AuthSession, SessionListener } from '../auth/auth-client.ts';

/** Authentication handled by the desktop app's main process; the UI only sees short-lived access tokens. */
export interface DesktopAuthBridge {
  getSession(): Promise<AuthSession | null>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  onSessionChanged(listener: SessionListener): () => void;
}

/**
 * Port for native capabilities (ADR-0005). The web implementation uses browser APIs;
 * the desktop app injects its implementation via the Electron preload as `window.teamtown`.
 */
export interface PlatformBridge {
  readonly kind: 'web' | 'desktop';
  readonly appVersion: string | null;
  readonly auth?: DesktopAuthBridge;
}

declare global {
  interface Window {
    readonly teamtown?: PlatformBridge;
  }
}

const webBridge: PlatformBridge = { kind: 'web', appVersion: null };

export const getPlatformBridge = (target: Pick<Window, 'teamtown'> = window): PlatformBridge =>
  target.teamtown ?? webBridge;
