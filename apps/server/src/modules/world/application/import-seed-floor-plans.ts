import { FloorPlan, type FloorPlanProps } from '../domain/floor-plan.ts';
import type { FloorPlanRepository } from './ports/floor-plan-repository.port.ts';

/**
 * Use case: import the bundled demo floors on startup if they don't exist yet (ADR-0029).
 * Existing floors are never overwritten, so later edits (M5 editor) survive restarts.
 */
export class ImportSeedFloorPlans {
  constructor(private readonly floorPlans: FloorPlanRepository) {}

  async execute(seeds: readonly FloorPlanProps[]): Promise<string[]> {
    const imported: string[] = [];
    for (const seed of seeds) {
      if (await this.floorPlans.exists(seed.floorId)) continue;
      const plan = FloorPlan.create(seed);
      if (!plan.ok) {
        // Seeds ship with the code; an invalid seed is a programming error and must stop the startup.
        throw new Error(`Seed floor plan "${seed.floorId}" is invalid: ${plan.error}`);
      }
      await this.floorPlans.save(plan.value);
      imported.push(seed.floorId);
    }
    return imported;
  }
}
