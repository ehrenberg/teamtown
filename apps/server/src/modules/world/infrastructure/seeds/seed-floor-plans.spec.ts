import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { FloorPlan } from '../../domain/floor-plan.ts';
import { loadSeedFloorPlans } from './seed-floor-plans.ts';

describe('seed floor plans', () => {
  it.each(loadSeedFloorPlans().map((seed) => [seed.floorId, seed] as const))(
    '"%s" matches the contract and satisfies all domain invariants',
    (_, seed) => {
      const plan = unwrap(FloorPlan.create(seed));

      expect(plan.props.spawnPoints.every((spawn) => plan.grid.isWalkable(spawn))).toBe(true);
    },
  );

  it('lets only the closed rooms of the demo office change their door mode', () => {
    const adjustable = loadSeedFloorPlans().flatMap((seed) => {
      const plan = unwrap(FloorPlan.create(seed));
      return seed.rooms.filter((room) => plan.isDoorModeAdjustable(room.id)).map((room) => room.id);
    });

    expect(adjustable.sort()).toEqual(['alster', 'elbe', 'terrace']);
  });
});
