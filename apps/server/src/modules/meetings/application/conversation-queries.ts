import type { Conversation } from '../domain/floor-conversations.ts';
import type { ConversationRegistry } from './conversation-registry.ts';

export class ConversationQueries {
  constructor(private readonly registry: ConversationRegistry) {}

  onFloor(floorId: string): Conversation[] {
    return this.registry.get(floorId)?.conversations.all() ?? [];
  }
}
