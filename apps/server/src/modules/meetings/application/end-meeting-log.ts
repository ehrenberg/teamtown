import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { ActiveMeetingLogs } from './active-meeting-logs.ts';
import { meetingLogEndedEvents } from './meeting-log-events.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';
import type { MeetingLogRepository } from './ports/meeting-log-repository.port.ts';
import type { RoomAdmission } from './ports/room-admission.port.ts';

/** Use case: the host ends the log; the room call goes on unlogged. */
export class EndMeetingLog {
  constructor(
    private readonly presence: LivePresence,
    private readonly active: ActiveMeetingLogs,
    private readonly repository: MeetingLogRepository,
    private readonly admission: RoomAdmission,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
  ) {}

  async execute(input: { personId: string }): Promise<Result<void, 'not-meeting-host'>> {
    const floorId = this.presence.floorOf(input.personId);
    const roomId = this.presence.roomOf(input.personId);
    const running = floorId && roomId ? this.active.get(floorId, roomId) : null;
    if (!floorId || !roomId || !running) return err('not-meeting-host');
    const ended = running.log.end(input.personId, this.clock.now());
    if (!ended.ok) return ended;
    await this.repository.save(running.log);
    this.active.remove(floorId, roomId);
    this.admission.requireConsent(floorId, roomId, false);
    this.events.publish(meetingLogEndedEvents(floorId, roomId, this.presence.occupantsOf(floorId, roomId)));
    return ok(undefined);
  }
}
