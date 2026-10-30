import { z } from 'zod';
import { AvatarColor, PersonId } from '../people/me.ts';
import { TileCoordSchema } from '../world/floor-plan.ts';
import {
  ConversationAccessGrantedEvent,
  ConversationChangedEvent,
  ConversationDissolvedEvent,
  ConversationFormedEvent,
  ConversationSchema,
  LockConversationCommand,
  RequestConversationTokenCommand,
  UnlockConversationCommand,
} from './conversations.ts';

/**
 * Realtime protocol (ADR-0007, docs/architecture/world-and-realtime.md §5).
 * Envelope `{ t, id?, p }`: commands go client → server, events go server → client.
 * Payloads only contain what the receiver may see.
 */
export const REALTIME_PROTOCOL_VERSION = 1;
/** WebSocket subprotocol announcing the protocol version during the handshake. */
export const REALTIME_SUBPROTOCOL = `teamtown.v${REALTIME_PROTOCOL_VERSION}`;
export const REALTIME_PATH = '/realtime';

const CorrelationId = z.string().min(1).max(64);
const FloorId = z.string().min(1).max(64);

// ---- Commands (client → server): imperative names ----

/** Must be the first command on a connection; send again with a refreshed token. */
export const AuthenticateCommand = z.object({
  t: z.literal('Authenticate'),
  id: CorrelationId.optional(),
  p: z.object({ accessToken: z.string().min(1).max(8192) }),
});

/** Clock sync: the client sends its local time and receives the server time back. */
export const PingCommand = z.object({
  t: z.literal('Ping'),
  id: CorrelationId.optional(),
  p: z.object({ clientTime: z.number() }),
});

/** Enter a floor (or switch floors). The server places the avatar at a spawn point. */
export const JoinFloorCommand = z.object({
  t: z.literal('JoinFloor'),
  id: CorrelationId.optional(),
  p: z.object({ floorId: FloorId }),
});

/** Walk to a tile on the current floor; the server computes and validates the path. */
export const MoveToCommand = z.object({
  t: z.literal('MoveTo'),
  id: CorrelationId.optional(),
  p: z.object({ target: TileCoordSchema }),
});

export const ClientCommand = z.discriminatedUnion('t', [
  AuthenticateCommand,
  PingCommand,
  JoinFloorCommand,
  MoveToCommand,
  LockConversationCommand,
  UnlockConversationCommand,
  RequestConversationTokenCommand,
]);
export type ClientCommand = z.infer<typeof ClientCommand>;

// ---- Events (server → client): past tense or state names ----

export const MovementSchema = z.object({
  from: TileCoordSchema,
  path: z.array(TileCoordSchema),
  /** Server time in ms since the epoch. */
  startedAt: z.number(),
  speedTilesPerSecond: z.number().positive(),
});

export const AvatarStateSchema = z.object({
  personId: PersonId,
  displayName: z.string(),
  avatarColor: AvatarColor,
  /** Where the avatar stands, or where its current movement started. */
  tile: TileCoordSchema,
  movement: MovementSchema.nullable(),
});
export type AvatarState = z.infer<typeof AvatarStateSchema>;

export const AuthenticatedEvent = z.object({
  t: z.literal('Authenticated'),
  p: z.object({ personId: PersonId, serverTime: z.number() }),
});

export const PongEvent = z.object({
  t: z.literal('Pong'),
  p: z.object({ clientTime: z.number(), serverTime: z.number() }),
});

/** Full state of a floor, sent after joining it. */
export const FloorSnapshotEvent = z.object({
  t: z.literal('FloorSnapshot'),
  p: z.object({
    floorId: FloorId,
    avatars: z.array(AvatarStateSchema),
    conversations: z.array(ConversationSchema),
  }),
});

export const AvatarJoinedEvent = z.object({
  t: z.literal('AvatarJoined'),
  p: z.object({ floorId: FloorId, avatar: AvatarStateSchema }),
});

export const AvatarLeftEvent = z.object({
  t: z.literal('AvatarLeft'),
  p: z.object({ floorId: FloorId, personId: PersonId }),
});

export const AvatarPathStartedEvent = z.object({
  t: z.literal('AvatarPathStarted'),
  p: z.object({ floorId: FloorId, personId: PersonId, movement: MovementSchema }),
});

export const AckEvent = z.object({
  t: z.literal('Ack'),
  p: z.object({ id: CorrelationId }),
});

/** Codes are stable and translated in the client (never human-readable text). */
export const NackCode = z.enum([
  'not-authenticated',
  'invalid-token',
  'unknown-floor',
  'not-on-floor',
  'unreachable',
  'conversation-not-found',
  'not-in-conversation',
  /** Audio is not configured on this server (no LiveKit). */
  'media-unavailable',
  'invalid-message',
  'internal-error',
]);
export type NackCode = z.infer<typeof NackCode>;

export const NackEvent = z.object({
  t: z.literal('Nack'),
  p: z.object({ id: CorrelationId.nullable(), code: NackCode }),
});

export const ServerEvent = z.discriminatedUnion('t', [
  AuthenticatedEvent,
  PongEvent,
  FloorSnapshotEvent,
  AvatarJoinedEvent,
  AvatarLeftEvent,
  AvatarPathStartedEvent,
  ConversationFormedEvent,
  ConversationChangedEvent,
  ConversationDissolvedEvent,
  ConversationAccessGrantedEvent,
  AckEvent,
  NackEvent,
]);
export type ServerEvent = z.infer<typeof ServerEvent>;
