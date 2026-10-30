import {
  createParamDecorator,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Authenticate } from '../../application/authenticate.ts';
import type { Principal } from '../../domain/principal.ts';

type AuthenticatedRequest = FastifyRequest & { principal?: Principal };

const BEARER_PREFIX = 'Bearer ';

/** Protects REST endpoints: requires a valid OIDC access token in the Authorization header. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Authenticate) private readonly authenticate: Authenticate) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException();
    }
    const result = await this.authenticate.execute(header.slice(BEARER_PREFIX.length));
    if (!result.ok) {
      throw new UnauthorizedException();
    }
    request.principal = result.value;
    return true;
  }
}

/** Injects the principal set by `AuthGuard` into a controller method parameter. */
export const CurrentPrincipal = createParamDecorator((_: unknown, context: ExecutionContext): Principal => {
  const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
  if (!principal) {
    throw new UnauthorizedException();
  }
  return principal;
});
