import type { DirectCalls } from '../domain/direct-calls.ts';
import type { Conversation } from '../domain/floor-conversations.ts';
import type { RoomCall } from '../domain/room-calls.ts';
import type { ConversationRegistry } from './conversation-registry.ts';

export class ConversationQueries {
  constructor(
    private readonly registry: ConversationRegistry,
    private readonly calls: DirectCalls,
  ) {}

  onFloor(floorId: string): Conversation[] {
    return this.registry.get(floorId)?.conversations.all() ?? [];
  }

  /** Who is in a direct call; others may see that, but not with whom. */
  isInCall(personId: string): boolean {
    return this.calls.isInCall(personId);
  }

  roomCallsOn(floorId: string): RoomCall[] {
    return this.registry.get(floorId)?.roomCalls.all() ?? [];
  }
}
