import type { Clock } from '@teamtown/kernel';
import type { DoorMode } from '../domain/room-doors.ts';
import type { FloorRegistry } from './floor-registry.ts';

export interface LivePosition {
  readonly personId: string;
  readonly position: { readonly x: number; readonly y: number };
}

export interface LiveDoorMode {
  readonly roomId: string;
  readonly doorMode: DoorMode;
}

/** Positions and room occupancy only exist in memory; callers must not persist or log them (ADR-0012). */
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

  floorOf(personId: string): string | null {
    return this.registry.floorOf(personId)?.floorId ?? null;
  }

  roomOf(personId: string): string | null {
    return this.registry.floorOf(personId)?.roomOf(personId, this.clock.now().getTime()) ?? null;
  }

  occupantsOf(floorId: string, roomId: string): string[] {
    return this.registry.running(floorId)?.occupantsOf(roomId, this.clock.now().getTime()) ?? [];
  }

  doorModesOn(floorId: string): LiveDoorMode[] {
    return this.registry.running(floorId)?.doorModes() ?? [];
  }
}
