import { err, ok, type Result } from '@teamtown/kernel';
import type { ConversationMedia } from './conversation-media.ts';
import type { ConversationRegistry } from './conversation-registry.ts';
import type { LivePresence } from './ports/live-presence.port.ts';

export type RoomCallTokenError = 'not-in-room' | 'media-unavailable';

/** Use case: a fresh room-call token for an occupant, e.g. after a reconnect. */
export class RequestRoomCallToken {
  constructor(
    private readonly presence: LivePresence,
    private readonly registry: ConversationRegistry,
    private readonly media: ConversationMedia,
  ) {}

  async execute(input: {
    personId: string;
    roomId: string;
  }): Promise<Result<{ url: string; token: string }, RoomCallTokenError>> {
    const floorId = this.presence.floorOf(input.personId);
    const roomCall = floorId ? this.registry.get(floorId)?.roomCalls.get(input.roomId) : null;
    if (!floorId || !roomCall?.participants.includes(input.personId)) return err('not-in-room');
    const access = await this.media.roomCallTokenFor(floorId, input.roomId, input.personId);
    return access ? ok(access) : err('media-unavailable');
  }
}
