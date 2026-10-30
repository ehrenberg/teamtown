import type { Clock } from '@teamtown/kernel';
import type { MeetingLogRepository } from './ports/meeting-log-repository.port.ts';

/** Runs daily: deletes logs whose retention ran out (ADR-0027). */
export class PurgeExpiredMeetingLogs {
  constructor(
    private readonly repository: MeetingLogRepository,
    private readonly clock: Clock,
  ) {}

  execute(): Promise<number> {
    return this.repository.deleteExpired(this.clock.now());
  }
}
