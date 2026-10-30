import type { Clock } from '@teamtown/kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { KNOCK_TIMEOUT_MS, Knocks } from '../domain/knocks.ts';
import { AnswerKnock } from './answer-knock.ts';
import { CancelKnock } from './cancel-knock.ts';
import { ExpireKnocks } from './expire-knocks.ts';
import { KnockOnRoom } from './knock-on-room.ts';
import { MeetingsEventStream, type MeetingsEvent } from './meetings-event-stream.ts';
import type { DoorMode, LivePresence } from './ports/live-presence.port.ts';

const NOW = new Date('2026-10-30T12:00:00Z').getTime();

function setup() {
  let now = NOW;
  const clock: Clock = { now: () => new Date(now) };
  /** personId → room on the ground floor (`null`: in no room). */
  const people = new Map<string, string | null>([
    ['ben', 'elbe'],
    ['mia', 'elbe'],
    ['lena', null],
  ]);
  const doorModes = new Map<string, DoorMode>([
    ['elbe', 'knock'],
    ['alster', 'open'],
  ]);
  const presence: LivePresence = {
    occupiedFloorIds: () => ['ground'],
    positionsOn: () => [],
    floorOf: (personId) => (people.has(personId) ? 'ground' : null),
    roomOf: (personId) => people.get(personId) ?? null,
    occupantsOf: (_, roomId) => [...people].filter(([, room]) => room === roomId).map(([personId]) => personId),
    doorModeOf: (_, roomId) => doorModes.get(roomId) ?? null,
  };
  const admitted: string[] = [];
  const knocks = new Knocks(() => 'k-1');
  const events = new MeetingsEventStream();
  const published: MeetingsEvent[] = [];
  events.subscribe((event) => published.push(event));
  return {
    people,
    doorModes,
    admitted,
    published,
    advance: (ms: number) => {
      now += ms;
    },
    knock: new KnockOnRoom(presence, knocks, events, clock),
    answer: new AnswerKnock(
      presence,
      {
        admit: (personId, floorId, roomId) => {
          admitted.push(`${personId}@${floorId}/${roomId}`);
        },
        requireConsent: () => undefined,
        walkOut: () => undefined,
      },
      knocks,
      events,
    ),
    cancel: new CancelKnock(presence, knocks, events),
    expire: new ExpireKnocks(presence, knocks, events, clock),
  };
}

describe('knock use cases', () => {
  let s: ReturnType<typeof setup>;

  beforeEach(() => {
    s = setup();
  });

  it('shows a knock to everyone inside and to the requester', () => {
    expect(s.knock.execute({ personId: 'lena', roomId: 'elbe' }).ok).toBe(true);
    expect(s.published).toEqual([
      {
        type: 'KnockRequested',
        knock: {
          knockId: 'k-1',
          floorId: 'ground',
          roomId: 'elbe',
          requester: 'lena',
          expiresAt: NOW + KNOCK_TIMEOUT_MS,
        },
        recipients: ['ben', 'mia', 'lena'],
      },
    ]);
  });

  it('needs no knock for open, empty or own rooms, and none at all for locked rooms', () => {
    s.people.set('ben', 'alster');

    expect(s.knock.execute({ personId: 'lena', roomId: 'alster' })).toEqual({ ok: false, error: 'knock-not-needed' });
    expect(s.knock.execute({ personId: 'mia', roomId: 'elbe' })).toEqual({ ok: false, error: 'knock-not-needed' });
    s.doorModes.set('elbe', 'locked');
    expect(s.knock.execute({ personId: 'lena', roomId: 'elbe' })).toEqual({ ok: false, error: 'door-closed' });
    expect(s.knock.execute({ personId: 'lena', roomId: 'nowhere' })).toEqual({ ok: false, error: 'room-not-found' });
  });

  it('lets an occupant admit, counts only the first answer and walks the requester in', () => {
    s.knock.execute({ personId: 'lena', roomId: 'elbe' });

    expect(s.answer.execute({ personId: 'ben', knockId: 'k-1', admit: true }).ok).toBe(true);
    expect(s.answer.execute({ personId: 'mia', knockId: 'k-1', admit: false })).toEqual({
      ok: false,
      error: 'knock-not-found',
    });
    expect(s.published.at(-1)).toMatchObject({ type: 'KnockAnswered', outcome: 'admitted' });
    expect(s.admitted).toEqual(['lena@ground/elbe']);
  });

  it('only lets occupants answer', () => {
    s.people.set('carl', null);
    s.knock.execute({ personId: 'lena', roomId: 'elbe' });

    expect(s.answer.execute({ personId: 'carl', knockId: 'k-1', admit: true })).toEqual({
      ok: false,
      error: 'not-in-room',
    });
  });

  it('tells everyone when a knock is declined', () => {
    s.knock.execute({ personId: 'lena', roomId: 'elbe' });
    s.answer.execute({ personId: 'mia', knockId: 'k-1', admit: false });

    expect(s.published.at(-1)).toMatchObject({
      type: 'KnockAnswered',
      outcome: 'declined',
      recipients: ['ben', 'mia', 'lena'],
    });
    expect(s.admitted).toEqual([]);
  });

  it('lets only the requester cancel', () => {
    s.knock.execute({ personId: 'lena', roomId: 'elbe' });

    expect(s.cancel.execute({ personId: 'ben', knockId: 'k-1' })).toEqual({ ok: false, error: 'knock-not-found' });
    expect(s.cancel.execute({ personId: 'lena', knockId: 'k-1' }).ok).toBe(true);
    expect(s.published.at(-1)).toMatchObject({ type: 'KnockAnswered', outcome: 'cancelled' });
  });

  it('expires unanswered knocks after a minute', () => {
    s.knock.execute({ personId: 'lena', roomId: 'elbe' });
    s.advance(KNOCK_TIMEOUT_MS);
    s.expire.execute();
    expect(s.published).toHaveLength(1);

    s.advance(1);
    s.expire.execute();
    expect(s.published.at(-1)).toMatchObject({ type: 'KnockAnswered', outcome: 'expired' });
  });

  it('cancels knocks that became pointless', () => {
    s.knock.execute({ personId: 'lena', roomId: 'elbe' });
    s.people.set('ben', null).set('mia', null);
    s.expire.execute();

    expect(s.published.at(-1)).toMatchObject({ type: 'KnockAnswered', outcome: 'cancelled', recipients: ['lena'] });
  });
});
