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
import { SetConversationLock } from './set-conversation-lock.ts';
import { UpdateConversations } from './update-conversations.ts';

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
  const presence: LivePresence = {
    occupiedFloorIds: () => (positions.size > 0 ? ['ground-floor'] : []),
    positionsOn: () => [...positions].map(([personId, position]) => ({ personId, position })),
  };
  const acoustics: FloorAcoustics = {
    floorId: 'ground-floor',
    grid: unwrap(FloorGrid.builder(30, 10)).build(),
    // Columns 20+ are an audio-isolated meeting room.
    isIsolated: ({ x }) => x >= 20,
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
  const update = new UpdateConversations(presence, registry, media, events, clock);
  return {
    positions,
    gateway,
    published,
    update: () => update.execute(),
    reconcile: () => new ReconcileMediaRooms(registry, media).execute(),
    lock: new SetConversationLock(registry, events),
    token: new RequestConversationToken(registry, media),
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
    expect(s.published).toEqual([]);
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
