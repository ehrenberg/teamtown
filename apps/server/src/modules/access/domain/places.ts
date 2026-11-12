import type { Permission } from './permissions.ts';

/** The kinds of scope a role can be assigned at. */
export type Place = 'town' | 'floor' | 'room' | 'channel';

const TOWN = ['town'] as const;
const FLOOR = ['town', 'floor'] as const;
const ROOM = ['town', 'floor', 'room'] as const;
const CHANNEL = ['town', 'channel'] as const;

/** Where each permission means something. A record, so a new permission can't be forgotten here. */
const PLACES: Readonly<Record<Permission, readonly Place[]>> = {
  'town.manage': TOWN,
  'town.members.invite': TOWN,
  'town.members.manage': TOWN,
  'town.roles.manage': TOWN,
  'town.owners.manage': TOWN,
  'town.audit.read': TOWN,
  'world.view': FLOOR,
  'world.edit': FLOOR,
  'floor.announce': FLOOR,
  'room.enter': ROOM,
  'room.admit': ROOM,
  'room.lock': ROOM,
  'room.policy.manage': ROOM,
  'desk.claim': ROOM,
  'desk.assign': ROOM,
  'meeting.log.start': ROOM,
  'call.join': ROOM,
  'call.speak': ROOM,
  'call.video': ROOM,
  'call.screenshare': ROOM,
  'call.mute.others': ROOM,
  'call.remove.others': ROOM,
  'channel.create.public': TOWN,
  'channel.create.private': TOWN,
  'channel.read': CHANNEL,
  'channel.manage': CHANNEL,
  'message.post': CHANNEL,
  'message.post.announcement': CHANNEL,
  'message.edit.own': CHANNEL,
  'message.delete.own': CHANNEL,
  'message.delete.any': CHANNEL,
  'message.pin': CHANNEL,
  'file.upload': CHANNEL,
  'dm.start': TOWN,
  'call.direct': TOWN,
};

/** Where a role applies: where all its permissions do (P-37). Every role works for the whole town. */
export function placesFor(permissions: readonly Permission[]): Place[] {
  return (['town', 'floor', 'room', 'channel'] as const).filter((place) =>
    permissions.every((permission) => PLACES[permission].includes(place)),
  );
}

/** The kind of place of a scope key (`town`, `floor:…`, `room:…`, `channel:…`). */
export function placeOf(scope: string): Place | null {
  const kind = scope === 'town' ? 'town' : scope.split(':')[0];
  return kind === 'town' || kind === 'floor' || kind === 'room' || kind === 'channel' ? kind : null;
}
