import { err, ok, type Result } from '@teamtown/kernel';

export interface Consent {
  readonly personId: string;
  readonly consentedAt: Date;
}

export interface MeetingLogProps {
  readonly meetingId: string;
  readonly floorId: string;
  readonly roomId: string;
  readonly title: string;
  readonly hostId: string;
  readonly consents: readonly Consent[];
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly expiresAt: Date;
}

export type MeetingLogError = 'invalid-title' | 'not-meeting-host';

const MAX_TITLE_LENGTH = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A logged meeting (ADR-0026, ADR-0027): the one persisted Meetings aggregate. It only exists because someone
 * explicitly started it, and only people with a recorded consent are its participants.
 */
export class MeetingLog {
  private constructor(private state: MeetingLogProps) {}

  static start(input: {
    meetingId: string;
    floorId: string;
    roomId: string;
    title: string;
    hostId: string;
    now: Date;
    retentionDays: number;
  }): Result<MeetingLog, 'invalid-title'> {
    const title = input.title.trim();
    if (title.length === 0 || title.length > MAX_TITLE_LENGTH) return err('invalid-title');
    return ok(
      new MeetingLog({
        meetingId: input.meetingId,
        floorId: input.floorId,
        roomId: input.roomId,
        title,
        hostId: input.hostId,
        // Starting a logged meeting is the host's consent.
        consents: [{ personId: input.hostId, consentedAt: input.now }],
        startedAt: input.now,
        endedAt: null,
        expiresAt: new Date(input.now.getTime() + input.retentionDays * DAY_MS),
      }),
    );
  }

  /** Restores a stored log; it was valid when it was saved. */
  static restore(props: MeetingLogProps): MeetingLog {
    return new MeetingLog(props);
  }

  get props(): MeetingLogProps {
    return this.state;
  }

  get isActive(): boolean {
    return this.state.endedAt === null;
  }

  isParticipant(personId: string): boolean {
    return this.state.consents.some((consent) => consent.personId === personId);
  }

  consent(personId: string, now: Date): void {
    if (this.isParticipant(personId)) return;
    this.state = { ...this.state, consents: [...this.state.consents, { personId, consentedAt: now }] };
  }

  end(personId: string, now: Date): Result<void, 'not-meeting-host'> {
    if (personId !== this.state.hostId) return err('not-meeting-host');
    this.endBecauseEmpty(now);
    return ok(undefined);
  }

  endBecauseEmpty(now: Date): void {
    if (this.isActive) this.state = { ...this.state, endedAt: now };
  }
}
