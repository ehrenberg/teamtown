import type { ConversationEvent } from '../domain/floor-conversations.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import { conversationRoomName, type MediaGateway } from './ports/media-gateway.port.ts';

/** Without a media gateway (no LiveKit configured) every method does nothing. */
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
          await this.#grant(event.conversation.conversationId, event.conversation.participants);
          break;
        case 'ConversationChanged': {
          const room = conversationRoomName(event.conversation.conversationId);
          // Revoke first: whoever left must not hear a single word more.
          for (const personId of event.left) await this.gateway?.removeParticipant(room, personId);
          await this.#grant(event.conversation.conversationId, event.joined);
          break;
        }
        case 'ConversationDissolved':
          await this.gateway?.closeRoom(conversationRoomName(event.conversationId));
          break;
      }
    }
  }

  async tokenFor(conversationId: string, personId: string): Promise<{ url: string; token: string } | null> {
    if (!this.gateway) return null;
    const token = await this.gateway.issueToken(conversationRoomName(conversationId), personId);
    return { url: this.gateway.clientUrl, token };
  }

  /** Removes anyone who isn't a participant, e.g. a client that reconnects with an old token. */
  async reconcile(active: ReadonlyMap<string, readonly string[]>): Promise<void> {
    if (!this.gateway) return;
    for (const room of await this.gateway.listRooms()) {
      const conversationId = room.startsWith('conversation:') ? room.slice('conversation:'.length) : null;
      if (conversationId === null) continue;
      const participants = active.get(conversationId);
      if (!participants) {
        await this.gateway.closeRoom(room);
        continue;
      }
      for (const identity of await this.gateway.listParticipants(room)) {
        if (!participants.includes(identity)) await this.gateway.removeParticipant(room, identity);
      }
    }
  }

  async #grant(conversationId: string, personIds: readonly string[]): Promise<void> {
    for (const personId of personIds) {
      const access = await this.tokenFor(conversationId, personId);
      if (access) {
        this.events.publish([{ type: 'ConversationAccessGranted', personId, conversationId, ...access }]);
      }
    }
  }
}
