import { err, ok, type Result } from '@teamtown/kernel';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { TokenVerificationError, TokenVerifier } from '../application/ports/token-verifier.port.ts';
import type { Principal } from '../domain/principal.ts';

const MAX_DISPLAY_NAME_LENGTH = 80;

interface OidcClaims extends JWTPayload {
  name?: string;
  preferred_username?: string;
  email?: string;
}

/**
 * Verifies access tokens against the issuer's published keys (JWKS, cached by jose).
 * The JWKS URL is discovered from the standard OIDC metadata, so any compliant IdP works (ADR-0010).
 */
export class JoseTokenVerifier implements TokenVerifier {
  #keys: ReturnType<typeof createRemoteJWKSet> | undefined;

  constructor(
    private readonly issuer: string,
    private readonly audience: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async verify(accessToken: string): Promise<Result<Principal, TokenVerificationError>> {
    try {
      const keys = await this.#getKeys();
      const { payload } = await jwtVerify<OidcClaims>(accessToken, keys, {
        issuer: this.issuer,
        audience: this.audience,
      });
      if (!payload.sub || payload.exp === undefined) {
        return err('invalid-token');
      }
      return ok({
        subject: payload.sub,
        displayName: (payload.name ?? payload.preferred_username ?? payload.sub).slice(0, MAX_DISPLAY_NAME_LENGTH),
        email: payload.email ?? null,
        expiresAt: payload.exp * 1000,
      });
    } catch {
      // Expired, wrong signature, wrong audience, malformed: all are the same to callers.
      return err('invalid-token');
    }
  }

  async #getKeys(): Promise<ReturnType<typeof createRemoteJWKSet>> {
    if (!this.#keys) {
      const response = await this.fetchImpl(`${this.issuer}/.well-known/openid-configuration`);
      if (!response.ok) {
        throw new Error(`OIDC discovery failed with HTTP ${response.status}`);
      }
      const metadata = (await response.json()) as { jwks_uri?: unknown };
      if (typeof metadata.jwks_uri !== 'string') {
        throw new Error('OIDC discovery document has no jwks_uri');
      }
      this.#keys = createRemoteJWKSet(new URL(metadata.jwks_uri));
    }
    return this.#keys;
  }
}
