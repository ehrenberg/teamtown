import { Module, type DynamicModule } from '@nestjs/common';
import type { AppConfig } from './platform/config/app-config.ts';
import { ConfigModule } from './platform/config/config.module.ts';
import { HealthModule } from './platform/health/health.module.ts';

/**
 * Composition root. Bounded-context modules (src/modules/<context>) are registered here
 * as they are implemented (docs/engineering/project-structure.md).
 */
@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(config), HealthModule],
    };
  }
}
