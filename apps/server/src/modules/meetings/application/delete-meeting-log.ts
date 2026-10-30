import { err, ok, type Result } from '@teamtown/kernel';
import type { MeetingLogRepository } from './ports/meeting-log-repository.port.ts';

/** Use case: the host deletes a log before its retention runs out (ADR-0027). */
export class DeleteMeetingLog {
  constructor(private readonly repository: MeetingLogRepository) {}

  async execute(input: {
    personId: string;
    meetingId: string;
  }): Promise<Result<void, 'not-found' | 'not-meeting-host'>> {
    const log = await this.repository.findById(input.meetingId);
    // Someone who didn't take part learns nothing, not even that the log exists.
    if (!log?.isParticipant(input.personId)) return err('not-found');
    if (log.props.hostId !== input.personId) return err('not-meeting-host');
    await this.repository.delete(input.meetingId);
    return ok(undefined);
  }
}
