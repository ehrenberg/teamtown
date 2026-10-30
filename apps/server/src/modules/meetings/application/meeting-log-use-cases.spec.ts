import { FixedClock, unwrap } from '@teamtown/kernel';
import { FloorGrid } from '@teamtown/world-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { DirectCalls } from '../domain/direct-calls.ts';
import type { MeetingLog } from '../domain/meeting-log.ts';
import { ActiveMeetingLogs } from './active-meeting-logs.ts';
import { AnswerMeetingLog } from './answer-meeting-log.ts';
import { CallMembership } from './call-membership.ts';
import { ConversationRegistry } from './conversation-registry.ts';
import { DeleteMeetingLog } from './delete-meeting-log.ts';
import { EndMeetingLog } from './end-meeting-log.ts';
import { ListMyMeetingLogs } from './list-my-meeting-logs.ts';
import { MeetingsEventStream, type MeetingsEvent } from './meetings-event-stream.ts';
import type { LivePresence } from './ports/live-presence.port.ts';
import type { MeetingLogRepository } from './ports/meeting-log-repository.port.ts';
import { PurgeExpiredMeetingLogs } from './purge-expired-meeting-logs.ts';
import { StartMeetingLog } from './start-meeting-log.ts';
import { UpdateMeetingLogs } from './update-meeting-logs.ts';

class InMemoryMeetingLogs implements MeetingLogRepository {
  readonly logs = new Map<string, MeetingLog>();

  save(log: MeetingLog): Promise<void> {
    this.logs.set(log.props.meetingId, log);
    return Promise.resolve();
  }
  findById(meetingId: string): Promise<MeetingLog | null> {
    return Promise.resolve(this.logs.get(meetingId) ?? null);
  }
  listForParticipant(personId: string): Promise<MeetingLog[]> {
    return Promise.resolve([...this.logs.values()].filter((log) => log.isParticipant(personId)));
  }
  delete(meetingId: string): Promise<void> {
    this.logs.delete(meetingId);
    return Promise.resolve();
  }
  deleteExpired(now: Date): Promise<number> {
    const expired = [...this.logs.values()].filter((log) => log.props.expiresAt < now);
    for (const log of expired) this.logs.delete(log.props.meetingId);
    return Promise.resolve(expired.length);
  }
}

async function setup() {
  /** personId → room on the ground floor (`null`: in no room). */
  const people = new Map<string, string | null>([
    ['anna', 'elbe'],
    ['ben', 'elbe'],
    ['carl', null],
  ]);
  const occupantsOf = (roomId: string) =>
    [...people].filter(([, room]) => room === roomId).map(([personId]) => personId);
  const presence: LivePresence = {
    occupiedFloorIds: () => ['ground'],
    positionsOn: () => [],
    floorOf: (personId) => (people.has(personId) ? 'ground' : null),
    roomOf: (personId) => people.get(personId) ?? null,
    occupantsOf: (_, roomId) => occupantsOf(roomId),
    doorModeOf: () => 'open',
  };
  const registry = new ConversationRegistry(
    {
      getFloor: (floorId) =>
        Promise.resolve({
          floorId,
          grid: unwrap(FloorGrid.builder(20, 10)).build(),
          isolatedRoomIds: ['elbe'],
          isIsolated: () => false,
        }),
    },
    { next: () => 'c1' },
  );
  const floor = await registry.open('ground');
  floor?.roomCalls.update(new Map([['elbe', occupantsOf('elbe')]]));

  const admission = { admitted: [] as string[], walkedOut: [] as string[], consentRequired: [] as boolean[] };
  const roomAdmission = {
    admit: (personId: string) => admission.admitted.push(personId),
    walkOut: (personId: string) => admission.walkedOut.push(personId),
    requireConsent: (_floorId: string, _roomId: string, required: boolean) => admission.consentRequired.push(required),
  };
  const clock = new FixedClock(new Date('2026-10-30T10:00:00Z'));
  const repository = new InMemoryMeetingLogs();
  const active = new ActiveMeetingLogs();
  const events = new MeetingsEventStream();
  const published: MeetingsEvent[] = [];
  events.subscribe((event) => published.push(event));
  const membership = new CallMembership(registry, new DirectCalls(() => 'x'));
  return {
    people,
    clock,
    repository,
    active,
    published,
    admission,
    start: new StartMeetingLog(membership, active, repository, roomAdmission, events, clock, { next: () => 'm1' }, 90),
    answer: new AnswerMeetingLog(presence, active, repository, roomAdmission, events, clock),
    end: new EndMeetingLog(presence, active, repository, roomAdmission, events, clock),
    update: new UpdateMeetingLogs(presence, active, repository, roomAdmission, events, clock),
    list: new ListMyMeetingLogs(repository),
    remove: new DeleteMeetingLog(repository),
    purge: new PurgeExpiredMeetingLogs(repository, clock),
  };
}

describe('logged meeting use cases', () => {
  let s: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    s = await setup();
  });

  it('stores nothing until someone starts a log', async () => {
    await s.update.execute();
    expect(s.repository.logs.size).toBe(0);
  });

  it('starts a log in the room call with the host as first participant and closes the door to newcomers', async () => {
    expect((await s.start.execute({ personId: 'anna', title: 'Sprint review' })).ok).toBe(true);

    expect(s.repository.logs.get('m1')?.props).toMatchObject({ title: 'Sprint review', hostId: 'anna' });
    expect(s.active.mayBeInCall('ground', 'elbe', 'anna')).toBe(true);
    expect(s.active.mayBeInCall('ground', 'elbe', 'ben')).toBe(false);
    expect(s.admission.consentRequired).toEqual([true]);
    expect(s.published).toContainEqual({ type: 'MeetingLogChanged', floorId: 'ground', roomId: 'elbe', active: true });
  });

  it('refuses a log outside a room call and a second log in the same room', async () => {
    expect(await s.start.execute({ personId: 'carl', title: 'x' })).toEqual({ ok: false, error: 'no-room-call' });
    await s.start.execute({ personId: 'anna', title: 'x' });
    expect(await s.start.execute({ personId: 'ben', title: 'y' })).toEqual({ ok: false, error: 'meeting-log-active' });
  });

  it('asks the people inside, logs them after Join and walks them out after Don’t join', async () => {
    await s.start.execute({ personId: 'anna', title: 'Sprint review' });
    s.people.set('carl', 'elbe');
    await s.update.execute();
    expect(s.published).toContainEqual({
      type: 'MeetingLogConsentRequested',
      roomId: 'elbe',
      title: 'Sprint review',
      recipients: ['ben', 'carl'],
    });

    await s.answer.execute({ personId: 'ben', roomId: 'elbe', join: true });
    await s.answer.execute({ personId: 'carl', roomId: 'elbe', join: false });

    expect(s.repository.logs.get('m1')?.props.consents.map((c) => c.personId)).toEqual(['anna', 'ben']);
    expect(s.admission.walkedOut).toEqual(['carl']);
  });

  it('lets people outside in only after they join', async () => {
    await s.start.execute({ personId: 'anna', title: 'Sprint review' });

    await s.answer.execute({ personId: 'carl', roomId: 'elbe', join: true });

    expect(s.admission.admitted).toEqual(['carl']);
    expect(s.repository.logs.get('m1')?.isParticipant('carl')).toBe(true);
  });

  it('lets only the host end the log, and ends it when the room empties', async () => {
    await s.start.execute({ personId: 'anna', title: 'Sprint review' });
    expect(await s.end.execute({ personId: 'ben' })).toEqual({ ok: false, error: 'not-meeting-host' });
    expect((await s.end.execute({ personId: 'anna' })).ok).toBe(true);
    expect(s.repository.logs.get('m1')?.props.endedAt).toEqual(s.clock.now());

    const second = await setup();
    await second.start.execute({ personId: 'anna', title: 'Retro' });
    second.people.set('anna', null).set('ben', null);
    await second.update.execute();
    expect(second.repository.logs.get('m1')?.isActive).toBe(false);
    expect(second.admission.consentRequired).toEqual([true, false]);
  });

  it('shows logs to participants only and lets only the host delete them', async () => {
    await s.start.execute({ personId: 'anna', title: 'Sprint review' });
    await s.answer.execute({ personId: 'ben', roomId: 'elbe', join: true });

    expect((await s.list.execute('ben')).map((log) => log.participants)).toEqual([['anna', 'ben']]);
    expect(await s.list.execute('carl')).toEqual([]);
    expect(await s.remove.execute({ personId: 'carl', meetingId: 'm1' })).toEqual({ ok: false, error: 'not-found' });
    expect(await s.remove.execute({ personId: 'ben', meetingId: 'm1' })).toEqual({
      ok: false,
      error: 'not-meeting-host',
    });
    expect((await s.remove.execute({ personId: 'anna', meetingId: 'm1' })).ok).toBe(true);
  });

  it('deletes logs after the retention period', async () => {
    await s.start.execute({ personId: 'anna', title: 'Sprint review' });

    s.clock.advanceBy(91 * 24 * 60 * 60 * 1000);

    expect(await s.purge.execute()).toBe(1);
    expect(s.repository.logs.size).toBe(0);
  });
});
