import { Global, Module, type DynamicModule } from '@nestjs/common';
import { systemClock } from '@teamtown/kernel';
import { APP_CONFIG, type AppConfig } from './app-config.ts';

export const CLOCK = Symbol('CLOCK');

/** Provides validated configuration and cross-cutting ports (e.g. the clock) to all modules. */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: CLOCK, useValue: systemClock },
      ],
      exports: [APP_CONFIG, CLOCK],
    };
  }
}
