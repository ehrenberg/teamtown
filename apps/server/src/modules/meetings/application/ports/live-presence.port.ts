import type { Point } from '@teamtown/world-core';

export type DoorMode = 'open' | 'knock' | 'locked';

/** Live presence, read through the Presence public API. Never persist or log what it returns (ADR-0012). */
export interface LivePresence {
  occupiedFloorIds(): string[];
  positionsOn(floorId: string): { readonly personId: string; readonly position: Point }[];
  floorOf(personId: string): string | null;
  roomOf(personId: string): string | null;
  occupantsOf(floorId: string, roomId: string): string[];
  /** `null` if the floor isn't running or has no such room. */
  doorModeOf(floorId: string, roomId: string): DoorMode | null;
}

export const LIVE_PRESENCE = Symbol('LIVE_PRESENCE');
