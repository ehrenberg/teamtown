import { randomUUID } from 'node:crypto';
import { Global, Module, type DynamicModule } from '@nestjs/common';
import { systemClock, type IdGenerator } from '@teamtown/kernel';
import { APP_CONFIG, type AppConfig } from './app-config.ts';

export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');

const uuidGenerator: IdGenerator = { next: () => randomUUID() };

/** Provides validated configuration and cross-cutting ports (clock, ID generator) to all modules. */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: CLOCK, useValue: systemClock },
        { provide: ID_GENERATOR, useValue: uuidGenerator },
      ],
      exports: [APP_CONFIG, CLOCK, ID_GENERATOR],
    };
  }
}
