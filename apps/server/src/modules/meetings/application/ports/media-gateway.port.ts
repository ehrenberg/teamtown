/** Who may hear whom is decided by room membership: only participants get a token (ADR-0032). */
export interface MediaGateway {
  readonly clientUrl: string;
  issueToken(roomName: string, personId: string): Promise<string>;
  listRooms(): Promise<string[]>;
  /** Identities currently connected to the room (empty if the room doesn't exist). */
  listParticipants(roomName: string): Promise<string[]>;
  /** Removes a person from the room; does nothing if they aren't in it. */
  removeParticipant(roomName: string, personId: string): Promise<void>;
  /** Closes the room and disconnects everyone; does nothing if it doesn't exist. */
  closeRoom(roomName: string): Promise<void>;
}

/** Provided as `null` when the server runs without LiveKit (e.g. in tests): conversations work, audio doesn't. */
export const MEDIA_GATEWAY = Symbol('MEDIA_GATEWAY');

export const conversationRoomName = (conversationId: string): string => `conversation:${conversationId}`;

/** Room IDs are unique per floor only. */
export const roomCallRoomName = (floorId: string, roomId: string): string => `room:${floorId}:${roomId}`;

export const directCallRoomName = (callId: string): string => `direct:${callId}`;
