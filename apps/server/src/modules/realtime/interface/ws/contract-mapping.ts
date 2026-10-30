import type { AvatarState as AvatarStateContract, ServerEvent } from '@teamtown/contracts';
import type { AvatarState, PresenceEvent } from '../../../presence/public-api.ts';

export const toAvatarContract = (avatar: AvatarState): AvatarStateContract => ({
  personId: avatar.occupant.personId,
  displayName: avatar.occupant.displayName,
  avatarColor: avatar.occupant.avatarColor,
  tile: avatar.tile,
  movement: avatar.movement ? { ...avatar.movement, path: [...avatar.movement.path] } : null,
});

export function toServerEvent(event: PresenceEvent): ServerEvent {
  switch (event.type) {
    case 'AvatarJoined':
      return { t: 'AvatarJoined', p: { floorId: event.floorId, avatar: toAvatarContract(event.avatar) } };
    case 'AvatarLeft':
      return { t: 'AvatarLeft', p: { floorId: event.floorId, personId: event.personId } };
    case 'AvatarPathStarted':
      return {
        t: 'AvatarPathStarted',
        p: {
          floorId: event.floorId,
          personId: event.personId,
          movement: { ...event.movement, path: [...event.movement.path] },
        },
      };
  }
}
