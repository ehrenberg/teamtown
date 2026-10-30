import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { MeetingLog } from './meeting-log.ts';

const NOW = new Date('2026-10-30T10:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const aLog = () =>
  unwrap(
    MeetingLog.start({
      meetingId: 'm1',
      floorId: 'ground',
      roomId: 'elbe',
      title: '  Sprint review  ',
      hostId: 'anna',
      now: NOW,
      retentionDays: 90,
    }),
  );

describe('MeetingLog', () => {
  it('starts with the host as the first consenting participant', () => {
    expect(aLog().props).toEqual({
      meetingId: 'm1',
      floorId: 'ground',
      roomId: 'elbe',
      title: 'Sprint review',
      hostId: 'anna',
      consents: [{ personId: 'anna', consentedAt: NOW }],
      startedAt: NOW,
      endedAt: null,
      expiresAt: new Date(NOW.getTime() + 90 * DAY_MS),
    });
  });

  it('rejects empty or overlong titles', () => {
    const start = (title: string) =>
      MeetingLog.start({ meetingId: 'm1', floorId: 'g', roomId: 'r', title, hostId: 'a', now: NOW, retentionDays: 90 });

    expect(start('   ')).toEqual({ ok: false, error: 'invalid-title' });
    expect(start('x'.repeat(121))).toEqual({ ok: false, error: 'invalid-title' });
  });

  it('records each consent once', () => {
    const log = aLog();
    const later = new Date(NOW.getTime() + 60_000);

    log.consent('ben', later);
    log.consent('ben', new Date(NOW.getTime() + 120_000));

    expect(log.props.consents).toEqual([
      { personId: 'anna', consentedAt: NOW },
      { personId: 'ben', consentedAt: later },
    ]);
    expect(log.isParticipant('ben')).toBe(true);
    expect(log.isParticipant('carl')).toBe(false);
  });

  it('lets only the host end it, once', () => {
    const log = aLog();
    const end = new Date(NOW.getTime() + 3_600_000);

    expect(log.end('ben', end)).toEqual({ ok: false, error: 'not-meeting-host' });
    expect(log.end('anna', end)).toEqual({ ok: true, value: undefined });
    expect(log.props.endedAt).toEqual(end);
    expect(log.end('anna', new Date(end.getTime() + 1))).toEqual({ ok: true, value: undefined });
    expect(log.props.endedAt).toEqual(end);
  });

  it('ends without a host when the room empties', () => {
    const log = aLog();

    log.endBecauseEmpty(NOW);

    expect(log.isActive).toBe(false);
  });
});
