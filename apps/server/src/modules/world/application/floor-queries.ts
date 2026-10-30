import type { FloorGrid, Rect, TileCoord } from '@teamtown/world-core';
import type { FloorPlanProps } from '../domain/floor-plan.ts';
import type { FloorPlanRepository } from './ports/floor-plan-repository.port.ts';

export interface FloorSummaryView {
  readonly floorId: string;
  readonly name: string;
  readonly level: number;
}

/** What other contexts need to run a floor: walkability, where people appear, where sound is isolated. */
export interface PublishedFloorView {
  readonly floorId: string;
  readonly grid: FloorGrid;
  readonly spawnPoints: readonly TileCoord[];
  readonly audioIsolatedAreas: readonly Rect[];
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
    if (!plan) return null;
    return {
      floorId: plan.floorId,
      grid: plan.grid,
      spawnPoints: plan.props.spawnPoints,
      audioIsolatedAreas: plan.props.rooms.filter((room) => room.audioIsolated).flatMap((room) => room.areas),
    };
  }
}
