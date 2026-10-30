import { err, ok, type Result } from '@teamtown/kernel';

export interface Invitation {
  readonly personId: string;
  readonly invitedBy: string;
  readonly ringsUntil: number;
}

export interface DirectCall {
  readonly callId: string;
  /** In the order they joined. */
  readonly participants: readonly string[];
  readonly invitations: readonly Invitation[];
}

export type InvitationOutcome = 'accepted' | 'declined' | 'no-answer' | 'busy' | 'cancelled';

/** Every event names its `recipients`: the participants and invitees it concerns. */
export type DirectCallEvent =
  | {
      readonly type: 'DirectCallChanged';
      readonly call: DirectCall;
      readonly joined: readonly string[];
      readonly left: readonly string[];
      readonly recipients: readonly string[];
    }
  | {
      readonly type: 'DirectCallEnded';
      readonly callId: string;
      /** Participants who were still in the call when it ended. */
      readonly left: readonly string[];
      readonly recipients: readonly string[];
    }
  | {
      readonly type: 'CallInvitationAnswered';
      readonly callId: string;
      readonly personId: string;
      readonly outcome: InvitationOutcome;
      readonly recipients: readonly string[];
    };

export type DirectCallError =
  'cannot-call-yourself' | 'already-in-call' | 'busy' | 'call-not-found' | 'not-in-call' | 'call-full';

export const RING_TIMEOUT_MS = 30_000;
export const MAX_CALL_SIZE = 8;

interface CallState {
  callId: string;
  participants: string[];
  invitations: Invitation[];
  /** Once two people talked, the call ends when fewer than two are left. */
  connected: boolean;
}

const snapshot = (call: CallState): DirectCall => ({
  callId: call.callId,
  participants: [...call.participants],
  invitations: [...call.invitations],
});

const everyoneIn = (call: CallState, ...also: string[]): string[] => [
  ...new Set([...call.participants, ...call.invitations.map((i) => i.personId), ...also]),
];

/**
 * Direct calls of the whole town (C8). In memory only: who called whom is never persisted or logged (ADR-0012).
 * A person is in at most one call or invitation at a time.
 */
export class DirectCalls {
  readonly #calls = new Map<string, CallState>();
  #events: DirectCallEvent[] = [];

  constructor(private readonly newId: () => string) {}

  start(caller: string, callee: string, now: number): Result<DirectCall, DirectCallError> {
    if (caller === callee) return err('cannot-call-yourself');
    if (this.isBusy(caller)) return err('already-in-call');
    if (this.isBusy(callee)) return err('busy');
    const call: CallState = {
      callId: this.newId(),
      participants: [caller],
      invitations: [{ personId: callee, invitedBy: caller, ringsUntil: now + RING_TIMEOUT_MS }],
      connected: false,
    };
    this.#calls.set(call.callId, call);
    this.#changed(call, [caller], []);
    return ok(snapshot(call));
  }

  invite(callId: string, by: string, personId: string, now: number): Result<DirectCall, DirectCallError> {
    const call = this.#calls.get(callId);
    if (!call) return err('call-not-found');
    if (!call.participants.includes(by)) return err('not-in-call');
    if (by === personId) return err('cannot-call-yourself');
    if (call.participants.length + call.invitations.length >= MAX_CALL_SIZE) return err('call-full');
    if (this.isBusy(personId)) return err('busy');
    call.invitations.push({ personId, invitedBy: by, ringsUntil: now + RING_TIMEOUT_MS });
    this.#changed(call, [], []);
    return ok(snapshot(call));
  }

  answer(callId: string, personId: string, accept: boolean): Result<DirectCall | null, DirectCallError> {
    const call = this.#calls.get(callId);
    if (!call?.invitations.some((i) => i.personId === personId)) return err('call-not-found');
    this.#closeInvitation(call, personId, accept ? 'accepted' : 'declined');
    if (accept) {
      call.participants.push(personId);
      if (call.participants.length >= 2) call.connected = true;
      this.#changed(call, [personId], []);
    }
    return ok(this.#endIfOver(call) ? null : snapshot(call));
  }

  leave(callId: string, personId: string): Result<void, DirectCallError> {
    const call = this.#calls.get(callId);
    if (!call) return err('call-not-found');
    if (!call.participants.includes(personId)) return err('not-in-call');
    call.participants = call.participants.filter((id) => id !== personId);
    this.#changed(call, [], [personId], [personId]);
    this.#endIfOver(call);
    return ok(undefined);
  }

  /** Someone went offline: they leave their call, or their phone stops ringing. */
  personGone(personId: string): void {
    for (const call of [...this.#calls.values()]) {
      if (call.participants.includes(personId)) this.leave(call.callId, personId);
      else if (call.invitations.some((i) => i.personId === personId)) {
        this.#closeInvitation(call, personId, 'no-answer');
        this.#endIfOver(call);
      }
    }
  }

  expire(now: number): void {
    for (const call of [...this.#calls.values()]) {
      for (const invitation of call.invitations.filter((i) => i.ringsUntil < now)) {
        this.#closeInvitation(call, invitation.personId, 'no-answer');
      }
      this.#endIfOver(call);
    }
  }

  get(callId: string): DirectCall | null {
    const call = this.#calls.get(callId);
    return call ? snapshot(call) : null;
  }

  all(): DirectCall[] {
    return [...this.#calls.values()].map(snapshot);
  }

  callOf(personId: string): DirectCall | null {
    const call = [...this.#calls.values()].find((c) => c.participants.includes(personId));
    return call ? snapshot(call) : null;
  }

  /** In a call (not merely being rung): the call replaces proximity and room-call audio. */
  isInCall(personId: string): boolean {
    return this.callOf(personId) !== null;
  }

  isBusy(personId: string): boolean {
    return [...this.#calls.values()].some(
      (call) => call.participants.includes(personId) || call.invitations.some((i) => i.personId === personId),
    );
  }

  pullEvents(): readonly DirectCallEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  #closeInvitation(call: CallState, personId: string, outcome: InvitationOutcome): void {
    const recipients = everyoneIn(call, personId);
    call.invitations = call.invitations.filter((i) => i.personId !== personId);
    this.#events.push({ type: 'CallInvitationAnswered', callId: call.callId, personId, outcome, recipients });
  }

  #changed(call: CallState, joined: string[], left: string[], alsoTell: string[] = []): void {
    this.#events.push({
      type: 'DirectCallChanged',
      call: snapshot(call),
      joined,
      left,
      recipients: everyoneIn(call, ...alsoTell),
    });
  }

  /** Returns whether the call ended. */
  #endIfOver(call: CallState): boolean {
    const over = call.connected
      ? call.participants.length < 2
      : call.participants.length === 0 || call.invitations.length === 0;
    if (!over) return false;
    for (const invitation of [...call.invitations]) this.#closeInvitation(call, invitation.personId, 'cancelled');
    this.#calls.delete(call.callId);
    this.#events.push({
      type: 'DirectCallEnded',
      callId: call.callId,
      left: [...call.participants],
      recipients: everyoneIn(call),
    });
    return true;
  }
}
