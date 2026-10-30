import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
import type { AuthClient, AuthSession, SessionListener } from './auth-client.ts';

export const AUTH_CALLBACK_PATH = '/auth/callback';

const toSession = (user: User | null): AuthSession | null =>
  user && !user.expired && user.expires_at
    ? { accessToken: user.access_token, expiresAt: user.expires_at * 1000 }
    : null;

/** Browser login: authorization code flow with PKCE against the OIDC issuer (Keycloak). */
export class OidcAuthClient implements AuthClient {
  readonly #manager: UserManager;
  readonly #listeners = new Set<SessionListener>();

  constructor(options: { issuer: string; clientId: string; origin: string }) {
    this.#manager = new UserManager({
      authority: options.issuer,
      client_id: options.clientId,
      redirect_uri: `${options.origin}${AUTH_CALLBACK_PATH}`,
      post_logout_redirect_uri: `${options.origin}/`,
      response_type: 'code',
      scope: 'openid profile email',
      // Refreshes the access token in the background (via refresh token) before it expires.
      automaticSilentRenew: true,
      // Session storage: the login survives reloads but not closing the tab.
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    });
    this.#manager.events.addUserLoaded((user) => {
      this.#notify(toSession(user));
    });
    this.#manager.events.addUserUnloaded(() => {
      this.#notify(null);
    });
    this.#manager.events.addSilentRenewError(() => {
      this.#notify(null);
    });
  }

  async initialise(): Promise<AuthSession | null> {
    if (window.location.pathname === AUTH_CALLBACK_PATH) {
      const user = await this.#manager.signinRedirectCallback();
      window.history.replaceState({}, document.title, '/');
      return toSession(user);
    }
    return toSession(await this.#manager.getUser());
  }

  signIn(): Promise<void> {
    return this.#manager.signinRedirect();
  }

  async signOut(): Promise<void> {
    await this.#manager.signoutRedirect();
  }

  onSessionChanged(listener: SessionListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify(session: AuthSession | null): void {
    for (const listener of this.#listeners) listener(session);
  }
}
