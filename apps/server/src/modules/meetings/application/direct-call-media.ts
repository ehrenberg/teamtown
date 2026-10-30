import type { DirectCallEvent } from '../domain/direct-calls.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import { directCallRoomName, type MediaGateway } from './ports/media-gateway.port.ts';

/**
 * Keeps the LiveKit room of each direct call in line with its participants: only they get a token, and whoever
 * leaves is removed at once. Without a media gateway every method does nothing.
 */
export class DirectCallMedia {
  constructor(
    private readonly gateway: MediaGateway | null,
    private readonly events: MeetingsEventStream,
  ) {}

  async apply(events: readonly DirectCallEvent[]): Promise<void> {
    for (const event of events) {
      if (event.type === 'DirectCallEnded') {
        await this.gateway?.closeRoom(directCallRoomName(event.callId));
      } else if (event.type === 'DirectCallChanged') {
        const room = directCallRoomName(event.call.callId);
        for (const personId of event.left) await this.gateway?.removeParticipant(room, personId);
        for (const personId of event.joined) {
          const access = await this.tokenFor(event.call.callId, personId);
          if (access) {
            this.events.publish([{ type: 'DirectCallAccessGranted', personId, callId: event.call.callId, ...access }]);
          }
        }
      }
    }
  }

  async tokenFor(callId: string, personId: string): Promise<{ url: string; token: string } | null> {
    if (!this.gateway) return null;
    return { url: this.gateway.clientUrl, token: await this.gateway.issueToken(directCallRoomName(callId), personId) };
  }
}
