import { FixedClock, unwrap } from '@teamtown/kernel';
import { FloorGrid, tile } from '@teamtown/world-core';
import { describe, expect, it } from 'vitest';
import type { PresenceEvent } from '../domain/floor-instance.ts';
import { FloorRegistry } from './floor-registry.ts';
import { JoinFloor } from './join-floor.ts';
import { LeavePresence } from './leave-presence.ts';
import { MoveTo } from './move-to.ts';
import type { FloorDefinition, FloorSource } from './ports/floor-source.port.ts';
import { PresenceEventStream } from './presence-event-stream.ts';

const floor = (floorId: string): FloorDefinition => ({
  floorId,
  grid: unwrap(FloorGrid.builder(4, 4)).build(),
  spawnPoints: [tile(0, 0)],
});

const source: FloorSource = {
  getFloor: (floorId) => Promise.resolve(['ground', 'upper'].includes(floorId) ? floor(floorId) : null),
};

function setup() {
  const registry = new FloorRegistry(source);
  const stream = new PresenceEventStream();
  const clock = new FixedClock(new Date('2026-10-30T09:00:00Z'));
  const events: PresenceEvent[] = [];
  stream.subscribe((event) => events.push(event));
  return {
    events,
    join: new JoinFloor(registry, stream, clock),
    move: new MoveTo(registry, stream, clock),
    leave: new LeavePresence(registry, stream),
  };
}

const lena = { personId: 'lena', displayName: 'Lena', avatarColor: '#D9653B' };

describe('presence use cases', () => {
  it('rejects unknown floors', async () => {
    expect(await setup().join.execute({ occupant: lena, floorId: 'basement' })).toEqual({
      ok: false,
      error: 'unknown-floor',
    });
  });

  it('moves a person between floors and tells both floors', async () => {
    const { join, events } = setup();
    await join.execute({ occupant: lena, floorId: 'ground' });
    await join.execute({ occupant: lena, floorId: 'upper' });

    expect(events.map((event) => `${event.type}@${event.floorId}`)).toEqual([
      'AvatarJoined@ground',
      'AvatarLeft@ground',
      'AvatarJoined@upper',
    ]);
  });

  it('walks only on the floor the person joined', async () => {
    const { join, move } = setup();

    expect(move.execute({ personId: 'lena', target: tile(1, 1) })).toEqual({ ok: false, error: 'not-on-floor' });
    await join.execute({ occupant: lena, floorId: 'ground' });
    expect(move.execute({ personId: 'lena', target: tile(1, 1) })).toEqual({ ok: true, value: undefined });
  });

  it('removes the avatar when the person goes offline', async () => {
    const { join, leave, events } = setup();
    await join.execute({ occupant: lena, floorId: 'ground' });

    leave.execute('lena');
    leave.execute('lena');

    expect(events.filter((event) => event.type === 'AvatarLeft')).toHaveLength(1);
  });
});
