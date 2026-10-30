import { z } from 'zod';
import { PersonId } from '../people/me.ts';
import { DoorMode } from '../world/floor-plan.ts';

const CorrelationId = z.string().min(1).max(64);
const FloorId = z.string().min(1).max(64);
export const RoomId = z.string().min(1).max(64);
export const KnockId = z.string().min(1).max(64);

export const LiveDoorModeSchema = z.object({ roomId: RoomId, doorMode: DoorMode });

/** Who is in a room's call; an empty list means the call ended. */
export const RoomCallSchema = z.object({ roomId: RoomId, participants: z.array(PersonId) });
export type RoomCallContract = z.infer<typeof RoomCallSchema>;

export const KnockOutcome = z.enum(['admitted', 'declined', 'expired', 'cancelled']);
export type KnockOutcome = z.infer<typeof KnockOutcome>;

// ---- Commands ----

/** Only occupants may change the door mode, and only in rooms whose door mode is adjustable. */
export const SetDoorModeCommand = z.object({
  t: z.literal('SetDoorMode'),
  id: CorrelationId.optional(),
  p: z.object({ roomId: RoomId, doorMode: DoorMode }),
});

export const KnockOnRoomCommand = z.object({
  t: z.literal('KnockOnRoom'),
  id: CorrelationId.optional(),
  p: z.object({ roomId: RoomId }),
});

export const CancelKnockCommand = z.object({
  t: z.literal('CancelKnock'),
  id: CorrelationId.optional(),
  p: z.object({ knockId: KnockId }),
});

export const AnswerKnockCommand = z.object({
  t: z.literal('AnswerKnock'),
  id: CorrelationId.optional(),
  p: z.object({ knockId: KnockId, admit: z.boolean() }),
});

export const RequestRoomCallTokenCommand = z.object({
  t: z.literal('RequestRoomCallToken'),
  id: CorrelationId.optional(),
  p: z.object({ roomId: RoomId }),
});

// ---- Events ----

export const DoorModeChangedEvent = z.object({
  t: z.literal('DoorModeChanged'),
  p: z.object({ floorId: FloorId, roomId: RoomId, doorMode: DoorMode }),
});

export const RoomCallChangedEvent = z.object({
  t: z.literal('RoomCallChanged'),
  p: z.object({ floorId: FloorId, roomCall: RoomCallSchema }),
});

/** Sent to the occupants of the room and to the requester. */
export const KnockRequestedEvent = z.object({
  t: z.literal('KnockRequested'),
  p: z.object({
    knockId: KnockId,
    floorId: FloorId,
    roomId: RoomId,
    requester: PersonId,
    /** Server time in ms since the epoch. */
    expiresAt: z.number(),
  }),
});

/** Sent to the occupants of the room and to the requester. */
export const KnockAnsweredEvent = z.object({
  t: z.literal('KnockAnswered'),
  p: z.object({ knockId: KnockId, roomId: RoomId, outcome: KnockOutcome }),
});

/** Sent only to the occupant it is for; the token is valid for 30 s. */
export const RoomCallAccessGrantedEvent = z.object({
  t: z.literal('RoomCallAccessGranted'),
  p: z.object({ roomId: RoomId, url: z.string().min(1), token: z.string().min(1).max(8192) }),
});
