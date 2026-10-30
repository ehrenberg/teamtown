import type { Point } from '@teamtown/world-core';

export interface LivePresence {
  occupiedFloorIds(): string[];
  positionsOn(floorId: string): { readonly personId: string; readonly position: Point }[];
}

export const LIVE_PRESENCE = Symbol('LIVE_PRESENCE');
