import { unwrap } from '@teamtown/kernel';
import { buildFloorGrid, RoomMap, tile, type FloorLayout } from '@teamtown/world-core';
import { describe, expect, it } from 'vitest';
import { FloorInstance, type Occupant } from './floor-instance.ts';

const NOW = 1_000_000;
const LATER = NOW + 10_000;
const lena: Occupant = { personId: 'lena', displayName: 'Lena', avatarColor: '#D9653B' };
const ben: Occupant = { personId: 'ben', displayName: 'Ben', avatarColor: '#2F6F8F' };

/**
 * A hall, a meeting room and an annex that can only be reached through the meeting room:
 *
 *   x:   0 1 2 ‖ 3 4 5 ‖ 6 7 8
 *   y=0  h h h |  m m m |  a a a
 *   y=1  h h h D  m m m D  a a a
 *   y=2  h h h |  m m m |  a a a
 */
const layout: FloorLayout = {
  width: 9,
  height: 3,
  floorAreas: [{ x: 0, y: 0, width: 9, height: 3 }],
  walls: [
    { from: { x: 3, y: 0 }, to: { x: 3, y: 3 } },
    { from: { x: 6, y: 0 }, to: { x: 6, y: 3 } },
  ],
  doors: [
    { x: 3, y: 1, side: 'west' },
    { x: 5, y: 1, side: 'east' },
  ],
  furniture: [],
};

function aFloor(): FloorInstance {
  const roomMap = RoomMap.build(layout, [
    { id: 'hall', areas: [{ x: 0, y: 0, width: 3, height: 3 }] },
    { id: 'meeting', areas: [{ x: 3, y: 0, width: 3, height: 3 }] },
    { id: 'annex', areas: [{ x: 6, y: 0, width: 3, height: 3 }] },
  ]);
  return new FloorInstance('ground-floor', unwrap(buildFloorGrid(layout)), [tile(0, 0), tile(0, 1)], {
    roomMap,
    settings: [
      { roomId: 'hall', doorMode: 'open', doorModeAdjustable: false },
      { roomId: 'meeting', doorMode: 'knock', doorModeAdjustable: true },
      { roomId: 'annex', doorMode: 'open', doorModeAdjustable: true },
    ],
  });
}

/** Ben walks into the (still empty) meeting room; Lena stays at her spawn point (0,1). */
function withBenInTheMeetingRoom(): FloorInstance {
  const floor = aFloor();
  floor.join(ben, NOW);
  floor.join(lena, NOW);
  unwrap(floor.moveTo('ben', tile(4, 0), NOW));
  floor.updateRooms(LATER);
  floor.pullEvents();
  return floor;
}

describe('FloorInstance rooms', () => {
  it('lets anyone walk into an empty knock room', () => {
    const floor = withBenInTheMeetingRoom();

    expect(floor.roomOf('ben', LATER)).toBe('meeting');
    expect(floor.occupantsOf('meeting', LATER)).toEqual(['ben']);
  });

  it('rejects walking into an occupied knock room', () => {
    const floor = withBenInTheMeetingRoom();

    expect(floor.moveTo('lena', tile(4, 1), LATER)).toEqual({ ok: false, error: 'door-closed' });
  });

  it('announces door mode changes and opens the room for everyone', () => {
    const floor = withBenInTheMeetingRoom();

    expect(floor.setDoorMode('ben', 'meeting', 'open', LATER)).toEqual({ ok: true, value: undefined });
    expect(floor.pullEvents()).toEqual([
      { type: 'DoorModeChanged', floorId: 'ground-floor', roomId: 'meeting', doorMode: 'open' },
    ]);
    expect(floor.moveTo('lena', tile(4, 1), LATER).ok).toBe(true);
  });

  it('only lets occupants change the door mode', () => {
    const floor = withBenInTheMeetingRoom();

    expect(floor.setDoorMode('lena', 'meeting', 'open', LATER)).toEqual({ ok: false, error: 'not-in-room' });
    expect(floor.setDoorMode('lena', 'hall', 'locked', LATER)).toEqual({ ok: false, error: 'door-mode-fixed' });
  });

  it('stops people in front of a door that closes while they walk towards it', () => {
    const floor = withBenInTheMeetingRoom();
    floor.setDoorMode('ben', 'meeting', 'open', LATER);
    unwrap(floor.moveTo('lena', tile(7, 1), LATER));
    floor.pullEvents();

    // After 300 ms Lena is closest to (1,1); the next tiles are (2,1) and then the door.
    floor.setDoorMode('ben', 'meeting', 'locked', LATER + 300);

    expect(floor.pullEvents()).toMatchObject([
      { type: 'DoorModeChanged', doorMode: 'locked' },
      { type: 'AvatarPathStarted', personId: 'lena', movement: { from: tile(1, 1), path: [tile(2, 1)] } },
    ]);
    expect(floor.snapshot(LATER + 10_000).find((a) => a.occupant.personId === 'lena')?.tile).toEqual(tile(2, 1));
  });

  it('lets people behind a closed room pass through it to get out, but not stay in it', () => {
    const floor = aFloor();
    floor.join(ben, NOW);
    floor.join(lena, NOW);
    unwrap(floor.moveTo('lena', tile(7, 1), NOW));
    unwrap(floor.moveTo('ben', tile(4, 0), NOW));
    floor.updateRooms(LATER);
    floor.setDoorMode('ben', 'meeting', 'locked', LATER);

    expect(floor.moveTo('lena', tile(4, 2), LATER)).toEqual({ ok: false, error: 'door-closed' });
    expect(unwrap(floor.moveTo('lena', tile(0, 2), LATER))?.path).toContainEqual(tile(4, 1));
  });

  it('walks an admitted person to a free tile inside', () => {
    const floor = withBenInTheMeetingRoom();

    const movement = unwrap(floor.admit('lena', 'meeting', LATER));

    expect(movement?.path.at(-1)).toEqual(tile(3, 1));
    floor.updateRooms(LATER + 10_000);
    expect(floor.roomOf('lena', LATER + 10_000)).toBe('meeting');
  });

  it('lets people return within the grace period', () => {
    const floor = withBenInTheMeetingRoom();
    floor.setDoorMode('ben', 'meeting', 'open', LATER);
    unwrap(floor.moveTo('lena', tile(4, 2), LATER));
    floor.updateRooms(LATER + 5_000);
    floor.setDoorMode('ben', 'meeting', 'locked', LATER + 5_000);
    unwrap(floor.moveTo('lena', tile(1, 1), LATER + 5_000));
    floor.updateRooms(LATER + 10_000);

    expect(floor.moveTo('lena', tile(4, 2), LATER + 10_000).ok).toBe(true);
  });

  it('lets nobody into a room with a logged meeting without consent, not even through an open door', () => {
    const floor = withBenInTheMeetingRoom();
    floor.setDoorMode('ben', 'meeting', 'open', LATER);
    floor.setConsentRequired('meeting', true, LATER);

    expect(floor.moveTo('lena', tile(4, 1), LATER)).toEqual({ ok: false, error: 'consent-required' });
    expect(unwrap(floor.admit('lena', 'meeting', LATER))?.path.at(-1)).toEqual(tile(3, 1));
  });

  it('walks someone out of a room to a free tile outside', () => {
    const floor = withBenInTheMeetingRoom();

    floor.walkOut('ben', 'meeting', LATER);

    expect(floor.roomOf('ben', LATER + 10_000)).not.toBe('meeting');
    expect(floor.walkOut('lena', 'meeting', LATER)).toEqual({ ok: true, value: null });
  });

  it('walks people out through the door, not to a room behind the wall that only looks close', () => {
    const floor = aFloor();
    floor.join(lena, NOW);
    unwrap(floor.moveTo('lena', tile(6, 1), NOW));
    floor.updateRooms(LATER);

    // The meeting room is right next to the annex, the hall far away by air; but the door leads to the meeting room.
    floor.walkOut('lena', 'annex', LATER);

    expect(floor.roomOf('lena', LATER + 10_000)).toBe('meeting');
  });

  it('resets the door mode when the room empties', () => {
    const floor = withBenInTheMeetingRoom();
    floor.setDoorMode('ben', 'meeting', 'locked', LATER);
    floor.pullEvents();
    floor.leave('ben');
    floor.updateRooms(LATER + 100);

    expect(floor.pullEvents()).toContainEqual({
      type: 'DoorModeChanged',
      floorId: 'ground-floor',
      roomId: 'meeting',
      doorMode: 'knock',
    });
    expect(floor.doorModes()).toContainEqual({ roomId: 'meeting', doorMode: 'knock' });
  });
});
