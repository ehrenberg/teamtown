// The only entry point other modules may import from the Identity context.
export { Authenticate } from './application/authenticate.ts';
export type { TokenVerificationError, TokenVerifier } from './application/ports/token-verifier.port.ts';
export type { Principal } from './domain/principal.ts';
export { AuthGuard, CurrentPrincipal } from './interface/http/auth.guard.ts';

export { IdentityModule, type IdentityModuleOptions } from './identity.module.ts';
