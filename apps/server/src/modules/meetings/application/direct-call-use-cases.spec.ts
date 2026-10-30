import type { Clock } from '@teamtown/kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import { DirectCalls, RING_TIMEOUT_MS } from '../domain/direct-calls.ts';
import { AnswerCall } from './answer-call.ts';
import { DirectCallMedia } from './direct-call-media.ts';
import { LeaveCall } from './leave-call.ts';
import { MeetingsEventStream, type MeetingsEvent } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';
import type { MediaGateway } from './ports/media-gateway.port.ts';
import { RequestDirectCallToken } from './request-direct-call-token.ts';
import { StartCall } from './start-call.ts';
import { UpdateDirectCalls } from './update-direct-calls.ts';

function setup() {
  let now = new Date('2026-10-30T12:00:00Z').getTime();
  const clock: Clock = { now: () => new Date(now) };
  const online = new Set(['anna', 'ben', 'carl']);
  const presence: LivePresence = {
    occupiedFloorIds: () => ['ground'],
    positionsOn: () => [],
    floorOf: (personId) => (online.has(personId) ? 'ground' : null),
    roomOf: () => null,
    occupantsOf: () => [],
    doorModeOf: () => null,
  };
  const removed: string[] = [];
  const closed: string[] = [];
  const gateway: MediaGateway = {
    clientUrl: 'ws://media.test',
    issueToken: (room, personId) => Promise.resolve(`token:${room}:${personId}`),
    listRooms: () => Promise.resolve([]),
    listParticipants: () => Promise.resolve([]),
    removeParticipant: (room, personId) => {
      removed.push(`${room}:${personId}`);
      return Promise.resolve();
    },
    closeRoom: (room) => {
      closed.push(room);
      return Promise.resolve();
    },
  };
  const calls = new DirectCalls(() => 'call-1');
  const events = new MeetingsEventStream();
  const published: MeetingsEvent[] = [];
  events.subscribe((event) => published.push(event));
  const media = new DirectCallMedia(gateway, events);
  return {
    online,
    removed,
    closed,
    published,
    advance: (ms: number) => {
      now += ms;
    },
    start: new StartCall(presence, calls, media, events, clock),
    answer: new AnswerCall(calls, media, events),
    leave: new LeaveCall(calls, media, events),
    update: new UpdateDirectCalls(presence, calls, media, events, clock),
    token: new RequestDirectCallToken(calls, media),
  };
}

describe('direct call use cases', () => {
  let s: ReturnType<typeof setup>;
  const grants = () => s.published.filter((e) => e.type === 'DirectCallAccessGranted').map((e) => e.personId);

  beforeEach(() => {
    s = setup();
  });

  it('only calls people who are online', async () => {
    expect(await s.start.execute({ personId: 'anna', callee: 'nobody' })).toEqual({
      ok: false,
      error: 'person-not-online',
    });
  });

  it('gives media tokens to participants as they join, never to the person being rung', async () => {
    await s.start.execute({ personId: 'anna', callee: 'ben' });
    expect(grants()).toEqual(['anna']);

    await s.answer.execute({ personId: 'ben', callId: 'call-1', accept: true });
    expect(grants()).toEqual(['anna', 'ben']);
    expect(await s.token.execute({ personId: 'carl', callId: 'call-1' })).toEqual({ ok: false, error: 'not-in-call' });
  });

  it('removes whoever hangs up from the media room and closes it when the call ends', async () => {
    await s.start.execute({ personId: 'anna', callee: 'ben' });
    await s.answer.execute({ personId: 'ben', callId: 'call-1', accept: true });

    await s.leave.execute({ personId: 'ben', callId: 'call-1' });

    expect(s.removed).toEqual(['direct:call-1:ben']);
    expect(s.closed).toEqual(['direct:call-1']);
  });

  it('stops ringing after 30 s and takes people who went offline out of their call', async () => {
    await s.start.execute({ personId: 'anna', callee: 'ben' });
    s.advance(RING_TIMEOUT_MS + 1);
    await s.update.execute();
    expect(s.published).toContainEqual(
      expect.objectContaining({ type: 'CallInvitationAnswered', outcome: 'no-answer' }),
    );

    await s.start.execute({ personId: 'anna', callee: 'carl' });
    await s.answer.execute({ personId: 'carl', callId: 'call-1', accept: true });
    s.online.delete('carl');
    await s.update.execute();
    expect(s.published.at(-1)).toMatchObject({ type: 'DirectCallEnded', callId: 'call-1' });
  });
});
