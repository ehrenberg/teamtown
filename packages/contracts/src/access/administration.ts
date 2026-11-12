import { z } from 'zod';
import { PersonId } from '../people/me.ts';

/** Administration of roles and groups (M4b-1, ADR-0038, docs/features/access-administration.md). */

export const AssignableRole = z.enum(['owner', 'admin', 'room-host', 'channel-moderator', 'editor']);
export type AssignableRole = z.infer<typeof AssignableRole>;

/** A role an Owner or Admin put together (M4b-2). */
export const CustomRoleId = z.string().regex(/^custom-[A-Za-z0-9-]{1,57}$/);
export const RoleId = z.union([AssignableRole, CustomRoleId]);

/** The permission catalogue (docs/architecture/permissions.md, P-33); the server's copy is checked against it. */
export const Permission = z.enum([
  'town.manage',
  'town.members.invite',
  'town.members.manage',
  'town.roles.manage',
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
]);
export type Permission = z.infer<typeof Permission>;

export const Place = z.enum(['town', 'floor', 'room', 'channel']);
export type Place = z.infer<typeof Place>;

export const RoleSchema = z.object({
  roleId: RoleId,
  /** `null` for built-in roles, which the client names. */
  name: z.string().nullable(),
  permissions: z.array(Permission),
  builtIn: z.boolean(),
  /** Where it can be assigned; follows from its permissions (P-37). */
  places: z.array(Place),
});
export type RoleContract = z.infer<typeof RoleSchema>;

/** `POST /api/access/roles`, `PATCH /api/access/roles/{roleId}`. */
export const CustomRoleRequest = z.object({
  name: z.string().min(1).max(80),
  permissions: z.array(Permission).min(1),
});
export type CustomRoleRequest = z.infer<typeof CustomRoleRequest>;

export const GroupId = z.string().min(1).max(64);
export const MAX_GROUP_NAME_LENGTH = 80;

export const Principal = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('person'), id: PersonId }),
  z.object({ kind: z.literal('group'), id: GroupId }),
]);
export type Principal = z.infer<typeof Principal>;

/** Where a role applies, in text form: `town`, `floor:<id>`, `room:<floorId>/<roomId>`, `channel:<id>`. */
export const ScopeKey = z.string().regex(/^(town|floor:[^/\s]+|room:[^/\s]+\/[^/\s]+|channel:[^/\s]+)$/);

/** `PUT` and `DELETE /api/access/assignments`; idempotent. */
export const AssignmentSchema = z.object({ principal: Principal, roleId: RoleId, scope: ScopeKey });
export type AssignmentContract = z.infer<typeof AssignmentSchema>;

export const GroupSchema = z.object({
  groupId: GroupId,
  name: z.string().min(1).max(MAX_GROUP_NAME_LENGTH),
  memberIds: z.array(PersonId),
});
export type GroupContract = z.infer<typeof GroupSchema>;

/** `GET /api/access/overview`. Names of people, floors and channels come from their own endpoints. */
export const AccessOverviewResponse = z.object({
  assignments: z.array(AssignmentSchema),
  groups: z.array(GroupSchema),
  roles: z.array(RoleSchema),
});
export type AccessOverviewResponse = z.infer<typeof AccessOverviewResponse>;

/** `GET /api/access/me`: what the person may administer. */
export const MyAccessResponse = z.object({ canManageRoles: z.boolean(), canManageOwners: z.boolean() });
export type MyAccessResponse = z.infer<typeof MyAccessResponse>;

/** `POST /api/access/groups`, `PATCH /api/access/groups/{groupId}`. */
export const GroupNameRequest = z.object({ name: z.string().min(1).max(MAX_GROUP_NAME_LENGTH) });
export type GroupNameRequest = z.infer<typeof GroupNameRequest>;

/** Stable error codes in the `message` field of 4xx answers, translated in the client. */
export const AccessErrorCode = z.enum([
  'invalid-request',
  'not-allowed',
  /** A town keeps at least one Owner (ADR-0038). */
  'last-owner',
  'group-name-taken',
  'invalid-group-name',
  /** This role can't be given to that principal, or at that scope. */
  'role-not-assignable',
  /** A custom role needs a name and permissions, and can't hold `town.owners.manage` (P-36). */
  'invalid-role',
  'role-name-taken',
  /** The role is assigned somewhere its new permissions don't apply; take those back first. */
  'role-assigned-elsewhere',
  /** Built-in roles stay as they are (P-39). */
  'built-in-role',
]);
export type AccessErrorCode = z.infer<typeof AccessErrorCode>;
