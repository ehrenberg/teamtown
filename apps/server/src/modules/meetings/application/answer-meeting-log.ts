import { err, ok, type Clock, type Result } from '@teamtown/kernel';
import type { ActiveMeetingLogs } from './active-meeting-logs.ts';
import { meetingLogDetails } from './meeting-log-events.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';
import type { MeetingLogRepository } from './ports/meeting-log-repository.port.ts';
import type { RoomAdmission } from './ports/room-admission.port.ts';

/** Use case: join (consent) or decline a logged meeting; from inside the room or before walking in (ADR-0027). */
export class AnswerMeetingLog {
  constructor(
    private readonly presence: LivePresence,
    private readonly active: ActiveMeetingLogs,
    private readonly repository: MeetingLogRepository,
    private readonly admission: RoomAdmission,
    private readonly events: MeetingsEventStream,
    private readonly clock: Clock,
  ) {}

  async execute(input: { personId: string; roomId: string; join: boolean }): Promise<Result<void, 'room-not-found'>> {
    const floorId = this.presence.floorOf(input.personId);
    const running = floorId ? this.active.get(floorId, input.roomId) : null;
    if (!floorId || !running) return err('room-not-found');
    const inside = this.presence.roomOf(input.personId) === input.roomId;
    running.pending.delete(input.personId);

    if (!input.join) {
      // Declining keeps the person out of the room; nothing about them is stored.
      if (inside) this.admission.walkOut(input.personId, floorId, input.roomId);
      return ok(undefined);
    }
    running.log.consent(input.personId, this.clock.now());
    await this.repository.save(running.log);
    if (!inside) this.admission.admit(input.personId, floorId, input.roomId);
    this.events.publish([
      {
        type: 'MeetingLogDetails',
        roomId: input.roomId,
        details: meetingLogDetails(running.log),
        recipients: [input.personId],
      },
    ]);
    return ok(undefined);
  }
}
