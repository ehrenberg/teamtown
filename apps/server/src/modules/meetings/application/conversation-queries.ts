import type { Conversation } from '../domain/floor-conversations.ts';
import type { RoomCall } from '../domain/room-calls.ts';
import type { ConversationRegistry } from './conversation-registry.ts';

export class ConversationQueries {
  constructor(private readonly registry: ConversationRegistry) {}

  onFloor(floorId: string): Conversation[] {
    return this.registry.get(floorId)?.conversations.all() ?? [];
  }

  roomCallsOn(floorId: string): RoomCall[] {
    return this.registry.get(floorId)?.roomCalls.all() ?? [];
  }
}
