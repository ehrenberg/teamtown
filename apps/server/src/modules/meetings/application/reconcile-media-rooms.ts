import type { ConversationMedia } from './conversation-media.ts';
import type { ConversationRegistry } from './conversation-registry.ts';

export class ReconcileMediaRooms {
  constructor(
    private readonly registry: ConversationRegistry,
    private readonly media: ConversationMedia,
  ) {}

  async execute(): Promise<void> {
    const active = new Map<string, readonly string[]>();
    for (const floorId of this.registry.runningFloorIds()) {
      for (const conversation of this.registry.get(floorId)?.conversations.all() ?? []) {
        active.set(conversation.conversationId, conversation.participants);
      }
    }
    await this.media.reconcile(active);
  }
}
