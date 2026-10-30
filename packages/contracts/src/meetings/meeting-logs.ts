import { z } from 'zod';
import { PersonId } from '../people/me.ts';

/** A logged meeting as its participants see it (ADR-0026/0027). Times are ISO 8601. */
export const MeetingLogSchema = z.object({
  meetingId: z.string().min(1).max(64),
  floorId: z.string().min(1).max(64),
  roomId: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  hostId: PersonId,
  participants: z.array(z.object({ personId: PersonId, displayName: z.string() })),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime(),
});
export type MeetingLogContract = z.infer<typeof MeetingLogSchema>;

/** `GET /api/meeting-logs`: the logs one took part in, newest first. */
export const MeetingLogListResponse = z.object({ logs: z.array(MeetingLogSchema) });
export type MeetingLogListResponse = z.infer<typeof MeetingLogListResponse>;
