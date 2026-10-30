import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { buildFloorGrid, type FloorLayout } from './floor-layout.ts';
import { findPath } from './pathfinding.ts';
import { reachableTiles } from './reachability.ts';
import { RoomMap, tilesBesideDoor, type RoomArea } from './rooms.ts';
import { tile, tileKey } from './tile.ts';

/**
 * A hall and a lounge without a wall between them, then a meeting room and an annex behind it,
 * each behind a wall with a door at y = 1:
 *
 *   x:   0 1 | 2 ‖ 3 4 5 ‖ 6 7 8
 *   y=0  h h   l |  m m m |  a a a
 *   y=1  h h   l D  m m m D  a a a
 *   y=2  h h   l |  m m m |  a a a
 */
const annexWall = { from: { x: 6, y: 0 }, to: { x: 6, y: 3 } };
const layout: FloorLayout = {
  width: 9,
  height: 3,
  floorAreas: [{ x: 0, y: 0, width: 9, height: 3 }],
  walls: [{ from: { x: 3, y: 0 }, to: { x: 3, y: 3 } }, annexWall],
  doors: [
    { x: 3, y: 1, side: 'west' },
    { x: 5, y: 1, side: 'east' },
  ],
  furniture: [],
};

const rooms: RoomArea[] = [
  { id: 'hall', areas: [{ x: 0, y: 0, width: 2, height: 3 }] },
  { id: 'lounge', areas: [{ x: 2, y: 0, width: 1, height: 3 }] },
  { id: 'meeting', areas: [{ x: 3, y: 0, width: 3, height: 3 }] },
  { id: 'annex', areas: [{ x: 6, y: 0, width: 3, height: 3 }] },
];

const grid = unwrap(buildFloorGrid(layout));
const roomMap = RoomMap.build(layout, rooms);

describe('RoomMap', () => {
  it('knows which room a tile belongs to', () => {
    expect(roomMap.roomAt(tile(0, 0))).toBe('hall');
    expect(roomMap.roomAt(tile(4, 2))).toBe('meeting');
    expect(roomMap.roomAt(tile(9, 0))).toBeNull();
  });

  it('treats a room as enclosed when it can only be entered through doors', () => {
    expect(roomMap.isEnclosed('meeting')).toBe(true);
    expect(roomMap.isEnclosed('annex')).toBe(true);
  });

  it('treats a room with an open border as not enclosed', () => {
    expect(roomMap.isEnclosed('hall')).toBe(false);
    expect(roomMap.isEnclosed('lounge')).toBe(false);
    expect(roomMap.isEnclosed('unknown')).toBe(false);
  });

  it('lets only enclosed rooms without a spawn point change their door mode', () => {
    expect(roomMap.isDoorModeAdjustable('meeting', [tile(0, 0)])).toBe(true);
    expect(roomMap.isDoorModeAdjustable('meeting', [tile(4, 1)])).toBe(false);
    expect(roomMap.isDoorModeAdjustable('hall', [tile(7, 1)])).toBe(false);
  });

  it('counts a missing wall segment as an open border', () => {
    const leaky = RoomMap.build({ ...layout, walls: [{ from: { x: 3, y: 0 }, to: { x: 3, y: 2 } }, annexWall] }, rooms);

    expect(leaky.isEnclosed('meeting')).toBe(false);
  });
});

describe('tilesBesideDoor', () => {
  it('returns the tiles on both sides of a door', () => {
    expect(tilesBesideDoor({ x: 3, y: 1, side: 'west' })).toEqual([tile(2, 1), tile(3, 1)]);
    expect(tilesBesideDoor({ x: 5, y: 1, side: 'east' })).toEqual([tile(5, 1), tile(6, 1)]);
    expect(tilesBesideDoor({ x: 4, y: 0, side: 'north' })).toEqual([tile(4, -1), tile(4, 0)]);
    expect(tilesBesideDoor({ x: 4, y: 2, side: 'south' })).toEqual([tile(4, 2), tile(4, 3)]);
  });
});

describe('RoomMap.entryGuard', () => {
  const meetingClosed = roomMap.entryGuard((roomId) => roomId !== 'meeting');

  it('keeps people out of a closed room', () => {
    expect(findPath(grid, tile(0, 1), tile(4, 1), meetingClosed)).toEqual({ ok: false, error: 'unreachable' });
  });

  it('does not let people pass through a closed room', () => {
    expect(findPath(grid, tile(0, 1), tile(7, 1), meetingClosed)).toEqual({ ok: false, error: 'unreachable' });
  });

  it('lets people inside walk around and leave', () => {
    expect(unwrap(findPath(grid, tile(3, 0), tile(5, 2), meetingClosed)).at(-1)).toEqual(tile(5, 2));
    expect(unwrap(findPath(grid, tile(4, 1), tile(0, 1), meetingClosed)).at(-1)).toEqual(tile(0, 1));
  });

  it('lets people through open rooms', () => {
    const allOpen = roomMap.entryGuard(() => true);

    expect(unwrap(findPath(grid, tile(0, 1), tile(7, 1), allOpen))).toContainEqual(tile(4, 1));
  });

  it('limits reachability to the open part of the floor', () => {
    const reached = reachableTiles(grid, tile(0, 0), meetingClosed);

    expect(reached.has(tileKey(tile(2, 2)))).toBe(true);
    expect(reached.has(tileKey(tile(3, 1)))).toBe(false);
    expect(reached.has(tileKey(tile(7, 1)))).toBe(false);
  });
});
