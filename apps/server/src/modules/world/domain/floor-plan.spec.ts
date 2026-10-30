import { describe, expect, it } from 'vitest';
import { FloorPlan, type FloorPlanProps, type RoomProps } from './floor-plan.ts';

const westRoom: RoomProps = {
  id: 'west',
  name: 'West',
  kind: 'open-space',
  areas: [{ x: 0, y: 0, width: 3, height: 3 }],
  doorMode: 'open',
  audioIsolated: false,
};

const smallPlan: FloorPlanProps = {
  floorId: 'test-floor',
  name: 'Test',
  level: 0,
  version: 1,
  width: 6,
  height: 3,
  floorAreas: [{ x: 0, y: 0, width: 6, height: 3, material: 'wood' }],
  walls: [{ from: { x: 3, y: 0 }, to: { x: 3, y: 3 }, material: 'glass' }],
  doors: [{ x: 3, y: 1, side: 'west' }],
  rooms: [
    westRoom,
    {
      id: 'east',
      name: 'East',
      kind: 'meeting',
      areas: [{ x: 3, y: 0, width: 3, height: 3 }],
      doorMode: 'knock',
      audioIsolated: true,
    },
  ],
  furniture: [{ id: 'plant-1', catalogItemId: 'plant', x: 5, y: 2, rotation: 0 }],
  spawnPoints: [{ x: 0, y: 0 }],
};

describe('FloorPlan', () => {
  it('accepts a consistent plan', () => {
    expect(FloorPlan.create(smallPlan).ok).toBe(true);
  });

  it('rejects a room that cannot be reached from the spawn point', () => {
    expect(FloorPlan.create({ ...smallPlan, doors: [] })).toEqual({ ok: false, error: 'room-unreachable' });
  });

  it('rejects spawn points on blocked tiles', () => {
    expect(FloorPlan.create({ ...smallPlan, spawnPoints: [{ x: 5, y: 2 }] })).toEqual({
      ok: false,
      error: 'spawn-not-walkable',
    });
  });

  it('rejects furniture outside the floor and duplicate ids', () => {
    expect(
      FloorPlan.create({
        ...smallPlan,
        furniture: [{ id: 'desk-1', catalogItemId: 'desk-straight', x: 4, y: 0, rotation: 0 }],
      }),
    ).toEqual({ ok: false, error: 'furniture-outside-floor' });
    expect(FloorPlan.create({ ...smallPlan, rooms: [...smallPlan.rooms, westRoom] })).toEqual({
      ok: false,
      error: 'duplicate-id',
    });
  });
});
