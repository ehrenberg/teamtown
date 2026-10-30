import type { MeetingLogProps } from '../domain/meeting-log.ts';
import type { MeetingLogRepository } from './ports/meeting-log-repository.port.ts';

export interface MeetingLogView extends Omit<MeetingLogProps, 'consents'> {
  readonly participants: readonly string[];
}

/** Use case: the logs one took part in (as host or after consenting). Admins have no way to read logs. */
export class ListMyMeetingLogs {
  constructor(private readonly repository: MeetingLogRepository) {}

  async execute(personId: string): Promise<MeetingLogView[]> {
    const logs = await this.repository.listForParticipant(personId);
    return logs.map(({ props: { consents, ...rest } }) => ({
      ...rest,
      participants: consents.map((consent) => consent.personId),
    }));
  }
}
