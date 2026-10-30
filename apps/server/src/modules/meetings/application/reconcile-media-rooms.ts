import type { ConversationMedia } from './conversation-media.ts';
import type { ConversationRegistry } from './conversation-registry.ts';
import { conversationRoomName, roomCallRoomName } from './ports/media-gateway.port.ts';

export class ReconcileMediaRooms {
  constructor(
    private readonly registry: ConversationRegistry,
    private readonly media: ConversationMedia,
  ) {}

  async execute(): Promise<void> {
    const active = new Map<string, readonly string[]>();
    for (const floorId of this.registry.runningFloorIds()) {
      const floor = this.registry.get(floorId);
      for (const conversation of floor?.conversations.all() ?? []) {
        active.set(conversationRoomName(conversation.conversationId), conversation.participants);
      }
      for (const roomCall of floor?.roomCalls.all() ?? []) {
        active.set(roomCallRoomName(floorId, roomCall.roomId), roomCall.participants);
      }
    }
    await this.media.reconcile(active);
  }
}
