import type { AvatarState } from '@teamtown/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePresenceStore } from './presence-store.ts';

const avatar = (personId: string): AvatarState => ({
  personId,
  displayName: personId,
  avatarColor: '#D9653B',
  tile: { x: 1, y: 1 },
  movement: null,
});

const movement = { from: { x: 1, y: 1 }, path: [{ x: 2, y: 1 }], startedAt: 1, speedTilesPerSecond: 3 };

describe('presence store', () => {
  beforeEach(() => {
    usePresenceStore.getState().applySnapshot('ground-floor', [avatar('lena')]);
  });

  it('adds and removes avatars on the current floor only', () => {
    const { applyEvent } = usePresenceStore.getState();

    applyEvent({ t: 'AvatarJoined', p: { floorId: 'ground-floor', avatar: avatar('ben') } });
    applyEvent({ t: 'AvatarJoined', p: { floorId: 'upper-floor', avatar: avatar('ana') } });
    applyEvent({ t: 'AvatarLeft', p: { floorId: 'ground-floor', personId: 'lena' } });

    expect(Object.keys(usePresenceStore.getState().avatars)).toEqual(['ben']);
  });

  it('starts movements announced by the server', () => {
    usePresenceStore
      .getState()
      .applyEvent({ t: 'AvatarPathStarted', p: { floorId: 'ground-floor', personId: 'lena', movement } });

    expect(usePresenceStore.getState().avatars.lena?.movement).toEqual(movement);
  });

  it('applies a predicted movement until the server answers', () => {
    usePresenceStore.getState().predictMovement('lena', movement);

    expect(usePresenceStore.getState().avatars.lena?.movement).toEqual(movement);
  });
});
