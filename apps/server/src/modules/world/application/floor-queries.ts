import type { FloorGrid, TileCoord } from '@teamtown/world-core';
import type { FloorPlanProps } from '../domain/floor-plan.ts';
import type { FloorPlanRepository } from './ports/floor-plan-repository.port.ts';

export interface FloorSummaryView {
  readonly floorId: string;
  readonly name: string;
  readonly level: number;
}

/** What the Presence context needs to run a floor: walkability and where people appear. */
export interface PublishedFloorView {
  readonly floorId: string;
  readonly grid: FloorGrid;
  readonly spawnPoints: readonly TileCoord[];
}

/** Read side of the World context. */
export class FloorQueries {
  constructor(private readonly floorPlans: FloorPlanRepository) {}

  async listFloors(): Promise<FloorSummaryView[]> {
    const plans = await this.floorPlans.list();
    return plans
      .map(({ props }) => ({ floorId: props.floorId, name: props.name, level: props.level }))
      .sort((a, b) => a.level - b.level);
  }

  async getFloorPlan(floorId: string): Promise<FloorPlanProps | null> {
    return (await this.floorPlans.findById(floorId))?.props ?? null;
  }

  async getPublishedFloor(floorId: string): Promise<PublishedFloorView | null> {
    const plan = await this.floorPlans.findById(floorId);
    return plan ? { floorId: plan.floorId, grid: plan.grid, spawnPoints: plan.props.spawnPoints } : null;
  }
}
