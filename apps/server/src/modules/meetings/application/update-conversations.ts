import type { Clock } from '@teamtown/kernel';
import type { ConversationEvent } from '../domain/floor-conversations.ts';
import type { ConversationMedia } from './conversation-media.ts';
import type { ConversationRegistry } from './conversation-registry.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';

export class UpdateConversations {
  constructor(
    private readonly presence: LivePresence,
    private readonly registry: ConversationRegistry,
    private readonly media: ConversationMedia,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<void> {
    const now = this.clock.now().getTime();
    const occupied = new Set(this.presence.occupiedFloorIds());
    const changes: ConversationEvent[] = [];

    for (const floorId of occupied) {
      const floor = await this.registry.open(floorId);
      if (!floor) continue;
      const listeners = this.presence
        .positionsOn(floorId)
        .filter(({ position }) => !floor.acoustics.isIsolated(position));
      floor.conversations.update(listeners, now);
      changes.push(...floor.conversations.pullEvents());
    }

    for (const floorId of this.registry.runningFloorIds()) {
      if (occupied.has(floorId)) continue;
      const floor = this.registry.get(floorId);
      floor?.conversations.update([], now);
      changes.push(...(floor?.conversations.pullEvents() ?? []));
      this.registry.close(floorId);
    }

    this.events.publish(changes);
    await this.media.apply(changes);
  }
}
