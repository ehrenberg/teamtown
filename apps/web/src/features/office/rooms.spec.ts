import type { FloorPlan } from '@teamtown/contracts';
import { unwrap } from '@teamtown/kernel';
import { buildFloorGrid } from '@teamtown/world-core';
import { describe, expect, it } from 'vitest';
import { entryTarget, floorRooms } from './rooms.ts';

/** A hall (x 0–2) with the spawn point and a meeting room (x 3–5) behind a wall with a door at (3,1). */
const plan: FloorPlan = {
  floorId: 'ground',
  name: 'Office',
  level: 0,
  version: 1,
  width: 6,
  height: 3,
  floorAreas: [{ x: 0, y: 0, width: 6, height: 3, material: 'wood' }],
  walls: [{ from: { x: 3, y: 0 }, to: { x: 3, y: 3 }, material: 'glass' }],
  doors: [{ x: 3, y: 1, side: 'west' }],
  rooms: [
    {
      id: 'hall',
      name: 'Hall',
      kind: 'open-space',
      areas: [{ x: 0, y: 0, width: 3, height: 3 }],
      doorMode: 'open',
      audioIsolated: false,
    },
    {
      id: 'meeting',
      name: 'Meeting',
      kind: 'meeting',
      areas: [{ x: 3, y: 0, width: 3, height: 3 }],
      doorMode: 'knock',
      audioIsolated: true,
    },
  ],
  furniture: [],
  spawnPoints: [{ x: 0, y: 0 }],
};

describe('floorRooms', () => {
  it('lets only closed rooms without a spawn point change their door mode', () => {
    expect(floorRooms(plan).rooms.map((room) => [room.roomId, room.doorModeAdjustable])).toEqual([
      ['hall', false],
      ['meeting', true],
    ]);
  });
});

describe('entryTarget', () => {
  const grid = unwrap(buildFloorGrid(plan));
  const { roomMap } = floorRooms(plan);

  it('picks the nearest free tile inside the room', () => {
    expect(entryTarget(grid, roomMap, 'meeting', { x: 0, y: 1 }, [])).toEqual({ x: 3, y: 1 });
    expect(entryTarget(grid, roomMap, 'meeting', { x: 0, y: 1 }, [{ x: 3, y: 1 }])).not.toEqual({ x: 3, y: 1 });
  });

  it('returns null for unknown rooms', () => {
    expect(entryTarget(grid, roomMap, 'basement', { x: 0, y: 1 }, [])).toBeNull();
  });
});
