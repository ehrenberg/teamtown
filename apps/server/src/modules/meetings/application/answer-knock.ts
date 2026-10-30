import { err, ok, type Result } from '@teamtown/kernel';
import type { Knocks } from '../domain/knocks.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';
import type { RoomAdmission } from './ports/room-admission.port.ts';

export type AnswerKnockError = 'knock-not-found' | 'not-in-room';

/** Use case: any occupant admits or declines a knock; the first answer counts (until M4, ADR-0031). */
export class AnswerKnock {
  constructor(
    private readonly presence: LivePresence,
    private readonly admission: RoomAdmission,
    private readonly knocks: Knocks,
    private readonly events: MeetingsEventStream,
  ) {}

  execute(input: { personId: string; knockId: string; admit: boolean }): Result<void, AnswerKnockError> {
    const knock = this.knocks.get(input.knockId);
    if (!knock) return err('knock-not-found');
    const inside =
      this.presence.floorOf(input.personId) === knock.floorId && this.presence.roomOf(input.personId) === knock.roomId;
    if (!inside) return err('not-in-room');

    this.knocks.close(knock.knockId);
    const recipients = [...this.presence.occupantsOf(knock.floorId, knock.roomId), knock.requester];
    const outcome = input.admit ? 'admitted' : 'declined';
    this.events.publish([{ type: 'KnockAnswered', knock, outcome, recipients }]);
    if (input.admit) this.admission.admit(knock.requester, knock.floorId, knock.roomId);
    return ok(undefined);
  }
}
