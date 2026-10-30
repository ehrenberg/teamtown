import { AccessToken, RoomServiceClient, ServerError, TrackSource } from 'livekit-server-sdk';
import type { MediaGateway } from '../application/ports/media-gateway.port.ts';

export interface LiveKitConfig {
  readonly clientUrl: string;
  /** HTTP(S) URL of the LiveKit server API, as reachable from the TeamTown server. */
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly apiSecret: string;
}

/** Only needed to join; matches the grace period of locked conversations. */
const TOKEN_TTL_SECONDS = 30;

const isNotFound = (error: unknown): boolean => error instanceof ServerError && error.status === 404;

export class LiveKitMediaGateway implements MediaGateway {
  readonly clientUrl: string;
  readonly #rooms: RoomServiceClient;

  constructor(private readonly config: LiveKitConfig) {
    this.clientUrl = config.clientUrl;
    this.#rooms = new RoomServiceClient(config.apiUrl, config.apiKey, config.apiSecret);
  }

  async issueToken(roomName: string, personId: string): Promise<string> {
    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: personId,
      ttl: TOKEN_TTL_SECONDS,
    });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: false,
      canPublishSources: [TrackSource.MICROPHONE],
    });
    return token.toJwt();
  }

  async listRooms(): Promise<string[]> {
    return (await this.#rooms.listRooms()).map((room) => room.name);
  }

  async listParticipants(roomName: string): Promise<string[]> {
    try {
      return (await this.#rooms.listParticipants(roomName)).map((participant) => participant.identity);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  async removeParticipant(roomName: string, personId: string): Promise<void> {
    try {
      await this.#rooms.removeParticipant(roomName, personId);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  async closeRoom(roomName: string): Promise<void> {
    try {
      await this.#rooms.deleteRoom(roomName);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
}
