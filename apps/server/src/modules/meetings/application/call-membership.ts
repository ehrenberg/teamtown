import type { CallKey } from '../domain/cameras.ts';
import type { DirectCalls } from '../domain/direct-calls.ts';
import type { ConversationRegistry } from './conversation-registry.ts';
import { conversationRoomName, directCallRoomName, roomCallRoomName } from './ports/media-gateway.port.ts';

/** Which conversation or call a person is in, named like its LiveKit room. A direct call comes first. */
export class CallMembership {
  constructor(
    private readonly registry: ConversationRegistry,
    private readonly calls: DirectCalls,
  ) {}

  callKeyOf(personId: string): CallKey | null {
    const direct = this.calls.callOf(personId);
    if (direct) return directCallRoomName(direct.callId);
    for (const floorId of this.registry.runningFloorIds()) {
      const floor = this.registry.get(floorId);
      const conversation = floor?.conversations.conversationOf(personId);
      if (conversation) return conversationRoomName(conversation.conversationId);
      const roomCall = floor?.roomCalls.all().find((call) => call.participants.includes(personId));
      if (roomCall) return roomCallRoomName(floorId, roomCall.roomId);
    }
    return null;
  }
}
