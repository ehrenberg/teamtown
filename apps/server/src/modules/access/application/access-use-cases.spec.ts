import { beforeEach, describe, expect, it } from 'vitest';
import type { RoleAssignment } from '../domain/evaluate.ts';
import { CachedAccessPolicy } from './access-policy.ts';
import { AssignChannelModerator } from './assign-channel-moderator.ts';
import { ClaimFirstOwner } from './claim-first-owner.ts';
import type { AssignmentRepository } from './ports/assignment-repository.port.ts';

class InMemoryAssignments implements AssignmentRepository {
  readonly byPerson = new Map<string, RoleAssignment[]>();
  owner: string | null = null;
  loads = 0;
  claims = 0;

  assignmentsOf(personId: string): Promise<RoleAssignment[]> {
    this.loads += 1;
    return Promise.resolve([...(this.byPerson.get(personId) ?? [])]);
  }
  assignToPerson(personId: string, assignment: RoleAssignment): Promise<void> {
    this.byPerson.set(personId, [...(this.byPerson.get(personId) ?? []), assignment]);
    return Promise.resolve();
  }
  async claimOwner(personId: string): Promise<boolean> {
    this.claims += 1;
    if (this.owner) return false;
    this.owner = personId;
    await this.assignToPerson(personId, { roleId: 'owner', scope: 'town' });
    return true;
  }
}

const channel = { kind: 'channel', channelId: 'c1' } as const;

describe('Access use cases', () => {
  let repository: InMemoryAssignments;
  let policy: CachedAccessPolicy;
  let claim: ClaimFirstOwner;

  beforeEach(() => {
    repository = new InMemoryAssignments();
    policy = new CachedAccessPolicy(repository);
    claim = new ClaimFirstOwner(repository, policy);
  });

  it('gives everyone the Member role without an assignment', async () => {
    expect(await policy.can('anna', 'channel.create.private', { kind: 'town' })).toBe(true);
    expect(await policy.can('anna', 'channel.manage', channel)).toBe(false);
  });

  it('makes the first person to sign in the Owner, and nobody after them (ADR-0036)', async () => {
    await policy.can('anna', 'channel.manage', channel);

    await claim.execute('anna');
    await claim.execute('ben');

    expect(await policy.can('anna', 'channel.manage', channel)).toBe(true);
    expect(await policy.can('ben', 'channel.manage', channel)).toBe(false);
  });

  it('stops asking the database once the Owner is settled', async () => {
    await claim.execute('anna');
    await claim.execute('ben');
    await claim.execute('carl');

    expect(repository.claims).toBe(1);
  });

  it('settles on a restart without changing the Owner', async () => {
    await claim.execute('anna');

    await new ClaimFirstOwner(repository, new CachedAccessPolicy(repository)).execute('ben');

    expect(repository.owner).toBe('anna');
  });

  it('remembers assignments until they change, and sees the change at once', async () => {
    const assign = new AssignChannelModerator(repository, policy);
    await policy.can('anna', 'message.pin', channel);
    await policy.can('anna', 'message.pin', channel);
    expect(repository.loads).toBe(1);

    await assign.execute({ personId: 'anna', channelId: 'c1' });

    expect(await policy.can('anna', 'message.pin', channel)).toBe(true);
  });

  it('does not keep a failed load', async () => {
    repository.assignmentsOf = () => Promise.reject(new Error('database down'));
    await expect(policy.can('anna', 'message.pin', channel)).rejects.toThrow('database down');

    repository.assignmentsOf = () => Promise.resolve([{ roleId: 'admin', scope: 'town' }]);
    expect(await policy.can('anna', 'message.pin', channel)).toBe(true);
  });
});
