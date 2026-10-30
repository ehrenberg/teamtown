import type { Clock } from '@teamtown/kernel';
import type { FloorRegistry } from './floor-registry.ts';

export interface LivePosition {
  readonly personId: string;
  readonly position: { readonly x: number; readonly y: number };
}

/** Positions only exist in memory; callers must not persist or log them (ADR-0012). */
export class PresenceQueries {
  constructor(
    private readonly registry: FloorRegistry,
    private readonly clock: Clock,
  ) {}

  occupiedFloorIds(): string[] {
    return this.registry.runningFloorIds();
  }

  positionsOn(floorId: string): LivePosition[] {
    return this.registry.running(floorId)?.positions(this.clock.now().getTime()) ?? [];
  }
}
