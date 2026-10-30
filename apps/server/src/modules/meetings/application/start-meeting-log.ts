import { err, ok, type Clock, type IdGenerator, type Result } from '@teamtown/kernel';
import { MeetingLog } from '../domain/meeting-log.ts';
import type { ActiveMeetingLogs } from './active-meeting-logs.ts';
import type { CallMembership } from './call-membership.ts';
import { meetingLogDetails } from './meeting-log-events.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { MeetingLogRepository } from './ports/meeting-log-repository.port.ts';
import type { RoomAdmission } from './ports/room-admission.port.ts';

export type StartMeetingLogError = 'no-room-call' | 'meeting-log-active' | 'invalid-title';

/**
 * Use case: start a logged meeting in the room call one is in (ADR-0026). Until M4 any occupant may; they become
 * its host, and starting counts as their consent. Everyone else is asked on the next tick.
 */
export class StartMeetingLog {
  constructor(
    private readonly membership: CallMembership,
    private readonly active: ActiveMeetingLogs,
    private readonly repository: MeetingLogRepository,
    private readonly admission: RoomAdmission,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly retentionDays: number,
  ) {}

  async execute(input: { personId: string; title: string }): Promise<Result<void, StartMeetingLogError>> {
    const callKey = this.membership.callKeyOf(input.personId);
    if (!callKey?.startsWith('room:')) return err('no-room-call');
    const [, floorId = '', roomId = ''] = callKey.split(':');
    if (this.active.get(floorId, roomId)) return err('meeting-log-active');

    const log = MeetingLog.start({
      meetingId: this.ids.next(),
      floorId,
      roomId,
      title: input.title,
      hostId: input.personId,
      now: this.clock.now(),
      retentionDays: this.retentionDays,
    });
    if (!log.ok) return log;
    await this.repository.save(log.value);
    this.active.add(log.value);
    this.admission.requireConsent(floorId, roomId, true);
    this.events.publish([
      { type: 'MeetingLogChanged', floorId, roomId, active: true },
      { type: 'MeetingLogDetails', roomId, details: meetingLogDetails(log.value), recipients: [input.personId] },
    ]);
    return ok(undefined);
  }
}
