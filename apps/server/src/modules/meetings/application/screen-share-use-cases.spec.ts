import { unwrap } from '@teamtown/kernel';
import { FloorGrid } from '@teamtown/world-core';
import { describe, expect, it } from 'vitest';
import { DirectCalls } from '../domain/direct-calls.ts';
import { ScreenShares } from '../domain/screen-shares.ts';
import { CallMembership } from './call-membership.ts';
import { ConversationRegistry } from './conversation-registry.ts';
import { MeetingsEventStream, type MeetingsEvent } from './meetings-event-stream.ts';
import { StartScreenShare, StopScreenShare, SyncScreenShares } from './screen-share-use-cases.ts';

async function setup() {
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
  floor?.roomCalls.update(new Map([['elbe', ['anna', 'ben', 'carl']]]));
  const shares = new ScreenShares();
  const membership = new CallMembership(registry, new DirectCalls(() => 'call-1'));
  const events = new MeetingsEventStream();
  const published: MeetingsEvent[] = [];
  events.subscribe((event) => published.push(event));
  return {
    floor,
    published,
    start: new StartScreenShare(shares, membership, events),
    stop: new StopScreenShare(shares, membership, events),
    sync: new SyncScreenShares(shares, membership, events),
  };
}

describe('screen share use cases', () => {
  it('tells everyone in the room call who shares, and lets a new sharer take over', async () => {
    const s = await setup();

    expect(s.start.execute({ personId: 'anna' }).ok).toBe(true);
    s.start.execute({ personId: 'ben' });

    expect(s.published).toEqual([
      { type: 'ScreenShareChanged', sharer: 'anna', recipients: ['anna', 'ben', 'carl'] },
      { type: 'ScreenShareChanged', sharer: 'ben', recipients: ['anna', 'ben', 'carl'] },
    ]);
  });

  it('refuses sharing outside room calls and direct calls', async () => {
    const s = await setup();

    expect(s.start.execute({ personId: 'dora' })).toEqual({ ok: false, error: 'screen-share-not-here' });
  });

  it('ends the share when the sharer leaves, and tells them too', async () => {
    const s = await setup();
    s.start.execute({ personId: 'anna' });
    s.floor?.roomCalls.update(new Map([['elbe', ['ben', 'carl']]]));

    s.sync.execute();

    expect(s.published.at(-1)).toEqual({
      type: 'ScreenShareChanged',
      sharer: null,
      recipients: ['ben', 'carl', 'anna'],
    });
    s.stop.execute({ personId: 'anna' });
    expect(s.published).toHaveLength(2);
  });
});
