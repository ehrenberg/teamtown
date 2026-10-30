import { unwrap } from '@teamtown/kernel';
import { FloorGrid, tile } from '@teamtown/world-core';
import { describe, expect, it } from 'vitest';
import { FloorInstance, type Occupant } from './floor-instance.ts';

const NOW = 1_000_000;
const lena: Occupant = { personId: 'lena', displayName: 'Lena', avatarColor: '#D9653B' };
const ben: Occupant = { personId: 'ben', displayName: 'Ben', avatarColor: '#2F6F8F' };

/** 5 × 3 floor with a wall between columns 2 and 3 except in the bottom row. */
function aFloor(): FloorInstance {
  const builder = unwrap(FloorGrid.builder(5, 3));
  builder.addWall(tile(3, 0), 'west').addWall(tile(3, 1), 'west');
  return new FloorInstance('ground-floor', builder.build(), [tile(0, 0), tile(1, 0)]);
}

describe('FloorInstance', () => {
  it('places people on free spawn points and announces them', () => {
    const floor = aFloor();

    expect(floor.join(lena, NOW).tile).toEqual(tile(0, 0));
    expect(floor.join(ben, NOW).tile).toEqual(tile(1, 0));
    expect(floor.pullEvents().map((event) => event.type)).toEqual(['AvatarJoined', 'AvatarJoined']);
  });

  it('keeps the avatar when the same person joins again', () => {
    const floor = aFloor();
    floor.join(lena, NOW);
    floor.pullEvents();

    floor.join(lena, NOW);

    expect(floor.snapshot(NOW)).toHaveLength(1);
    expect(floor.pullEvents()).toHaveLength(0);
  });

  it('computes a server-side path around walls and announces it', () => {
    const floor = aFloor();
    floor.join(lena, NOW);
    floor.pullEvents();

    const movement = unwrap(floor.moveTo('lena', tile(4, 0), NOW));

    expect(movement?.path).toContainEqual(tile(2, 2));
    expect(floor.pullEvents()).toMatchObject([{ type: 'AvatarPathStarted', personId: 'lena' }]);
  });

  it('continues from the tile reached so far when interrupted', () => {
    const floor = aFloor();
    floor.join(lena, NOW);
    unwrap(floor.moveTo('lena', tile(0, 2), NOW));

    // Speed is 3 tiles/s: after 400 ms the avatar is closest to (0,1).
    const second = unwrap(floor.moveTo('lena', tile(2, 1), NOW + 400));

    expect(second?.from).toEqual(tile(0, 1));
  });

  it('rejects unreachable targets and people who are not on the floor', () => {
    const floor = aFloor();
    floor.join(lena, NOW);

    expect(floor.moveTo('lena', tile(9, 9), NOW)).toEqual({ ok: false, error: 'unreachable' });
    expect(floor.moveTo('nobody', tile(1, 1), NOW)).toEqual({ ok: false, error: 'not-on-floor' });
  });

  it('settles finished movements in snapshots', () => {
    const floor = aFloor();
    floor.join(lena, NOW);
    unwrap(floor.moveTo('lena', tile(0, 2), NOW));

    expect(floor.snapshot(NOW + 10_000)[0]).toMatchObject({ tile: tile(0, 2), movement: null });
  });

  it('announces leaving only once', () => {
    const floor = aFloor();
    floor.join(lena, NOW);
    floor.pullEvents();

    expect(floor.leave('lena')).toBe(true);
    expect(floor.leave('lena')).toBe(false);
    expect(floor.pullEvents()).toEqual([{ type: 'AvatarLeft', floorId: 'ground-floor', personId: 'lena' }]);
    expect(floor.isEmpty).toBe(true);
  });

  it('reports live positions, also halfway through a step', () => {
    const floor = aFloor();
    floor.join(lena, NOW);
    floor.moveTo('lena', tile(0, 2), NOW);

    // Walking speed is 3 tiles per second: after 500 ms Lena is 1.5 tiles down.
    expect(floor.positions(NOW + 500)).toEqual([{ personId: 'lena', position: { x: 0, y: 1.5 } }]);
  });
});
