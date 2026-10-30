import { parseAuthCallback } from '../deep-link.ts';
import { OidcRequestError, type NativeOidcClient, type TokenSet } from './native-oidc-client.ts';
import { createPkcePair, createState } from './pkce.ts';
import type { SecretStore } from './secret-store.ts';

/** What the web client sees: a short-lived access token only, never the refresh token (ADR-0029). */
export interface DesktopSession {
  readonly accessToken: string;
  /** ms since the epoch */
  readonly expiresAt: number;
}

export interface Timers {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

export interface DesktopAuthDependencies {
  readonly oidc: Pick<NativeOidcClient, 'authorizationUrl' | 'exchangeCode' | 'refresh' | 'endSession'>;
  readonly store: SecretStore;
  readonly openExternal: (url: string) => Promise<void>;
  readonly onSessionChanged: (session: DesktopSession | null) => void;
  readonly now: () => number;
  readonly timers: Timers;
}

/** Refresh this long before the access token expires. */
export const REFRESH_MARGIN_MS = 30_000;
/** Retry interval when the identity provider is unreachable. */
export const RETRY_DELAY_MS = 15_000;

/** The refresh token is no longer valid (expired, revoked, session ended): sign in again. */
const isRejected = (error: unknown): boolean =>
  error instanceof OidcRequestError && error.status !== null && error.status >= 400 && error.status < 500;

/**
 * Login state of the desktop app (ADR-0023): starts the flow in the system browser, completes it
 * from the `teamtown://auth/callback` deep link and keeps the access token fresh.
 */
export class DesktopAuthSession {
  #tokens: TokenSet | null = null;
  #pending: { readonly state: string; readonly verifier: string } | null = null;
  #timer: unknown = null;
  #restored: Promise<void> | null = null;

  constructor(private readonly deps: DesktopAuthDependencies) {}

  /** Restores the login of the last app start from the stored refresh token. */
  restore(): Promise<void> {
    this.#restored ??= this.#restore();
    return this.#restored;
  }

  async getSession(): Promise<DesktopSession | null> {
    await this.restore();
    return this.#session();
  }

  async signIn(): Promise<void> {
    const pkce = createPkcePair();
    const state = createState();
    this.#pending = { state, verifier: pkce.verifier };
    const url = await this.deps.oidc.authorizationUrl({ state, codeChallenge: pkce.challenge });
    await this.deps.openExternal(url);
  }

  /**
   * Completes a login from a deep link. Returns false if the link is not an auth callback.
   * Callbacks that this app did not start (unknown state) are ignored.
   */
  async handleCallback(link: string): Promise<boolean> {
    const callback = parseAuthCallback(link);
    if (!callback) return false;
    const pending = this.#pending;
    if (pending?.state !== callback.state) return true;
    this.#pending = null;
    if (callback.kind === 'error') return true;
    await this.#accept(await this.deps.oidc.exchangeCode(callback.code, pending.verifier));
    return true;
  }

  async signOut(): Promise<void> {
    const tokens = this.#tokens;
    this.#reset();
    await this.deps.store.clear();
    this.deps.onSessionChanged(null);
    if (tokens) {
      // Best effort: the local session is gone either way.
      await this.deps.oidc.endSession(tokens.refreshToken).catch(() => undefined);
    }
  }

  async #restore(): Promise<void> {
    const refreshToken = await this.deps.store.load();
    if (!refreshToken || this.#tokens) return; // nothing stored, or signed in before the restore ran
    try {
      await this.#accept(await this.deps.oidc.refresh(refreshToken));
    } catch (error) {
      if (isRejected(error)) {
        await this.deps.store.clear();
      } else {
        // Offline at start: keep the stored token and try again later.
        this.#schedule(RETRY_DELAY_MS, () => this.#retryRestore(refreshToken));
      }
    }
  }

  async #retryRestore(refreshToken: string): Promise<void> {
    if (this.#tokens) return; // signed in meanwhile
    try {
      await this.#accept(await this.deps.oidc.refresh(refreshToken));
    } catch (error) {
      if (isRejected(error)) await this.deps.store.clear();
      else this.#schedule(RETRY_DELAY_MS, () => this.#retryRestore(refreshToken));
    }
  }

  async #accept(tokens: TokenSet): Promise<void> {
    this.#tokens = tokens;
    await this.deps.store.save(tokens.refreshToken);
    const delay = Math.max(0, tokens.expiresAt - this.deps.now() - REFRESH_MARGIN_MS);
    this.#schedule(delay, () => this.#refresh());
    this.deps.onSessionChanged(this.#session());
  }

  async #refresh(): Promise<void> {
    const tokens = this.#tokens;
    if (!tokens) return;
    try {
      await this.#accept(await this.deps.oidc.refresh(tokens.refreshToken));
    } catch (error) {
      if (isRejected(error)) {
        this.#reset();
        await this.deps.store.clear();
        this.deps.onSessionChanged(null);
      } else {
        this.#schedule(RETRY_DELAY_MS, () => this.#refresh());
      }
    }
  }

  #schedule(delayMs: number, task: () => Promise<void>): void {
    if (this.#timer !== null) this.deps.timers.clear(this.#timer);
    this.#timer = this.deps.timers.set(() => {
      this.#timer = null;
      void task();
    }, delayMs);
  }

  #reset(): void {
    if (this.#timer !== null) this.deps.timers.clear(this.#timer);
    this.#timer = null;
    this.#tokens = null;
    this.#pending = null;
  }

  #session(): DesktopSession | null {
    return this.#tokens ? { accessToken: this.#tokens.accessToken, expiresAt: this.#tokens.expiresAt } : null;
  }
}
