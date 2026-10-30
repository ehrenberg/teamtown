import type { FloorGrid, Rect, RoomMap, TileCoord } from '@teamtown/world-core';
import type { DoorMode, FloorPlanProps } from '../domain/floor-plan.ts';
import type { FloorPlanRepository } from './ports/floor-plan-repository.port.ts';

export interface FloorSummaryView {
  readonly floorId: string;
  readonly name: string;
  readonly level: number;
}

export interface RoomView {
  readonly roomId: string;
  /** The door mode from the floor plan; the live door mode starts here and returns here when the room empties. */
  readonly doorMode: DoorMode;
  readonly doorModeAdjustable: boolean;
  readonly audioIsolated: boolean;
}

/** What other contexts need to run a floor: walkability, rooms, where people appear, where sound is isolated. */
export interface PublishedFloorView {
  readonly floorId: string;
  readonly grid: FloorGrid;
  readonly roomMap: RoomMap;
  readonly rooms: readonly RoomView[];
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
      roomMap: plan.roomMap,
      rooms: plan.props.rooms.map((room) => ({
        roomId: room.id,
        doorMode: room.doorMode,
        doorModeAdjustable: plan.isDoorModeAdjustable(room.id),
        audioIsolated: room.audioIsolated,
      })),
      spawnPoints: plan.props.spawnPoints,
      audioIsolatedAreas: plan.props.rooms.filter((room) => room.audioIsolated).flatMap((room) => room.areas),
    };
  }
}
