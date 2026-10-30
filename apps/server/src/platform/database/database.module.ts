import { Global, Inject, Logger, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import type { MigrationObject } from '@mikro-orm/core';
import { Migrator } from '@mikro-orm/migrations';
import { MikroORM, type EntitySchema } from '@mikro-orm/postgresql';
import type { AppConfig } from '../config/app-config.ts';

export interface DatabaseModuleOptions {
  /** Entity schemas contributed by the bounded-context modules. */
  readonly entities: readonly EntitySchema[];
  /** Migrations contributed by the modules; run in name order (names start with a timestamp). */
  readonly migrations: readonly MigrationObject[];
}

/**
 * Owns the single MikroORM instance. Each module keeps its tables in its own PostgreSQL schema
 * and never touches another module's tables (ADR-0009).
 */
@Global()
@Module({})
export class DatabaseModule implements OnApplicationShutdown {
  private static readonly logger = new Logger('Database');

  constructor(@Inject(MikroORM) private readonly orm: MikroORM) {}

  static forRoot(config: AppConfig, options: DatabaseModuleOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: MikroORM,
          useFactory: async () => {
            const orm = await MikroORM.init({
              clientUrl: config.DATABASE_URL,
              entities: [...options.entities],
              extensions: [Migrator],
              migrations: {
                migrationsList: [...options.migrations].sort((a, b) => a.name.localeCompare(b.name)),
                tableName: 'platform_migrations',
                transactional: true,
                // Migrations are hand-written per module; no schema snapshot files in the working directory.
                snapshot: false,
              },
              debug: false,
            });
            if (config.DATABASE_MIGRATE_ON_START) {
              const executed = await orm.migrator.up();
              if (executed.length > 0) {
                DatabaseModule.logger.log(`Applied ${executed.length} migration(s)`);
              }
            }
            return orm;
          },
        },
      ],
      exports: [MikroORM],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.orm.close();
  }
}
