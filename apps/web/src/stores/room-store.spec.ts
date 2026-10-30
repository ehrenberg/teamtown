import { beforeEach, describe, expect, it } from 'vitest';
import { myKnock, roomCallOf, useRoomStore } from './room-store.ts';

const store = () => useRoomStore.getState();

describe('room store', () => {
  beforeEach(() => {
    store().applySnapshot(
      'ground',
      [{ roomId: 'elbe', doorMode: 'knock' }],
      [{ roomId: 'elbe', participants: ['ben'] }],
      [],
    );
  });

  it('follows door modes and room calls on the current floor only', () => {
    store().applyEvent({ t: 'DoorModeChanged', p: { floorId: 'ground', roomId: 'elbe', doorMode: 'locked' } });
    store().applyEvent({ t: 'DoorModeChanged', p: { floorId: 'upper', roomId: 'terrace', doorMode: 'locked' } });
    store().applyEvent({
      t: 'RoomCallChanged',
      p: { floorId: 'ground', roomCall: { roomId: 'elbe', participants: [] } },
    });

    expect(store().doorModes).toEqual({ elbe: 'locked' });
    expect(store().roomCalls).toEqual({});
  });

  it('keeps knocks until they are answered and remembers the answer', () => {
    store().applyEvent({
      t: 'KnockRequested',
      p: { knockId: 'k-1', floorId: 'ground', roomId: 'elbe', requester: 'lena', expiresAt: 1 },
    });
    expect(myKnock(store().knocks, 'lena')?.knockId).toBe('k-1');

    store().applyEvent({ t: 'KnockAnswered', p: { knockId: 'k-1', roomId: 'elbe', outcome: 'declined' } });

    expect(store().knocks).toEqual({});
    expect(store().lastKnockResult).toEqual({ roomId: 'elbe', requester: 'lena', outcome: 'declined' });
  });

  it('finds the room call a person is in', () => {
    expect(roomCallOf(store().roomCalls, 'ben')).toBe('elbe');
    expect(roomCallOf(store().roomCalls, 'lena')).toBeNull();
  });

  it('follows logged meetings and asks for consent', () => {
    store().applyEvent({ t: 'MeetingLogChanged', p: { floorId: 'ground', roomId: 'elbe', active: true } });
    store().applyEvent({ t: 'MeetingLogConsentRequested', p: { roomId: 'elbe', title: 'Retro' } });
    expect(store().loggedRooms).toEqual(['elbe']);
    expect(store().consentRequest).toEqual({ roomId: 'elbe', title: 'Retro' });

    store().applyEvent({ t: 'MeetingLogChanged', p: { floorId: 'ground', roomId: 'elbe', active: false } });
    expect(store().loggedRooms).toEqual([]);
    expect(store().consentRequest).toBeNull();
  });
});
