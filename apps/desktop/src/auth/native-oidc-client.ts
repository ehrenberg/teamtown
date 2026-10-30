/**
 * OAuth 2.0 for native apps (RFC 8252, ADR-0023): authorization code flow with PKCE, executed by the
 * Electron main process. Framework-free so it can be unit-tested with a fake `fetch`.
 */
export interface NativeOidcConfig {
  readonly issuer: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: string;
}

export interface TokenSet {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** ms since the epoch */
  readonly expiresAt: number;
}

interface Endpoints {
  readonly authorization: string;
  readonly token: string;
  readonly endSession: string | null;
}

export class OidcRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'OidcRequestError';
  }
}

/** Fields read from the identity provider's JSON responses; everything is checked before use. */
interface DiscoveryDocument {
  readonly authorization_endpoint?: unknown;
  readonly token_endpoint?: unknown;
  readonly end_session_endpoint?: unknown;
}

interface TokenResponse {
  readonly access_token?: unknown;
  readonly refresh_token?: unknown;
  readonly expires_in?: unknown;
}

const asObject = (value: unknown): object => (typeof value === 'object' && value !== null ? value : {});

export class NativeOidcClient {
  #endpoints: Promise<Endpoints> | null = null;

  constructor(
    private readonly config: NativeOidcConfig,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async authorizationUrl(request: { readonly state: string; readonly codeChallenge: string }): Promise<string> {
    const url = new URL((await this.#discover()).authorization);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope,
      state: request.state,
      code_challenge: request.codeChallenge,
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  exchangeCode(code: string, codeVerifier: string): Promise<TokenSet> {
    return this.#tokenRequest({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: this.config.redirectUri,
    });
  }

  refresh(refreshToken: string): Promise<TokenSet> {
    return this.#tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  /** Ends the session at the identity provider (Keycloak accepts the refresh token for public clients). */
  async endSession(refreshToken: string): Promise<void> {
    const { endSession } = await this.#discover();
    if (!endSession) return;
    await this.#post(endSession, { client_id: this.config.clientId, refresh_token: refreshToken });
  }

  #discover(): Promise<Endpoints> {
    this.#endpoints ??= this.#loadEndpoints().catch((error: unknown) => {
      this.#endpoints = null; // retry on the next call, e.g. when the network is back
      throw error;
    });
    return this.#endpoints;
  }

  async #loadEndpoints(): Promise<Endpoints> {
    const response = await this.fetchFn(`${this.config.issuer}/.well-known/openid-configuration`);
    if (!response.ok) throw new OidcRequestError('OIDC discovery failed', response.status);
    const body = asObject(await response.json()) as DiscoveryDocument;
    if (typeof body.authorization_endpoint !== 'string' || typeof body.token_endpoint !== 'string') {
      throw new OidcRequestError('OIDC discovery document is incomplete');
    }
    return {
      authorization: body.authorization_endpoint,
      token: body.token_endpoint,
      endSession: typeof body.end_session_endpoint === 'string' ? body.end_session_endpoint : null,
    };
  }

  async #tokenRequest(parameters: Record<string, string>): Promise<TokenSet> {
    const { token } = await this.#discover();
    const requestedAt = this.now();
    const response = await this.#post(token, { client_id: this.config.clientId, ...parameters });
    const body = asObject(await response.json()) as TokenResponse;
    if (
      typeof body.access_token !== 'string' ||
      typeof body.refresh_token !== 'string' ||
      typeof body.expires_in !== 'number'
    ) {
      throw new OidcRequestError('Token response is incomplete');
    }
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: requestedAt + body.expires_in * 1000,
    };
  }

  async #post(url: string, form: Record<string, string>): Promise<Response> {
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
    if (!response.ok) throw new OidcRequestError(`OIDC request failed: ${url}`, response.status);
    return response;
  }
}
