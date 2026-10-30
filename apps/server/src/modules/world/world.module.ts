import { Inject, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { MikroORM } from '@mikro-orm/postgresql';
import { FloorQueries } from './application/floor-queries.ts';
import { ImportSeedFloorPlans } from './application/import-seed-floor-plans.ts';
import { FLOOR_PLAN_REPOSITORY, type FloorPlanRepository } from './application/ports/floor-plan-repository.port.ts';
import { FloorPlanEntity } from './infrastructure/persistence/floor-plan.entity.ts';
import { WORLD_MIGRATIONS } from './infrastructure/persistence/migrations/world-initial.migration.ts';
import { MikroOrmFloorPlanRepository } from './infrastructure/persistence/mikro-orm-floor-plan.repository.ts';
import { loadSeedFloorPlans } from './infrastructure/seeds/seed-floor-plans.ts';
import { FloorsController } from './interface/http/floors.controller.ts';

@Module({
  controllers: [FloorsController],
  providers: [
    {
      provide: FLOOR_PLAN_REPOSITORY,
      useFactory: (orm: MikroORM) => new MikroOrmFloorPlanRepository(orm),
      inject: [MikroORM],
    },
    {
      provide: FloorQueries,
      useFactory: (plans: FloorPlanRepository) => new FloorQueries(plans),
      inject: [FLOOR_PLAN_REPOSITORY],
    },
    {
      provide: ImportSeedFloorPlans,
      useFactory: (plans: FloorPlanRepository) => new ImportSeedFloorPlans(plans),
      inject: [FLOOR_PLAN_REPOSITORY],
    },
  ],
  exports: [FloorQueries],
})
export class WorldModule implements OnApplicationBootstrap {
  static readonly entities = [FloorPlanEntity];
  static readonly migrations = WORLD_MIGRATIONS;

  private readonly logger = new Logger('World');

  constructor(@Inject(ImportSeedFloorPlans) private readonly importSeeds: ImportSeedFloorPlans) {}

  async onApplicationBootstrap(): Promise<void> {
    const imported = await this.importSeeds.execute(loadSeedFloorPlans());
    if (imported.length > 0) {
      this.logger.log(`Imported demo floors: ${imported.join(', ')}`);
    }
  }
}
