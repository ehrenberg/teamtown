import { unwrap } from '@teamtown/kernel';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Assignment } from '../domain/assignment.ts';
import type { RoleAssignment } from '../domain/evaluate.ts';
import { CachedAccessPolicy } from './access-policy.ts';
import { AdministerCustomRoles } from './administer-custom-roles.ts';
import { AdministerGroups, GetAccessOverview } from './administer-groups.ts';
import { AssignRole, GetMyAccess, RevokeRole } from './administer-roles.ts';
import type { AssignmentRepository } from './ports/assignment-repository.port.ts';
import type { RoleRepository } from './ports/role-repository.port.ts';
import type { GroupRepository, GroupView } from './ports/group-repository.port.ts';

class InMemoryAccess implements AssignmentRepository, GroupRepository {
  rows: Assignment[] = [];
  groups: GroupView[] = [];

  assignmentsOf(personId: string): Promise<RoleAssignment[]> {
    const own = new Set(this.groups.filter((g) => g.memberIds.includes(personId)).map((g) => g.groupId));
    return Promise.resolve(
      this.rows
        .filter((row) => (row.principal.kind === 'person' ? row.principal.id === personId : own.has(row.principal.id)))
        .map(({ roleId, scope }) => ({ roleId, scope })),
    );
  }
  listAll(): Promise<Assignment[]> {
    return Promise.resolve([...this.rows]);
  }
  assignToPerson(personId: string, assignment: RoleAssignment): Promise<void> {
    return this.assign({ ...assignment, principal: { kind: 'person', id: personId } });
  }
  assign(assignment: Assignment): Promise<void> {
    if (!this.rows.some((row) => same(row, assignment))) this.rows.push(assignment);
    return Promise.resolve();
  }
  revoke(assignment: Assignment): Promise<void> {
    this.rows = this.rows.filter((row) => !same(row, assignment));
    return Promise.resolve();
  }
  revokeOwner(personId: string): Promise<boolean> {
    const owners = this.rows.filter((row) => row.roleId === 'owner');
    if (owners.length <= 1) return Promise.resolve(false);
    this.rows = this.rows.filter((row) => !(row.roleId === 'owner' && row.principal.id === personId));
    return Promise.resolve(true);
  }
  claimOwner(): Promise<boolean> {
    return Promise.resolve(false);
  }
  list(): Promise<GroupView[]> {
    return Promise.resolve([...this.groups]);
  }
  exists(groupId: string): Promise<boolean> {
    return Promise.resolve(this.groups.some((group) => group.groupId === groupId));
  }
  create(groupId: string, name: string): Promise<boolean> {
    if (this.groups.some((group) => group.name === name)) return Promise.resolve(false);
    this.groups.push({ groupId, name, memberIds: [] });
    return Promise.resolve(true);
  }
  rename(groupId: string, name: string): Promise<boolean> {
    if (this.groups.some((group) => group.name === name && group.groupId !== groupId)) return Promise.resolve(false);
    this.groups = this.groups.map((group) => (group.groupId === groupId ? { ...group, name } : group));
    return Promise.resolve(true);
  }
  delete(groupId: string): Promise<void> {
    this.groups = this.groups.filter((group) => group.groupId !== groupId);
    this.rows = this.rows.filter((row) => !(row.principal.kind === 'group' && row.principal.id === groupId));
    return Promise.resolve();
  }
  addMember(groupId: string, personId: string): Promise<void> {
    this.groups = this.groups.map((g) =>
      g.groupId === groupId ? { ...g, memberIds: [...new Set([...g.memberIds, personId])] } : g,
    );
    return Promise.resolve();
  }
  removeMember(groupId: string, personId: string): Promise<void> {
    this.groups = this.groups.map((g) =>
      g.groupId === groupId ? { ...g, memberIds: g.memberIds.filter((id) => id !== personId) } : g,
    );
    return Promise.resolve();
  }
}

const same = (a: Assignment, b: Assignment) =>
  a.roleId === b.roleId &&
  a.scope === b.scope &&
  a.principal.kind === b.principal.kind &&
  a.principal.id === b.principal.id;

const person = (id: string) => ({ kind: 'person', id }) as const;
const owner = (id: string): Assignment => ({ principal: person(id), roleId: 'owner', scope: 'town' });
const admin = (id: string): Assignment => ({ principal: person(id), roleId: 'admin', scope: 'town' });
const hostOfRoom = (principal: Assignment['principal']): Assignment => ({
  principal,
  roleId: 'room-host',
  scope: 'room:f1/r1',
});
const room = { kind: 'room', floorId: 'f1', roomId: 'r1' } as const;

const noCustomRoles: RoleRepository = {
  list: () => Promise.resolve([]),
  create: () => Promise.resolve(true),
  update: () => Promise.resolve(true),
  delete: () => Promise.resolve(0),
  scopesOf: () => Promise.resolve([]),
};

describe('Administration', () => {
  let repository: InMemoryAccess;
  let policy: CachedAccessPolicy;
  let assign: AssignRole;
  let revoke: RevokeRole;
  let groups: AdministerGroups;
  let overview: GetAccessOverview;
  let me: GetMyAccess;

  beforeEach(async () => {
    repository = new InMemoryAccess();
    policy = new CachedAccessPolicy(repository, noCustomRoles);
    assign = new AssignRole(repository, policy);
    revoke = new RevokeRole(repository, policy);
    let next = 0;
    groups = new AdministerGroups(policy, repository, { next: () => `g${String(++next)}` });
    overview = new GetAccessOverview(
      policy,
      repository,
      repository,
      new AdministerCustomRoles(policy, noCustomRoles, { next: () => 'r' }),
    );
    me = new GetMyAccess(policy);
    await repository.assign(owner('olga'));
    await repository.assign(admin('ada'));
  });

  it('tells who may administer what (ADR-0038)', async () => {
    expect(await me.execute('olga')).toEqual({ canManageRoles: true, canManageOwners: true });
    expect(await me.execute('ada')).toEqual({ canManageRoles: true, canManageOwners: false });
    expect(await me.execute('ben')).toEqual({ canManageRoles: false, canManageOwners: false });
  });

  it('keeps the overview from members', async () => {
    expect(await overview.execute('ben')).toEqual({ ok: false, error: 'not-allowed' });
    expect(unwrap(await overview.execute('ada')).assignments).toHaveLength(2);
  });

  it('applies a new role at once, also when the rights were already looked up', async () => {
    expect(await policy.can('ben', 'room.admit', { ...room, private: true })).toBe(true);
    expect(await policy.can('ben', 'call.mute.others', room)).toBe(false);

    unwrap(await assign.execute({ actorId: 'ada', assignment: hostOfRoom(person('ben')) }));

    expect(await policy.can('ben', 'call.mute.others', room)).toBe(true);
    unwrap(await revoke.execute({ actorId: 'ada', assignment: hostOfRoom(person('ben')) }));
    expect(await policy.can('ben', 'call.mute.others', room)).toBe(false);
  });

  it('refuses a member and a role that does not fit', async () => {
    expect(await assign.execute({ actorId: 'ben', assignment: admin('ben') })).toEqual({
      ok: false,
      error: 'not-allowed',
    });
    const assignment: Assignment = { principal: person('ben'), roleId: 'admin', scope: 'channel:c1' };
    expect(await assign.execute({ actorId: 'ada', assignment })).toEqual({
      ok: false,
      error: 'role-not-assignable',
    });
  });

  it('leaves the Owner role to Owners (ADR-0038)', async () => {
    expect(await assign.execute({ actorId: 'ada', assignment: owner('ada') })).toEqual({
      ok: false,
      error: 'not-allowed',
    });
    expect(await revoke.execute({ actorId: 'ada', assignment: owner('olga') })).toEqual({
      ok: false,
      error: 'not-allowed',
    });
    unwrap(await assign.execute({ actorId: 'olga', assignment: owner('ada') }));
    expect(await me.execute('ada')).toMatchObject({ canManageOwners: true });
  });

  it('keeps at least one Owner, who may give up the role while another remains', async () => {
    expect(await revoke.execute({ actorId: 'olga', assignment: owner('olga') })).toEqual({
      ok: false,
      error: 'last-owner',
    });

    unwrap(await assign.execute({ actorId: 'olga', assignment: owner('ada') }));
    unwrap(await revoke.execute({ actorId: 'olga', assignment: owner('olga') }));

    expect(await me.execute('olga')).toMatchObject({ canManageOwners: false });
    expect(await me.execute('ada')).toMatchObject({ canManageOwners: true });
  });

  it("gives a group's roles to its members, until they leave it", async () => {
    const groupId = unwrap(await groups.create({ actorId: 'ada', name: ' Empfang ' }));
    expect(repository.groups[0]?.name).toBe('Empfang');
    unwrap(await assign.execute({ actorId: 'ada', assignment: hostOfRoom({ kind: 'group', id: groupId }) }));
    expect(await policy.can('ben', 'call.mute.others', room)).toBe(false);

    unwrap(await groups.setMember({ actorId: 'ada', groupId, personId: 'ben', member: true }));
    expect(await policy.can('ben', 'call.mute.others', room)).toBe(true);

    unwrap(await groups.setMember({ actorId: 'ada', groupId, personId: 'ben', member: false }));
    expect(await policy.can('ben', 'call.mute.others', room)).toBe(false);
  });

  it("drops a deleted group's assignments", async () => {
    const groupId = unwrap(await groups.create({ actorId: 'ada', name: 'Empfang' }));
    unwrap(await groups.setMember({ actorId: 'ada', groupId, personId: 'ben', member: true }));
    unwrap(await assign.execute({ actorId: 'ada', assignment: hostOfRoom({ kind: 'group', id: groupId }) }));
    await policy.can('ben', 'call.mute.others', room);

    unwrap(await groups.delete({ actorId: 'ada', groupId }));

    expect(await policy.can('ben', 'call.mute.others', room)).toBe(false);
  });

  it('checks group names and rights', async () => {
    expect(await groups.create({ actorId: 'ben', name: 'Team' })).toEqual({ ok: false, error: 'not-allowed' });
    expect(await groups.create({ actorId: 'ada', name: '  ' })).toEqual({ ok: false, error: 'invalid-group-name' });
    unwrap(await groups.create({ actorId: 'ada', name: 'Team' }));
    expect(await groups.create({ actorId: 'ada', name: 'Team' })).toEqual({ ok: false, error: 'group-name-taken' });
    expect(await groups.delete({ actorId: 'ada', groupId: 'nope' })).toEqual({ ok: false, error: 'not-found' });
  });
});
