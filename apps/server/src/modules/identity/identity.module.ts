import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../platform/config/app-config.ts';
import { Authenticate } from './application/authenticate.ts';
import { TOKEN_VERIFIER, type TokenVerifier } from './application/ports/token-verifier.port.ts';
import { JoseTokenVerifier } from './infrastructure/jose-token-verifier.ts';
import { AuthGuard } from './interface/http/auth.guard.ts';

export interface IdentityModuleOptions {
  /** Replaces the OIDC verifier, e.g. in integration tests. */
  readonly tokenVerifier?: TokenVerifier;
}

@Global()
@Module({})
export class IdentityModule {
  static forRoot(options: IdentityModuleOptions = {}): DynamicModule {
    const verifierProvider: Provider = options.tokenVerifier
      ? { provide: TOKEN_VERIFIER, useValue: options.tokenVerifier }
      : {
          provide: TOKEN_VERIFIER,
          useFactory: (config: AppConfig) => new JoseTokenVerifier(config.OIDC_ISSUER, config.OIDC_AUDIENCE),
          inject: [APP_CONFIG],
        };
    return {
      module: IdentityModule,
      providers: [
        verifierProvider,
        {
          provide: Authenticate,
          useFactory: (verifier: TokenVerifier) => new Authenticate(verifier),
          inject: [TOKEN_VERIFIER],
        },
        AuthGuard,
      ],
      exports: [Authenticate, AuthGuard],
    };
  }
}
