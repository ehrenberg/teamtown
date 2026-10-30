import type { Result } from '@teamtown/kernel';
import type { Principal } from '../domain/principal.ts';
import type { TokenVerificationError, TokenVerifier } from './ports/token-verifier.port.ts';

/** Use case: turn a bearer token into a principal. Used by REST guards and the realtime handshake. */
export class Authenticate {
  constructor(private readonly verifier: TokenVerifier) {}

  execute(accessToken: string): Promise<Result<Principal, TokenVerificationError>> {
    return this.verifier.verify(accessToken);
  }
}
