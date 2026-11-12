import { unwrap } from '@teamtown/kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Assignment } from '../domain/assignment.ts';
import type { CustomRole } from '../domain/custom-role.ts';
import type { RoleAssignment } from '../domain/evaluate.ts';
import { CachedAccessPolicy } from './access-policy.ts';
import { AdministerCustomRoles } from './administer-custom-roles.ts';
import { AssignRole } from './administer-roles.ts';
import type { AssignmentRepository } from './ports/assignment-repository.port.ts';
import type { RoleRepository } from './ports/role-repository.port.ts';

/** Assignments and custom roles in memory, deleting a role's assignments with it like the database does. */
class InMemory implements AssignmentRepository, RoleRepository {
  rows: Assignment[] = [];
  roles: CustomRole[] = [];

  assignmentsOf(personId: string): Promise<RoleAssignment[]> {
    return Promise.resolve(this.rows.filter((row) => row.principal.id === personId));
  }
  listAll = () => Promise.resolve([...this.rows]);
  assignToPerson = () => Promise.resolve();
  assign(assignment: Assignment): Promise<void> {
    this.rows.push(assignment);
    return Promise.resolve();
  }
  revoke = () => Promise.resolve();
  revokeOwner = () => Promise.resolve(false);
  claimOwner = () => Promise.resolve(false);
  list(): Promise<CustomRole[]> {
    return Promise.resolve([...this.roles]);
  }
  create(role: CustomRole): Promise<boolean> {
    if (this.roles.some((other) => other.name === role.name)) return Promise.resolve(false);
    this.roles.push(role);
    return Promise.resolve(true);
  }
  update(role: CustomRole): Promise<boolean> {
    if (this.roles.some((other) => other.name === role.name && other.roleId !== role.roleId)) {
      return Promise.resolve(false);
    }
    this.roles = this.roles.map((other) => (other.roleId === role.roleId ? role : other));
    return Promise.resolve(true);
  }
  delete(roleId: string): Promise<number> {
    const removed = this.rows.filter((row) => row.roleId === roleId).length;
    this.rows = this.rows.filter((row) => row.roleId !== roleId);
    this.roles = this.roles.filter((role) => role.roleId !== roleId);
    return Promise.resolve(removed);
  }
  scopesOf(roleId: string): Promise<string[]> {
    return Promise.resolve(this.rows.filter((row) => row.roleId === roleId).map((row) => row.scope));
  }
}

const person = (id: string) => ({ kind: 'person', id }) as const;
const room = { kind: 'room', floorId: 'f1', roomId: 'r1' } as const;
const channel = { kind: 'channel', channelId: 'c1' } as const;

describe('Custom roles (M4b-2)', () => {
  let store: InMemory;
  let policy: CachedAccessPolicy;
  let roles: AdministerCustomRoles;
  let assign: AssignRole;

  beforeEach(() => {
    store = new InMemory();
    store.rows.push({ principal: person('ada'), roleId: 'admin', scope: 'town' });
    policy = new CachedAccessPolicy(store, store);
    let next = 0;
    roles = new AdministerCustomRoles(policy, store, { next: () => String(++next) });
    assign = new AssignRole(store, policy);
  });

  const teamLead = () => roles.create({ actorId: 'ada', name: 'Team Lead', permissions: ['room.lock', 'message.pin'] });

  it("gives a new role's permissions at once, only where they apply (P-37)", async () => {
    const roleId = unwrap(await teamLead());
    expect(await policy.can('ben', 'message.pin', channel)).toBe(false);

    const onRoom: Assignment = { principal: person('ben'), roleId, scope: 'room:f1/r1' };
    expect(await assign.execute({ actorId: 'ada', assignment: onRoom })).toEqual({
      ok: false,
      error: 'role-not-assignable',
    });
    unwrap(await assign.execute({ actorId: 'ada', assignment: { ...onRoom, scope: 'town' } }));

    expect(await policy.can('ben', 'message.pin', channel)).toBe(true);
    expect(await policy.can('ben', 'room.lock', room)).toBe(true);
  });

  it('applies a change at once to whoever holds the role (P-38)', async () => {
    const roleId = unwrap(await teamLead());
    unwrap(await assign.execute({ actorId: 'ada', assignment: { principal: person('ben'), roleId, scope: 'town' } }));
    expect(await policy.can('ben', 'message.pin', channel)).toBe(true);

    unwrap(await roles.update({ actorId: 'ada', roleId, name: 'Team Lead', permissions: ['room.lock'] }));

    expect(await policy.can('ben', 'message.pin', channel)).toBe(false);
    expect(await policy.can('ben', 'room.lock', room)).toBe(true);
  });

  it('refuses a change that no longer fits where the role is assigned', async () => {
    const roleId = unwrap(await roles.create({ actorId: 'ada', name: 'Hosts', permissions: ['room.lock'] }));
    unwrap(
      await assign.execute({ actorId: 'ada', assignment: { principal: person('ben'), roleId, scope: 'room:f1/r1' } }),
    );

    expect(await roles.update({ actorId: 'ada', roleId, name: 'Hosts', permissions: ['message.pin'] })).toEqual({
      ok: false,
      error: 'role-assigned-elsewhere',
    });
    expect(store.roles[0]?.permissions).toEqual(['room.lock']);
  });

  it('takes a deleted role from everyone holding it', async () => {
    const roleId = unwrap(await teamLead());
    for (const id of ['ben', 'carl']) {
      unwrap(await assign.execute({ actorId: 'ada', assignment: { principal: person(id), roleId, scope: 'town' } }));
    }
    await policy.can('ben', 'message.pin', channel);

    expect(await roles.delete({ actorId: 'ada', roleId })).toEqual({ ok: true, value: 2 });

    expect(await policy.can('ben', 'message.pin', channel)).toBe(false);
    expect(await policy.can('carl', 'room.lock', room)).toBe(true);
  });

  it('keeps built-in roles fixed and the Owner permission out (P-36, P-39)', async () => {
    expect(await roles.update({ actorId: 'ada', roleId: 'admin', name: 'x', permissions: ['room.lock'] })).toEqual({
      ok: false,
      error: 'built-in-role',
    });
    expect(await roles.delete({ actorId: 'ada', roleId: 'room-host' })).toEqual({ ok: false, error: 'built-in-role' });
    expect(await roles.create({ actorId: 'ada', name: 'Kingmaker', permissions: ['town.owners.manage'] })).toEqual({
      ok: false,
      error: 'invalid-role',
    });
  });

  it('keeps names unique and leaves roles to administrators', async () => {
    unwrap(await teamLead());
    expect(await teamLead()).toEqual({ ok: false, error: 'role-name-taken' });
    expect(await roles.create({ actorId: 'ben', name: 'Mine', permissions: ['room.lock'] })).toEqual({
      ok: false,
      error: 'not-allowed',
    });
  });

  it('lists the built-in roles with their places, then the custom ones', async () => {
    unwrap(await teamLead());
    const list = await roles.list();
    expect(list.map((role) => [role.roleId, role.places])).toEqual([
      ['owner', ['town']],
      ['admin', ['town']],
      ['room-host', ['town', 'floor', 'room']],
      ['channel-moderator', ['town', 'channel']],
      ['editor', ['town', 'floor']],
      ['custom-1', ['town']],
    ]);
  });
});
