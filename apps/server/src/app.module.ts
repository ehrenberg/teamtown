import { Module, type DynamicModule } from '@nestjs/common';
import { IdentityModule, type IdentityModuleOptions } from './modules/identity/public-api.ts';
import { MeetingsModule } from './modules/meetings/public-api.ts';
import { PeopleModule } from './modules/people/public-api.ts';
import { PresenceModule } from './modules/presence/public-api.ts';
import { RealtimeModule } from './modules/realtime/realtime.module.ts';
import { WorldModule } from './modules/world/public-api.ts';
import type { AppConfig } from './platform/config/app-config.ts';
import { ConfigModule } from './platform/config/config.module.ts';
import { DatabaseModule } from './platform/database/database.module.ts';
import { HealthModule } from './platform/health/health.module.ts';
import { LoggingModule } from './platform/logging/logging.module.ts';

export type AppOverrides = IdentityModuleOptions;

/**
 * Composition root: wires the bounded-context modules (docs/architecture/domain-model.md) and
 * collects their persistence contributions.
 */
@Module({})
export class AppModule {
  static forRoot(config: AppConfig, overrides: AppOverrides = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(config),
        DatabaseModule.forRoot(config, {
          entities: [...PeopleModule.entities, ...WorldModule.entities],
          migrations: [...PeopleModule.migrations, ...WorldModule.migrations],
        }),
        HealthModule,
        IdentityModule.forRoot(overrides),
        PeopleModule,
        WorldModule,
        PresenceModule,
        MeetingsModule,
        RealtimeModule,
      ],
    };
  }
}
