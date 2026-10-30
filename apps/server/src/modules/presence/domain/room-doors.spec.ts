import { describe, expect, it } from 'vitest';
import { ENTRY_PASS_MS, RETURN_GRACE_MS, RoomDoors } from './room-doors.ts';

const NOW = 1_000_000;

const aBuilding = () =>
  new RoomDoors([
    { roomId: 'hall', doorMode: 'open', doorModeAdjustable: false },
    { roomId: 'elbe', doorMode: 'knock', doorModeAdjustable: true },
    { roomId: 'alster', doorMode: 'open', doorModeAdjustable: true },
  ]);

const inRooms = (entries: Record<string, string | null>) => new Map(Object.entries(entries));

describe('RoomDoors', () => {
  it('starts with the door modes of the floor plan', () => {
    expect(aBuilding().modes()).toEqual([
      { roomId: 'hall', doorMode: 'open' },
      { roomId: 'elbe', doorMode: 'knock' },
      { roomId: 'alster', doorMode: 'open' },
    ]);
  });

  it('lets occupants change the door mode', () => {
    const doors = aBuilding();
    doors.update(inRooms({ lena: 'alster' }), NOW);

    expect(doors.setMode('lena', 'alster', 'locked')).toEqual({ ok: true, value: true });
    expect(doors.modeOf('alster')).toBe('locked');
    expect(doors.setMode('lena', 'alster', 'locked')).toEqual({ ok: true, value: false });
  });

  it('rejects door mode changes from outside, in fixed rooms and for unknown rooms', () => {
    const doors = aBuilding();
    doors.update(inRooms({ lena: 'hall', ben: 'alster' }), NOW);

    expect(doors.setMode('lena', 'alster', 'locked')).toEqual({ ok: false, error: 'not-in-room' });
    expect(doors.setMode('lena', 'hall', 'locked')).toEqual({ ok: false, error: 'door-mode-fixed' });
    expect(doors.setMode('lena', 'nowhere', 'locked')).toEqual({ ok: false, error: 'room-not-found' });
  });

  it('resets the door mode when the last occupant leaves', () => {
    const doors = aBuilding();
    doors.update(inRooms({ lena: 'alster', ben: 'alster' }), NOW);
    doors.setMode('lena', 'alster', 'locked');

    expect(doors.update(inRooms({ lena: 'hall', ben: 'alster' }), NOW)).toEqual([]);
    expect(doors.update(inRooms({ lena: 'hall', ben: 'hall' }), NOW)).toEqual([{ roomId: 'alster', doorMode: 'open' }]);
    expect(doors.modeOf('alster')).toBe('open');
  });

  it('lets everyone into open rooms and empty rooms', () => {
    const doors = aBuilding();

    expect(doors.mayEnter('lena', 'hall', NOW)).toBe(true);
    expect(doors.mayEnter('lena', 'elbe', NOW)).toBe(true);
  });

  it('keeps newcomers out of occupied knock and locked rooms', () => {
    const doors = aBuilding();
    doors.update(inRooms({ ben: 'elbe', mia: 'alster' }), NOW);
    doors.setMode('mia', 'alster', 'locked');

    expect(doors.mayEnter('lena', 'elbe', NOW)).toBe(false);
    expect(doors.mayEnter('lena', 'alster', NOW)).toBe(false);
  });

  it('lets an admitted person in until the entry pass expires or is used', () => {
    const doors = aBuilding();
    doors.update(inRooms({ ben: 'elbe', lena: 'hall' }), NOW);
    doors.grantPass('lena', 'elbe', NOW);

    expect(doors.mayEnter('lena', 'elbe', NOW + ENTRY_PASS_MS)).toBe(true);
    expect(doors.mayEnter('lena', 'elbe', NOW + ENTRY_PASS_MS + 1)).toBe(false);
    expect(doors.mayEnter('lena', 'alster', NOW)).toBe(true);

    doors.update(inRooms({ ben: 'elbe', lena: 'elbe' }), NOW + 1_000);
    doors.update(inRooms({ ben: 'elbe', lena: 'hall' }), NOW + RETURN_GRACE_MS + 2_000);
    expect(doors.mayEnter('lena', 'elbe', NOW + RETURN_GRACE_MS + 2_000)).toBe(true);
    expect(doors.mayEnter('lena', 'elbe', NOW + 2 * RETURN_GRACE_MS + 2_001)).toBe(false);
  });

  it('lets people who left return within the grace period', () => {
    const doors = aBuilding();
    doors.update(inRooms({ ben: 'elbe', lena: 'elbe' }), NOW);
    doors.update(inRooms({ ben: 'elbe', lena: 'hall' }), NOW);

    expect(doors.mayEnter('lena', 'elbe', NOW + RETURN_GRACE_MS)).toBe(true);
    expect(doors.mayEnter('lena', 'elbe', NOW + RETURN_GRACE_MS + 1)).toBe(false);
  });

  it('starts the grace period when someone leaves the floor from inside a room', () => {
    const doors = aBuilding();
    doors.update(inRooms({ ben: 'elbe', lena: 'elbe' }), NOW);
    doors.update(inRooms({ ben: 'elbe' }), NOW);

    expect(doors.mayEnter('lena', 'elbe', NOW + 1_000)).toBe(true);
  });

  it('knows who is inside a room', () => {
    const doors = aBuilding();
    doors.update(inRooms({ ben: 'elbe', lena: 'elbe', mia: null }), NOW);

    expect(doors.occupantsOf('elbe')).toEqual(['ben', 'lena']);
    expect(doors.roomOf('mia')).toBeNull();
  });
});
