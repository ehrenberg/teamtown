import type { ConversationEvent } from '../domain/floor-conversations.ts';
import type { RoomCallChanged } from '../domain/room-calls.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import { conversationRoomName, roomCallRoomName, type MediaGateway } from './ports/media-gateway.port.ts';

interface MediaAccess {
  url: string;
  token: string;
}

/**
 * Keeps LiveKit rooms in line with conversations and room calls: only participants get a token, and whoever
 * leaves is removed at once. Without a media gateway (no LiveKit configured) every method does nothing.
 */
export class ConversationMedia {
  constructor(
    private readonly gateway: MediaGateway | null,
    private readonly events: MeetingsEventStream,
  ) {}

  get available(): boolean {
    return this.gateway !== null;
  }

  async apply(events: readonly ConversationEvent[]): Promise<void> {
    for (const event of events) {
      switch (event.type) {
        case 'ConversationFormed':
          await this.#grantConversation(event.conversation.conversationId, event.conversation.participants);
          break;
        case 'ConversationChanged': {
          const room = conversationRoomName(event.conversation.conversationId);
          // Revoke first: whoever left must not hear a single word more.
          for (const personId of event.left) await this.gateway?.removeParticipant(room, personId);
          await this.#grantConversation(event.conversation.conversationId, event.joined);
          break;
        }
        case 'ConversationDissolved':
          await this.gateway?.closeRoom(conversationRoomName(event.conversationId));
          break;
      }
    }
  }

  async applyRoomCalls(changes: readonly RoomCallChanged[]): Promise<void> {
    for (const { floorId, roomCall, joined, left } of changes) {
      const room = roomCallRoomName(floorId, roomCall.roomId);
      if (roomCall.participants.length === 0) {
        await this.gateway?.closeRoom(room);
        continue;
      }
      for (const personId of left) await this.gateway?.removeParticipant(room, personId);
      for (const personId of joined) {
        const access = await this.roomCallTokenFor(floorId, roomCall.roomId, personId);
        if (access)
          this.events.publish([{ type: 'RoomCallAccessGranted', personId, roomId: roomCall.roomId, ...access }]);
      }
    }
  }

  tokenFor(conversationId: string, personId: string): Promise<MediaAccess | null> {
    return this.#access(conversationRoomName(conversationId), personId);
  }

  roomCallTokenFor(floorId: string, roomId: string, personId: string): Promise<MediaAccess | null> {
    return this.#access(roomCallRoomName(floorId, roomId), personId);
  }

  /**
   * Removes anyone who isn't a participant, e.g. a client that reconnects with an old token. `active` maps
   * LiveKit room names of current conversations and room calls to their participants.
   */
  async reconcile(active: ReadonlyMap<string, readonly string[]>): Promise<void> {
    if (!this.gateway) return;
    for (const room of await this.gateway.listRooms()) {
      if (!room.startsWith('conversation:') && !room.startsWith('room:')) continue;
      const participants = active.get(room);
      if (!participants) {
        await this.gateway.closeRoom(room);
        continue;
      }
      for (const identity of await this.gateway.listParticipants(room)) {
        if (!participants.includes(identity)) await this.gateway.removeParticipant(room, identity);
      }
    }
  }

  async #access(roomName: string, personId: string): Promise<MediaAccess | null> {
    if (!this.gateway) return null;
    return { url: this.gateway.clientUrl, token: await this.gateway.issueToken(roomName, personId) };
  }

  async #grantConversation(conversationId: string, personIds: readonly string[]): Promise<void> {
    for (const personId of personIds) {
      const access = await this.tokenFor(conversationId, personId);
      if (access) {
        this.events.publish([{ type: 'ConversationAccessGranted', personId, conversationId, ...access }]);
      }
    }
  }
}
