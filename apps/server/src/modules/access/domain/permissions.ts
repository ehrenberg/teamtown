/** The permission catalogue (docs/architecture/permissions.md, P-33). */
export const PERMISSIONS = [
  'town.manage',
  'town.members.invite',
  'town.members.manage',
  'town.roles.manage',
  /** Owners only: appointing Owners and taking the role back (ADR-0038). */
  'town.owners.manage',
  'town.audit.read',
  'world.view',
  'world.edit',
  'room.enter',
  'room.admit',
  'room.lock',
  'room.policy.manage',
  'desk.claim',
  'desk.assign',
  'meeting.log.start',
  'call.join',
  'call.speak',
  'call.video',
  'call.screenshare',
  'call.mute.others',
  'call.remove.others',
  'floor.announce',
  'channel.create.public',
  'channel.create.private',
  'channel.read',
  'channel.manage',
  'message.post',
  'message.post.announcement',
  'message.edit.own',
  'message.delete.own',
  'message.delete.any',
  'message.pin',
  'file.upload',
  'dm.start',
  'call.direct',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Permissions about access itself: a private resource stops their inheritance (ADR-0011, ADR-0026). */
export const ACCESS_PERMISSIONS: ReadonlySet<Permission> = new Set(['channel.read', 'room.enter']);
