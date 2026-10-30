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

/** Start a logged meeting in the room call one is in (ADR-0026); one becomes its host. */
export const StartMeetingLogCommand = z.object({
  t: z.literal('StartMeetingLog'),
  id: CorrelationId.optional(),
  p: z.object({ title: z.string().min(1).max(120) }),
});

/** Only the host ends the log; the call goes on unlogged. */
export const EndMeetingLogCommand = z.object({
  t: z.literal('EndMeetingLog'),
  id: CorrelationId.optional(),
  p: z.object({}),
});

/** Join (consent) or decline a logged meeting, from inside the room or before walking in (ADR-0027). */
export const AnswerMeetingLogCommand = z.object({
  t: z.literal('AnswerMeetingLog'),
  id: CorrelationId.optional(),
  p: z.object({ roomId: RoomId, join: z.boolean() }),
});

/** Sent to everyone on the floor: whether a room's meeting is logged (no title, no participants). */
export const MeetingLogChangedEvent = z.object({
  t: z.literal('MeetingLogChanged'),
  p: z.object({ floorId: FloorId, roomId: RoomId, active: z.boolean() }),
});

/** Sent to the people in the logged meeting: its details, or `null` once it ended. */
export const MeetingLogDetailsEvent = z.object({
  t: z.literal('MeetingLogDetails'),
  p: z.object({
    roomId: RoomId,
    details: z.object({ meetingId: z.string().min(1).max(64), title: z.string(), hostId: PersonId }).nullable(),
  }),
});

/** Sent to someone inside a logged room who hasn't consented yet. */
export const MeetingLogConsentRequestedEvent = z.object({
  t: z.literal('MeetingLogConsentRequested'),
  p: z.object({ roomId: RoomId, title: z.string() }),
});
