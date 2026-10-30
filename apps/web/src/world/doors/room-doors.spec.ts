import type { FloorPlan } from '@teamtown/contracts';
import { describe, expect, it } from 'vitest';
import { adjustableRoomDoors } from './room-doors.ts';

const room = (id: string, x: number) => ({
  id,
  name: id,
  kind: 'meeting' as const,
  areas: [{ x, y: 0, width: 3, height: 3 }],
  doorMode: 'open' as const,
  audioIsolated: false,
});

/** A hall (x 0–2, spawn) and a meeting room (x 3–5) with a two-tile door at (3,1) and (3,2). */
const plan: FloorPlan = {
  floorId: 'ground',
  name: 'Office',
  level: 0,
  version: 1,
  width: 6,
  height: 3,
  floorAreas: [{ x: 0, y: 0, width: 6, height: 3, material: 'wood' }],
  walls: [{ from: { x: 3, y: 0 }, to: { x: 3, y: 3 }, material: 'solid' }],
  doors: [
    { x: 3, y: 1, side: 'west' },
    { x: 2, y: 2, side: 'east' },
  ],
  rooms: [room('hall', 0), room('meeting', 3)],
  furniture: [],
  spawnPoints: [{ x: 0, y: 0 }],
};

describe('adjustableRoomDoors', () => {
  it('groups the doors of rooms that can close and hangs the sign between them', () => {
    expect(adjustableRoomDoors(plan)).toEqual([
      {
        roomId: 'meeting',
        openings: [
          { x: 2.5, y: 1, horizontal: false },
          { x: 2.5, y: 2, horizontal: false },
        ],
        sign: { x: 2.5, y: 1.5 },
      },
    ]);
  });
});
