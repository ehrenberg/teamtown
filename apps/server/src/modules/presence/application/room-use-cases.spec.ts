import { FixedClock, unwrap } from '@teamtown/kernel';
import { buildFloorGrid, RoomMap, tile, type FloorLayout } from '@teamtown/world-core';
import { describe, expect, it } from 'vitest';
import type { PresenceEvent } from '../domain/floor-instance.ts';
import { AdmitToRoom } from './admit-to-room.ts';
import { FloorRegistry } from './floor-registry.ts';
import { JoinFloor } from './join-floor.ts';
import { LeavePresence } from './leave-presence.ts';
import { MoveTo } from './move-to.ts';
import { PresenceEventStream } from './presence-event-stream.ts';
import { PresenceQueries } from './presence-queries.ts';
import { SetDoorMode } from './set-door-mode.ts';
import { UpdateRooms } from './update-rooms.ts';

/** A hall (x 0–2) and a meeting room (x 3–5) behind a wall with a door at (3,1). */
const layout: FloorLayout = {
  width: 6,
  height: 3,
  floorAreas: [{ x: 0, y: 0, width: 6, height: 3 }],
  walls: [{ from: { x: 3, y: 0 }, to: { x: 3, y: 3 } }],
  doors: [{ x: 3, y: 1, side: 'west' }],
  furniture: [],
};

function setup() {
  const roomMap = RoomMap.build(layout, [
    { id: 'hall', areas: [{ x: 0, y: 0, width: 3, height: 3 }] },
    { id: 'meeting', areas: [{ x: 3, y: 0, width: 3, height: 3 }] },
  ]);
  const registry = new FloorRegistry({
    getFloor: (floorId) =>
      Promise.resolve(
        floorId === 'ground'
          ? {
              floorId,
              grid: unwrap(buildFloorGrid(layout)),
              spawnPoints: [tile(0, 0), tile(0, 1)],
              rooms: {
                roomMap,
                settings: [
                  { roomId: 'hall', doorMode: 'open' as const, doorModeAdjustable: false },
                  { roomId: 'meeting', doorMode: 'knock' as const, doorModeAdjustable: true },
                ],
              },
            }
          : null,
      ),
  });
  const stream = new PresenceEventStream();
  const clock = new FixedClock(new Date('2026-10-30T09:00:00Z'));
  const events: PresenceEvent[] = [];
  stream.subscribe((event) => events.push(event));
  return {
    clock,
    events,
    join: new JoinFloor(registry, stream, clock),
    move: new MoveTo(registry, stream, clock),
    leave: new LeavePresence(registry, stream),
    setDoorMode: new SetDoorMode(registry, stream, clock),
    admit: new AdmitToRoom(registry, stream, clock),
    updateRooms: new UpdateRooms(registry, stream, clock),
    queries: new PresenceQueries(registry, clock),
  };
}

const ben = { personId: 'ben', displayName: 'Ben', avatarColor: '#2F6F8F' };
const lena = { personId: 'lena', displayName: 'Lena', avatarColor: '#D9653B' };

async function benInTheMeetingRoom() {
  const s = setup();
  await s.join.execute({ occupant: ben, floorId: 'ground' });
  await s.join.execute({ occupant: lena, floorId: 'ground' });
  s.move.execute({ personId: 'ben', target: tile(4, 1) });
  s.clock.advanceBy(10_000);
  return s;
}

describe('room use cases', () => {
  it('lets occupants change the door mode and tells the floor', async () => {
    const s = await benInTheMeetingRoom();

    expect(s.setDoorMode.execute({ personId: 'ben', roomId: 'meeting', doorMode: 'locked' }).ok).toBe(true);
    expect(s.events.at(-1)).toEqual({
      type: 'DoorModeChanged',
      floorId: 'ground',
      roomId: 'meeting',
      doorMode: 'locked',
    });
    expect(s.queries.doorModesOn('ground')).toContainEqual({ roomId: 'meeting', doorMode: 'locked' });
    expect(s.setDoorMode.execute({ personId: 'nobody', roomId: 'meeting', doorMode: 'open' })).toEqual({
      ok: false,
      error: 'not-on-floor',
    });
  });

  it('rejects walking into an occupied knock room', async () => {
    const s = await benInTheMeetingRoom();

    expect(s.move.execute({ personId: 'lena', target: tile(5, 2) })).toEqual({ ok: false, error: 'door-closed' });
  });

  it('walks an admitted person in', async () => {
    const s = await benInTheMeetingRoom();

    expect(s.admit.execute({ personId: 'lena', floorId: 'ground', roomId: 'meeting' }).ok).toBe(true);
    s.clock.advanceBy(10_000);
    expect(s.queries.roomOf('lena')).toBe('meeting');
    expect(s.queries.occupantsOf('ground', 'meeting')).toEqual(['ben', 'lena']);
  });

  it('resets the door mode on the tick once the room is empty', async () => {
    const s = await benInTheMeetingRoom();
    s.setDoorMode.execute({ personId: 'ben', roomId: 'meeting', doorMode: 'locked' });
    s.move.execute({ personId: 'ben', target: tile(1, 1) });
    s.clock.advanceBy(10_000);

    s.updateRooms.execute();

    expect(s.events.at(-1)).toEqual({
      type: 'DoorModeChanged',
      floorId: 'ground',
      roomId: 'meeting',
      doorMode: 'knock',
    });
  });
});
