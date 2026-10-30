import { z } from 'zod';
import { AvatarColor, PersonId } from '../people/me.ts';

const CorrelationId = z.string().min(1).max(64);
const FloorId = z.string().min(1).max(64);
export const CallId = z.string().min(1).max(64);

export const InvitationOutcome = z.enum(['accepted', 'declined', 'no-answer', 'busy', 'cancelled']);
export type InvitationOutcome = z.infer<typeof InvitationOutcome>;

export const CallInvitationSchema = z.object({
  personId: PersonId,
  invitedBy: PersonId,
  /** Server time in ms since the epoch. */
  ringsUntil: z.number(),
});

/** Only participants and invitees ever see a call: from outside, only "in a call" is visible. */
export const DirectCallSchema = z.object({
  callId: CallId,
  participants: z.array(PersonId),
  invitations: z.array(CallInvitationSchema),
});
export type DirectCallContract = z.infer<typeof DirectCallSchema>;

export const OnlinePersonSchema = z.object({
  personId: PersonId,
  displayName: z.string(),
  avatarColor: AvatarColor,
  floorId: FloorId,
});
export type OnlinePerson = z.infer<typeof OnlinePersonSchema>;

// ---- Commands ----

export const StartCallCommand = z.object({
  t: z.literal('StartCall'),
  id: CorrelationId.optional(),
  p: z.object({ personId: PersonId }),
});

export const InviteToCallCommand = z.object({
  t: z.literal('InviteToCall'),
  id: CorrelationId.optional(),
  p: z.object({ callId: CallId, personId: PersonId }),
});

export const AnswerCallCommand = z.object({
  t: z.literal('AnswerCall'),
  id: CorrelationId.optional(),
  p: z.object({ callId: CallId, accept: z.boolean() }),
});

export const LeaveCallCommand = z.object({
  t: z.literal('LeaveCall'),
  id: CorrelationId.optional(),
  p: z.object({ callId: CallId }),
});

export const RequestDirectCallTokenCommand = z.object({
  t: z.literal('RequestDirectCallToken'),
  id: CorrelationId.optional(),
  p: z.object({ callId: CallId }),
});

export const ListOnlinePeopleCommand = z.object({
  t: z.literal('ListOnlinePeople'),
  id: CorrelationId.optional(),
  p: z.object({}),
});

// ---- Events ----

/** Sent to participants and invitees whenever the call changes (also when it starts ringing). */
export const DirectCallChangedEvent = z.object({
  t: z.literal('DirectCallChanged'),
  p: z.object({ call: DirectCallSchema }),
});

export const DirectCallEndedEvent = z.object({
  t: z.literal('DirectCallEnded'),
  p: z.object({ callId: CallId }),
});

export const CallInvitationAnsweredEvent = z.object({
  t: z.literal('CallInvitationAnswered'),
  p: z.object({ callId: CallId, personId: PersonId, outcome: InvitationOutcome }),
});

/** Sent only to the participant it is for; the token is valid for 30 s. */
export const DirectCallAccessGrantedEvent = z.object({
  t: z.literal('DirectCallAccessGranted'),
  p: z.object({ callId: CallId, url: z.string().min(1), token: z.string().min(1).max(8192) }),
});

/** Sent to everyone on the person's floor. */
export const OnCallChangedEvent = z.object({
  t: z.literal('OnCallChanged'),
  p: z.object({ floorId: FloorId, personId: PersonId, onCall: z.boolean() }),
});

/** Answer to ListOnlinePeople, sent only to the requester. */
export const OnlinePeopleEvent = z.object({
  t: z.literal('OnlinePeople'),
  p: z.object({ people: z.array(OnlinePersonSchema) }),
});

/** Only inside a conversation or call; the camera goes off when that ends (ADR-0031). */
export const SetCameraCommand = z.object({
  t: z.literal('SetCamera'),
  id: CorrelationId.optional(),
  p: z.object({ on: z.boolean() }),
});

/** Sent to everyone on the person's floor; the picture itself only reaches the same call. */
export const CameraChangedEvent = z.object({
  t: z.literal('CameraChanged'),
  p: z.object({ floorId: FloorId, personId: PersonId, on: z.boolean() }),
});
