import type { Clock } from '@teamtown/kernel';
import type { ActiveMeetingLogs } from './active-meeting-logs.ts';
import { meetingLogEndedEvents } from './meeting-log-events.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';
import type { MeetingLogRepository } from './ports/meeting-log-repository.port.ts';
import type { RoomAdmission } from './ports/room-admission.port.ts';

/**
 * Runs on a short tick: asks everyone inside who hasn't consented yet (they stay out of the call meanwhile), and
 * ends logs of rooms that became empty.
 */
export class UpdateMeetingLogs {
  constructor(
    private readonly presence: LivePresence,
    private readonly active: ActiveMeetingLogs,
    private readonly repository: MeetingLogRepository,
    private readonly admission: RoomAdmission,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<void> {
    for (const { log, pending } of this.active.all()) {
      const { floorId, roomId } = log.props;
      const occupants = this.presence.occupantsOf(floorId, roomId);
      if (occupants.length === 0) {
        log.endBecauseEmpty(this.clock.now());
        await this.repository.save(log);
        this.active.remove(floorId, roomId);
        this.admission.requireConsent(floorId, roomId, false);
        this.events.publish(meetingLogEndedEvents(floorId, roomId, []));
        continue;
      }
      for (const personId of [...pending]) if (!occupants.includes(personId)) pending.delete(personId);
      const asked = occupants.filter((personId) => !log.isParticipant(personId) && !pending.has(personId));
      for (const personId of asked) pending.add(personId);
      if (asked.length > 0) {
        this.events.publish([
          { type: 'MeetingLogConsentRequested', roomId, title: log.props.title, recipients: asked },
        ]);
      }
    }
  }
}
