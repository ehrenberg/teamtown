import type { PresenceQueries } from '../../presence/public-api.ts';
import type { LivePresence } from '../application/ports/live-presence.port.ts';

export class PresenceLivePositions implements LivePresence {
  constructor(private readonly presence: PresenceQueries) {}

  occupiedFloorIds(): string[] {
    return this.presence.occupiedFloorIds();
  }

  positionsOn(floorId: string) {
    return this.presence.positionsOn(floorId);
  }
}
