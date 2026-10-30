import { unwrap, type Clock } from '@teamtown/kernel';
import { FloorGrid, type Point } from '@teamtown/world-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConversationMedia } from './conversation-media.ts';
import { ConversationRegistry } from './conversation-registry.ts';
import { MeetingsEventStream, type MeetingsEvent } from './meetings-event-stream.ts';
import type { FloorAcoustics } from './ports/floor-acoustics.port.ts';
import type { LivePresence } from './ports/live-presence.port.ts';
import type { MediaGateway } from './ports/media-gateway.port.ts';
import { ReconcileMediaRooms } from './reconcile-media-rooms.ts';
import { RequestConversationToken } from './request-conversation-token.ts';
import { RequestRoomCallToken } from './request-room-call-token.ts';
import { SetConversationLock } from './set-conversation-lock.ts';
import { UpdateConversations } from './update-conversations.ts';
import { DirectCalls } from '../domain/direct-calls.ts';
import { ActiveMeetingLogs } from './active-meeting-logs.ts';

const NOW = new Date('2026-10-30T12:00:00Z');

class FakeMediaGateway implements MediaGateway {
  readonly clientUrl = 'ws://media.test';
  readonly rooms = new Map<string, Set<string>>();
  readonly removed: string[] = [];

  issueToken(roomName: string, personId: string): Promise<string> {
    return Promise.resolve(`token:${roomName}:${personId}`);
  }
  join(roomName: string, identity: string): void {
    const room = this.rooms.get(roomName) ?? new Set<string>();
    room.add(identity);
    this.rooms.set(roomName, room);
  }
  listRooms(): Promise<string[]> {
    return Promise.resolve([...this.rooms.keys()]);
  }
  listParticipants(roomName: string): Promise<string[]> {
    return Promise.resolve([...(this.rooms.get(roomName) ?? [])]);
  }
  removeParticipant(roomName: string, personId: string): Promise<void> {
    this.removed.push(`${roomName}:${personId}`);
    this.rooms.get(roomName)?.delete(personId);
    return Promise.resolve();
  }
  closeRoom(roomName: string): Promise<void> {
    this.rooms.delete(roomName);
    return Promise.resolve();
  }
}

function setup({ withMedia = true } = {}) {
  const positions = new Map<string, Point>();
  // Columns 20+ are an audio-isolated meeting room.
  const isIsolated = ({ x }: Point) => x >= 20;
  const roomOf = (personId: string) => {
    const position = positions.get(personId);
    return position && isIsolated(position) ? 'meeting' : null;
  };
  const presence: LivePresence = {
    occupiedFloorIds: () => (positions.size > 0 ? ['ground-floor'] : []),
    positionsOn: () => [...positions].map(([personId, position]) => ({ personId, position })),
    floorOf: (personId) => (positions.has(personId) ? 'ground-floor' : null),
    roomOf,
    occupantsOf: (_, roomId) => [...positions.keys()].filter((personId) => roomOf(personId) === roomId).sort(),
    doorModeOf: (_, roomId) => (roomId === 'meeting' ? 'open' : null),
  };
  const acoustics: FloorAcoustics = {
    floorId: 'ground-floor',
    grid: unwrap(FloorGrid.builder(30, 10)).build(),
    isolatedRoomIds: ['meeting'],
    isIsolated,
  };
  let ids = 0;
  const registry = new ConversationRegistry(
    { getFloor: (floorId) => Promise.resolve(floorId === 'ground-floor' ? acoustics : null) },
    { next: () => `c${++ids}` },
  );
  const events = new MeetingsEventStream();
  const published: MeetingsEvent[] = [];
  events.subscribe((event) => published.push(event));
  const gateway = new FakeMediaGateway();
  const media = new ConversationMedia(withMedia ? gateway : null, events);
  const clock: Clock = { now: () => NOW };
  const calls = new DirectCalls(() => 'call-1');
  const logs = new ActiveMeetingLogs();
  const update = new UpdateConversations(presence, registry, media, events, clock, calls, logs);
  return {
    positions,
    gateway,
    published,
    update: () => update.execute(),
    calls,
    reconcile: () => new ReconcileMediaRooms(registry, media, calls).execute(),
    lock: new SetConversationLock(registry, events),
    token: new RequestConversationToken(registry, media),
    roomCallToken: new RequestRoomCallToken(presence, registry, media),
  };
}

describe('Meetings use cases', () => {
  let s: ReturnType<typeof setup>;
  const grants = () => s.published.filter((e) => e.type === 'ConversationAccessGranted');

  beforeEach(() => {
    s = setup();
  });

  it('forms a conversation and gives a media token to each participant only', async () => {
    s.positions.set('anna', { x: 2, y: 2 }).set('ben', { x: 4, y: 2 }).set('carl', { x: 15, y: 2 });
    await s.update();

    expect(s.published[0]).toMatchObject({
      type: 'ConversationFormed',
      conversation: { participants: ['anna', 'ben'] },
    });
    expect(grants()).toEqual([
      {
        type: 'ConversationAccessGranted',
        personId: 'anna',
        conversationId: 'c1',
        url: 'ws://media.test',
        token: 'token:conversation:c1:anna',
      },
      {
        type: 'ConversationAccessGranted',
        personId: 'ben',
        conversationId: 'c1',
        url: 'ws://media.test',
        token: 'token:conversation:c1:ben',
      },
    ]);
  });

  it('removes someone from the media room as soon as they leave the conversation', async () => {
    s.positions.set('anna', { x: 2, y: 2 }).set('ben', { x: 4, y: 2 }).set('carl', { x: 3, y: 4 });
    await s.update();
    s.positions.set('carl', { x: 15, y: 8 });
    await s.update();

    expect(s.gateway.removed).toEqual(['conversation:c1:carl']);
  });

  it('closes the media room when the conversation ends', async () => {
    s.positions.set('anna', { x: 2, y: 2 }).set('ben', { x: 4, y: 2 });
    await s.update();
    s.gateway.join('conversation:c1', 'anna');
    s.positions.delete('ben');
    await s.update();

    expect(s.published.at(-1)).toMatchObject({ type: 'ConversationDissolved', conversationId: 'c1' });
    expect(s.gateway.rooms.has('conversation:c1')).toBe(false);
  });

  it('leaves out people in audio-isolated rooms, however close', async () => {
    s.positions.set('anna', { x: 19, y: 2 }).set('ben', { x: 20, y: 2 });
    await s.update();
    expect(s.published.filter((e) => e.type.startsWith('Conversation'))).toEqual([]);
  });

  it('leaves people in a direct call out of conversations and room calls', async () => {
    s.positions.set('anna', { x: 2, y: 2 }).set('ben', { x: 4, y: 2 }).set('carl', { x: 21, y: 2 });
    unwrap(s.calls.start('anna', 'carl', 0));
    unwrap(s.calls.answer('call-1', 'carl', true));
    await s.update();

    expect(s.published.filter((e) => e.type.startsWith('Conversation') || e.type.startsWith('RoomCall'))).toEqual([]);
  });

  it('throws out anyone in a direct call room who is not a participant', async () => {
    unwrap(s.calls.start('anna', 'ben', 0));
    unwrap(s.calls.answer('call-1', 'ben', true));
    s.gateway.join('direct:call-1', 'anna');
    s.gateway.join('direct:call-1', 'mallory');
    s.gateway.join('direct:gone', 'eve');

    await s.reconcile();

    expect([...(s.gateway.rooms.get('direct:call-1') ?? [])]).toEqual(['anna']);
    expect(s.gateway.rooms.has('direct:gone')).toBe(false);
  });

  it('puts everyone in an isolated room into its room call, and nobody else', async () => {
    s.positions.set('anna', { x: 21, y: 2 }).set('ben', { x: 28, y: 8 }).set('carl', { x: 19, y: 2 });
    await s.update();

    expect(s.published.filter((e) => e.type.startsWith('RoomCall'))).toEqual([
      {
        type: 'RoomCallChanged',
        floorId: 'ground-floor',
        roomCall: { roomId: 'meeting', participants: ['anna', 'ben'] },
        joined: ['anna', 'ben'],
        left: [],
      },
      {
        type: 'RoomCallAccessGranted',
        personId: 'anna',
        roomId: 'meeting',
        url: 'ws://media.test',
        token: 'token:room:ground-floor:meeting:anna',
      },
      {
        type: 'RoomCallAccessGranted',
        personId: 'ben',
        roomId: 'meeting',
        url: 'ws://media.test',
        token: 'token:room:ground-floor:meeting:ben',
      },
    ]);
  });

  it('removes whoever walks out of the room from its call at once, and closes the call when empty', async () => {
    s.positions.set('anna', { x: 21, y: 2 }).set('ben', { x: 22, y: 2 });
    await s.update();
    s.gateway.join('room:ground-floor:meeting', 'anna');
    s.gateway.join('room:ground-floor:meeting', 'ben');

    s.positions.set('ben', { x: 10, y: 2 });
    await s.update();
    expect(s.gateway.removed).toEqual(['room:ground-floor:meeting:ben']);

    s.positions.set('anna', { x: 1, y: 9 });
    await s.update();
    expect(s.gateway.rooms.has('room:ground-floor:meeting')).toBe(false);
    expect(s.published.at(-1)).toMatchObject({ type: 'RoomCallChanged', roomCall: { participants: [] } });
  });

  it('throws out anyone in a room call who is not inside (modified client)', async () => {
    s.positions.set('anna', { x: 21, y: 2 });
    await s.update();
    s.gateway.join('room:ground-floor:meeting', 'anna');
    s.gateway.join('room:ground-floor:meeting', 'mallory');
    s.gateway.join('room:ground-floor:stale', 'eve');

    await s.reconcile();

    expect([...(s.gateway.rooms.get('room:ground-floor:meeting') ?? [])]).toEqual(['anna']);
    expect(s.gateway.rooms.has('room:ground-floor:stale')).toBe(false);
  });

  it('hands out fresh room-call tokens to occupants only', async () => {
    s.positions.set('anna', { x: 21, y: 2 }).set('carl', { x: 2, y: 2 });
    await s.update();

    expect(await s.roomCallToken.execute({ personId: 'anna', roomId: 'meeting' })).toEqual({
      ok: true,
      value: { url: 'ws://media.test', token: 'token:room:ground-floor:meeting:anna' },
    });
    expect(await s.roomCallToken.execute({ personId: 'carl', roomId: 'meeting' })).toEqual({
      ok: false,
      error: 'not-in-room',
    });
  });

  it('throws out anyone in a conversation room who is not a participant (modified client)', async () => {
    s.positions.set('anna', { x: 2, y: 2 }).set('ben', { x: 4, y: 2 });
    await s.update();
    s.gateway.join('conversation:c1', 'anna');
    s.gateway.join('conversation:c1', 'mallory');
    s.gateway.join('conversation:stale', 'eve');

    await s.reconcile();

    expect([...(s.gateway.rooms.get('conversation:c1') ?? [])]).toEqual(['anna']);
    expect(s.gateway.rooms.has('conversation:stale')).toBe(false);
  });

  it('lets participants lock the conversation, and nobody else', async () => {
    s.positions.set('anna', { x: 2, y: 2 }).set('ben', { x: 4, y: 2 }).set('carl', { x: 15, y: 2 });
    await s.update();

    expect(s.lock.execute({ personId: 'carl', conversationId: 'c1', locked: true })).toEqual({
      ok: false,
      error: 'not-in-conversation',
    });
    expect(s.lock.execute({ personId: 'anna', conversationId: 'c1', locked: true }).ok).toBe(true);
    expect(s.published.at(-1)).toMatchObject({ type: 'ConversationChanged', conversation: { locked: true } });
  });

  it('hands out fresh tokens to participants only', async () => {
    s.positions.set('anna', { x: 2, y: 2 }).set('ben', { x: 4, y: 2 }).set('carl', { x: 15, y: 2 });
    await s.update();

    expect(await s.token.execute({ personId: 'anna', conversationId: 'c1' })).toEqual({
      ok: true,
      value: { url: 'ws://media.test', token: 'token:conversation:c1:anna' },
    });
    expect(await s.token.execute({ personId: 'carl', conversationId: 'c1' })).toEqual({
      ok: false,
      error: 'not-in-conversation',
    });
    expect(await s.token.execute({ personId: 'anna', conversationId: 'nope' })).toEqual({
      ok: false,
      error: 'conversation-not-found',
    });
  });

  it('still forms conversations without a media server, but hands out no tokens', async () => {
    s = setup({ withMedia: false });
    s.positions.set('anna', { x: 2, y: 2 }).set('ben', { x: 4, y: 2 });
    await s.update();

    expect(s.published.map((e) => e.type)).toEqual(['ConversationFormed']);
    expect(await s.token.execute({ personId: 'anna', conversationId: 'c1' })).toEqual({
      ok: false,
      error: 'media-unavailable',
    });
  });
});
