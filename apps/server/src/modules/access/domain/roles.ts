import { PERMISSIONS, type Permission } from './permissions.ts';

export type BuiltInRole = 'owner' | 'admin' | 'member' | 'guest' | 'room-host' | 'channel-moderator' | 'editor';

/** The built-in roles (docs/architecture/permissions.md §3). Custom roles arrive with M4b. */
export const BUILT_IN_ROLES: Readonly<Record<BuiltInRole, readonly Permission[]>> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS,
  // Also the rights ADR-0031 gave anyone inside a room, and ADR-0033 anyone who creates a channel (ADR-0036, P-33).
  member: [
    'world.view',
    'room.enter',
    'room.admit',
    'room.lock',
    'desk.claim',
    'meeting.log.start',
    'call.join',
    'call.speak',
    'call.video',
    'call.screenshare',
    'call.direct',
    'channel.create.public',
    'channel.create.private',
    'channel.read',
    'message.post',
    'message.edit.own',
    'message.delete.own',
    'file.upload',
    'dm.start',
  ],
  guest: ['world.view', 'room.enter', 'call.join', 'call.speak', 'channel.read', 'message.post'],
  'room-host': ['room.admit', 'room.lock', 'meeting.log.start', 'call.mute.others', 'call.remove.others'],
  'channel-moderator': ['channel.manage', 'message.delete.any', 'message.pin'],
  editor: ['world.edit'],
};
