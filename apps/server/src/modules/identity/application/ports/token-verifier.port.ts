import type { Result } from '@teamtown/kernel';
import type { Principal } from '../../domain/principal.ts';

export type TokenVerificationError = 'invalid-token';

/** Verifies an OIDC access token (signature, issuer, audience, expiry). */
export interface TokenVerifier {
  verify(accessToken: string): Promise<Result<Principal, TokenVerificationError>>;
}

export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');
