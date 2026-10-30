export interface AuthSession {
  readonly accessToken: string;
  /** ms since the epoch */
  readonly expiresAt: number;
}

export type SessionListener = (session: AuthSession | null) => void;

/**
 * Port for authentication. The web implementation runs the OIDC flow in the browser (oidc-client-ts);
 * the desktop implementation delegates to the Electron main process (ADR-0023, ADR-0029).
 */
export interface AuthClient {
  /** Restores an existing session or completes a pending login redirect. */
  initialise(): Promise<AuthSession | null>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Notifies about refreshed tokens and sign-outs. Returns an unsubscribe function. */
  onSessionChanged(listener: SessionListener): () => void;
}
