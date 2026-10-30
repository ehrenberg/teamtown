import type { AdmitToRoom, PresenceQueries } from '../../presence/public-api.ts';
import type { DoorMode, LivePresence } from '../application/ports/live-presence.port.ts';
import type { RoomAdmission } from '../application/ports/room-admission.port.ts';

export class PresenceLivePositions implements LivePresence, RoomAdmission {
  constructor(
    private readonly presence: PresenceQueries,
    private readonly admitToRoom: AdmitToRoom,
  ) {}

  occupiedFloorIds(): string[] {
    return this.presence.occupiedFloorIds();
  }

  positionsOn(floorId: string) {
    return this.presence.positionsOn(floorId);
  }

  floorOf(personId: string): string | null {
    return this.presence.floorOf(personId);
  }

  roomOf(personId: string): string | null {
    return this.presence.roomOf(personId);
  }

  occupantsOf(floorId: string, roomId: string): string[] {
    return this.presence.occupantsOf(floorId, roomId);
  }

  doorModeOf(floorId: string, roomId: string): DoorMode | null {
    return this.presence.doorModesOn(floorId).find((room) => room.roomId === roomId)?.doorMode ?? null;
  }

  admit(personId: string, floorId: string, roomId: string): void {
    // The requester may have left in the meantime; then there is nobody to walk in.
    this.admitToRoom.execute({ personId, floorId, roomId });
  }
}
