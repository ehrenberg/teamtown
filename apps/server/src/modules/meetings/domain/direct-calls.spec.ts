import { unwrap } from '@teamtown/kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { DirectCalls, MAX_CALL_SIZE, RING_TIMEOUT_MS } from './direct-calls.ts';

const NOW = 1_000_000;

describe('DirectCalls', () => {
  let calls: DirectCalls;

  beforeEach(() => {
    let next = 0;
    calls = new DirectCalls(() => `call-${++next}`);
  });

  const connected = () => {
    const call = unwrap(calls.start('anna', 'ben', NOW));
    unwrap(calls.answer(call.callId, 'ben', true));
    calls.pullEvents();
    return call.callId;
  };

  it('rings the callee', () => {
    const call = unwrap(calls.start('anna', 'ben', NOW));

    expect(call).toEqual({
      callId: 'call-1',
      participants: ['anna'],
      invitations: [{ personId: 'ben', invitedBy: 'anna', ringsUntil: NOW + RING_TIMEOUT_MS }],
    });
    expect(calls.pullEvents()).toEqual([
      { type: 'DirectCallChanged', call, joined: ['anna'], left: [], recipients: ['anna', 'ben'] },
    ]);
  });

  it('connects when the callee accepts', () => {
    const callId = connected();

    expect(calls.callOf('ben')?.participants).toEqual(['anna', 'ben']);
    expect(calls.isInCall('anna')).toBe(true);
    expect(callId).toBe('call-1');
  });

  it('tells the caller when the callee declines and ends the call', () => {
    const call = unwrap(calls.start('anna', 'ben', NOW));
    calls.pullEvents();

    unwrap(calls.answer(call.callId, 'ben', false));

    expect(calls.pullEvents()).toEqual([
      {
        type: 'CallInvitationAnswered',
        callId: 'call-1',
        personId: 'ben',
        outcome: 'declined',
        recipients: ['anna', 'ben'],
      },
      { type: 'DirectCallEnded', callId: 'call-1', left: ['anna'], recipients: ['anna'] },
    ]);
    expect(calls.isInCall('anna')).toBe(false);
  });

  it('stops ringing after 30 s', () => {
    unwrap(calls.start('anna', 'ben', NOW));
    calls.pullEvents();

    calls.expire(NOW + RING_TIMEOUT_MS);
    expect(calls.pullEvents()).toEqual([]);
    calls.expire(NOW + RING_TIMEOUT_MS + 1);

    expect(calls.pullEvents().map((e) => e.type === 'CallInvitationAnswered' && e.outcome)).toEqual([
      'no-answer',
      false,
    ]);
  });

  it('refuses calls to busy people, to oneself and from people already in a call', () => {
    connected();

    expect(calls.start('carl', 'ben', NOW)).toEqual({ ok: false, error: 'busy' });
    expect(calls.start('carl', 'carl', NOW)).toEqual({ ok: false, error: 'cannot-call-yourself' });
    expect(calls.start('anna', 'carl', NOW)).toEqual({ ok: false, error: 'already-in-call' });
    unwrap(calls.start('carl', 'dora', NOW));
    expect(calls.start('eve', 'dora', NOW)).toEqual({ ok: false, error: 'busy' });
  });

  it('lets any participant invite, up to eight people', () => {
    const callId = connected();

    expect(calls.invite(callId, 'ben', 'carl', NOW).ok).toBe(true);
    expect(calls.invite(callId, 'dora', 'eve', NOW)).toEqual({ ok: false, error: 'not-in-call' });
    for (let i = 4; i <= MAX_CALL_SIZE; i++) unwrap(calls.invite(callId, 'anna', `p${i}`, NOW));
    expect(calls.invite(callId, 'anna', 'too-many', NOW)).toEqual({ ok: false, error: 'call-full' });
  });

  it('ends the call when fewer than two participants are left, with its open invitations', () => {
    const callId = connected();
    unwrap(calls.invite(callId, 'anna', 'carl', NOW));
    calls.pullEvents();

    unwrap(calls.leave(callId, 'ben'));

    expect(calls.pullEvents().map((e) => e.type)).toEqual([
      'DirectCallChanged',
      'CallInvitationAnswered',
      'DirectCallEnded',
    ]);
    expect(calls.get(callId)).toBeNull();
    expect(calls.isBusy('carl')).toBe(false);
  });

  it('cancels a ringing call when the caller hangs up', () => {
    const call = unwrap(calls.start('anna', 'ben', NOW));
    calls.pullEvents();

    unwrap(calls.leave(call.callId, 'anna'));

    expect(calls.pullEvents()).toContainEqual({
      type: 'CallInvitationAnswered',
      callId: call.callId,
      personId: 'ben',
      outcome: 'cancelled',
      recipients: ['ben'],
    });
    expect(calls.get(call.callId)).toBeNull();
  });

  it('takes people who went offline out of their call', () => {
    const callId = connected();
    unwrap(calls.invite(callId, 'anna', 'carl', NOW));
    calls.pullEvents();

    calls.personGone('carl');
    calls.personGone('ben');

    expect(calls.get(callId)).toBeNull();
  });
});
