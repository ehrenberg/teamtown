import { unwrap } from '@teamtown/kernel';
import { FloorGrid } from '@teamtown/world-core';
import { describe, expect, it } from 'vitest';
import { Cameras } from '../domain/cameras.ts';
import { DirectCalls } from '../domain/direct-calls.ts';
import { CallMembership } from './call-membership.ts';
import { ConversationRegistry } from './conversation-registry.ts';
import { MeetingsEventStream, type MeetingsEvent } from './meetings-event-stream.ts';
import { SetCamera } from './set-camera.ts';
import { SyncCameras } from './sync-cameras.ts';

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
  const calls = new DirectCalls(() => 'call-1');
  const cameras = new Cameras();
  const membership = new CallMembership(registry, calls);
  const events = new MeetingsEventStream();
  const published: MeetingsEvent[] = [];
  events.subscribe((event) => published.push(event));
  const near = [
    { personId: 'anna', position: { x: 1, y: 1 } },
    { personId: 'ben', position: { x: 2, y: 1 } },
  ];
  return {
    floor,
    calls,
    published,
    near,
    setCamera: new SetCamera(cameras, membership, events),
    sync: new SyncCameras(cameras, membership, events),
  };
}

describe('camera use cases', () => {
  it('switches the camera on only inside a conversation or call', async () => {
    const s = await setup();

    expect(s.setCamera.execute({ personId: 'anna', on: true })).toEqual({ ok: false, error: 'not-in-call' });

    s.floor?.conversations.update(s.near, 0);
    expect(s.setCamera.execute({ personId: 'anna', on: true }).ok).toBe(true);
    expect(s.published).toEqual([{ type: 'CameraChanged', personId: 'anna', on: true }]);
  });

  it('switches the camera off when the person leaves the conversation', async () => {
    const s = await setup();
    s.floor?.conversations.update(s.near, 0);
    s.setCamera.execute({ personId: 'anna', on: true });

    s.floor?.conversations.update([], 1);
    s.sync.execute();

    expect(s.published.at(-1)).toEqual({ type: 'CameraChanged', personId: 'anna', on: false });
  });

  it('switches the camera off when a direct call replaces the conversation', async () => {
    const s = await setup();
    s.floor?.conversations.update(s.near, 0);
    s.setCamera.execute({ personId: 'anna', on: true });

    unwrap(s.calls.start('anna', 'carl', 0));
    s.sync.execute();

    expect(s.published.at(-1)).toEqual({ type: 'CameraChanged', personId: 'anna', on: false });
  });
});
