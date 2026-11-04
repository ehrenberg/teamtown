import { z } from 'zod';
import { PersonId } from '../people/me.ts';

/** Administration of roles and groups (M4b-1, ADR-0038, docs/features/access-administration.md). */

export const AssignableRole = z.enum(['owner', 'admin', 'room-host', 'channel-moderator', 'editor']);
export type AssignableRole = z.infer<typeof AssignableRole>;

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
export const AssignmentSchema = z.object({ principal: Principal, roleId: AssignableRole, scope: ScopeKey });
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
]);
export type AccessErrorCode = z.infer<typeof AccessErrorCode>;
