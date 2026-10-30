import type { MeetingLog } from '../../domain/meeting-log.ts';

/** The only persistence of the Meetings context: logged meetings, after explicit consent (ADR-0026/0027). */
export interface MeetingLogRepository {
  save(log: MeetingLog): Promise<void>;
  findById(meetingId: string): Promise<MeetingLog | null>;
  /** Logs the person consented to (as host or participant), newest first. */
  listForParticipant(personId: string): Promise<MeetingLog[]>;
  delete(meetingId: string): Promise<void>;
  /** Deletes logs whose retention ran out; returns how many. */
  deleteExpired(now: Date): Promise<number>;
}

export const MEETING_LOG_REPOSITORY = Symbol('MEETING_LOG_REPOSITORY');
