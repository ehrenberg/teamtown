import type { FloorGrid, Point } from '@teamtown/world-core';

export interface FloorAcoustics {
  readonly floorId: string;
  /** Walls block sound (every wall, glass included); doors are openings. */
  readonly grid: FloorGrid;
  /** Rooms with their own room call. */
  readonly isolatedRoomIds: readonly string[];
  isIsolated(position: Point): boolean;
}

export interface FloorAcousticsSource {
  getFloor(floorId: string): Promise<FloorAcoustics | null>;
}

export const FLOOR_ACOUSTICS_SOURCE = Symbol('FLOOR_ACOUSTICS_SOURCE');
