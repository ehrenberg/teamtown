import { describe, expect, it } from 'vitest';
import { FloorRoomCalls } from './room-calls.ts';

const inRooms = (entries: Record<string, string[]>) => new Map(Object.entries(entries));

describe('FloorRoomCalls', () => {
  it('starts a call when someone enters an isolated room', () => {
    const calls = new FloorRoomCalls('ground');

    expect(calls.update(inRooms({ elbe: ['lena'] }))).toEqual([
      {
        type: 'RoomCallChanged',
        floorId: 'ground',
        roomCall: { roomId: 'elbe', participants: ['lena'] },
        joined: ['lena'],
        left: [],
      },
    ]);
  });

  it('reports who joined and who left', () => {
    const calls = new FloorRoomCalls('ground');
    calls.update(inRooms({ elbe: ['lena', 'ben'] }));

    expect(calls.update(inRooms({ elbe: ['mia', 'ben'] }))).toMatchObject([
      { roomCall: { roomId: 'elbe', participants: ['ben', 'mia'] }, joined: ['mia'], left: ['lena'] },
    ]);
  });

  it('stays quiet while nothing changes', () => {
    const calls = new FloorRoomCalls('ground');
    calls.update(inRooms({ elbe: ['lena'] }));

    expect(calls.update(inRooms({ elbe: ['lena'], alster: [] }))).toEqual([]);
  });

  it('ends the call when the last person leaves', () => {
    const calls = new FloorRoomCalls('ground');
    calls.update(inRooms({ elbe: ['lena'] }));

    expect(calls.update(inRooms({}))).toMatchObject([
      { roomCall: { roomId: 'elbe', participants: [] }, joined: [], left: ['lena'] },
    ]);
    expect(calls.all()).toEqual([]);
  });
});
