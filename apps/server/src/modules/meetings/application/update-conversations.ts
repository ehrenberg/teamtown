import type { Clock } from '@teamtown/kernel';
import type { DirectCalls } from '../domain/direct-calls.ts';
import type { ConversationEvent } from '../domain/floor-conversations.ts';
import type { RoomCallChanged } from '../domain/room-calls.ts';
import type { ConversationMedia } from './conversation-media.ts';
import type { ConversationRegistry } from './conversation-registry.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';

/**
 * Runs on a short tick: proximity conversations and room calls follow the live positions. People in a direct call
 * take part in neither: the call replaces their surroundings.
 */
export class UpdateConversations {
  constructor(
    private readonly presence: LivePresence,
    private readonly registry: ConversationRegistry,
    private readonly media: ConversationMedia,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
    private readonly calls: DirectCalls,
  ) {}

  async execute(): Promise<void> {
    const now = this.clock.now().getTime();
    const occupied = new Set(this.presence.occupiedFloorIds());
    const changes: ConversationEvent[] = [];
    const roomCallChanges: RoomCallChanged[] = [];

    for (const floorId of occupied) {
      const floor = await this.registry.open(floorId);
      if (!floor) continue;
      const listeners = this.presence
        .positionsOn(floorId)
        .filter(({ personId, position }) => !floor.acoustics.isIsolated(position) && !this.calls.isInCall(personId));
      floor.conversations.update(listeners, now);
      changes.push(...floor.conversations.pullEvents());

      const occupants = new Map(
        floor.acoustics.isolatedRoomIds.map((roomId) => [
          roomId,
          this.presence.occupantsOf(floorId, roomId).filter((personId) => !this.calls.isInCall(personId)),
        ]),
      );
      roomCallChanges.push(...floor.roomCalls.update(occupants));
    }

    for (const floorId of this.registry.runningFloorIds()) {
      if (occupied.has(floorId)) continue;
      const floor = this.registry.get(floorId);
      floor?.conversations.update([], now);
      changes.push(...(floor?.conversations.pullEvents() ?? []));
      roomCallChanges.push(...(floor?.roomCalls.update(new Map()) ?? []));
      this.registry.close(floorId);
    }

    this.events.publish([...changes, ...roomCallChanges]);
    await this.media.apply(changes);
    await this.media.applyRoomCalls(roomCallChanges);
  }
}
