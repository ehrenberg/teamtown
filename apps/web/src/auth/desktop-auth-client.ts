import type { DesktopAuthBridge } from '../platform/platform-bridge.ts';
import type { AuthClient, AuthSession, SessionListener } from './auth-client.ts';

/** Desktop login: the Electron main process runs the flow in the system browser (ADR-0023). */
export class DesktopAuthClient implements AuthClient {
  constructor(private readonly bridge: DesktopAuthBridge) {}

  initialise(): Promise<AuthSession | null> {
    return this.bridge.getSession();
  }

  signIn(): Promise<void> {
    return this.bridge.signIn();
  }

  signOut(): Promise<void> {
    return this.bridge.signOut();
  }

  onSessionChanged(listener: SessionListener): () => void {
    return this.bridge.onSessionChanged(listener);
  }
}
