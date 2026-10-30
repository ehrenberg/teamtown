import { FloorPlan as FloorPlanContract } from '@teamtown/contracts';
import groundFloor from '../../../../../seeds/floors/ground-floor.json' with { type: 'json' };
import upperFloor from '../../../../../seeds/floors/upper-floor.json' with { type: 'json' };
import type { FloorPlanProps } from '../../domain/floor-plan.ts';

/**
 * The demo floors from apps/server/seeds/floors. They are bundled with the server and validated
 * against the floor-plan contract before they reach the domain.
 */
export function loadSeedFloorPlans(): FloorPlanProps[] {
  return [groundFloor, upperFloor].map((seed) => FloorPlanContract.parse(seed) satisfies FloorPlanProps);
}
