import type { FloorGrid, TileCoord } from '@teamtown/world-core';
import type { FloorRooms } from '../../domain/floor-instance.ts';

export interface FloorDefinition {
  readonly floorId: string;
  readonly grid: FloorGrid;
  readonly spawnPoints: readonly TileCoord[];
  /** Missing on floors without rooms. */
  readonly rooms?: FloorRooms;
}

/** Where floor layouts come from (the World context). */
export interface FloorSource {
  getFloor(floorId: string): Promise<FloorDefinition | null>;
}

export const FLOOR_SOURCE = Symbol('FLOOR_SOURCE');
