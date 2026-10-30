import type { FloorGrid, TileCoord } from '@teamtown/world-core';

export interface FloorDefinition {
  readonly floorId: string;
  readonly grid: FloorGrid;
  readonly spawnPoints: readonly TileCoord[];
}

/** Where floor layouts come from (the World context). */
export interface FloorSource {
  getFloor(floorId: string): Promise<FloorDefinition | null>;
}

export const FLOOR_SOURCE = Symbol('FLOOR_SOURCE');
