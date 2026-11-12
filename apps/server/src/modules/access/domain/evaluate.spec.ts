import { describe, expect, it } from 'vitest';
import { holds, type RoleAssignment } from './evaluate.ts';
import type { Permission } from './permissions.ts';
import { scopeKey, TOWN, type ScopeRef } from './scope.ts';

const channel: ScopeRef = { kind: 'channel', channelId: 'c1' };
const otherChannel: ScopeRef = { kind: 'channel', channelId: 'c2' };
const secret: ScopeRef = { kind: 'channel', channelId: 'c3', private: true };
const room: ScopeRef = { kind: 'room', floorId: 'f1', roomId: 'r1' };
const lockedRoom: ScopeRef = { ...room, private: true };
const floor: ScopeRef = { kind: 'floor', floorId: 'f1' };

const member: RoleAssignment = { roleId: 'member', scope: 'town' };
const admin: RoleAssignment = { roleId: 'admin', scope: 'town' };
const moderator: RoleAssignment = { roleId: 'channel-moderator', scope: scopeKey(channel) };
const secretModerator: RoleAssignment = { roleId: 'channel-moderator', scope: scopeKey(secret) };
const host: RoleAssignment = { roleId: 'room-host', scope: scopeKey(floor) };
const guest: RoleAssignment = { roleId: 'guest', scope: scopeKey(secret) };

describe('holds', () => {
  it.each<[string, RoleAssignment[], Permission, ScopeRef, boolean]>([
    ['a member reads public channels', [member], 'channel.read', channel, true],
    ['a member creates private channels (P-33)', [member], 'channel.create.private', TOWN, true],
    ['a member switches doors from inside (ADR-0036)', [member], 'room.lock', room, true],
    ['a member does not moderate', [member], 'channel.manage', channel, false],
    ['a member does not delete other messages', [member], 'message.delete.any', channel, false],
    ['a moderator moderates their channel', [moderator], 'channel.manage', channel, true],
    ['a moderator does not moderate another channel', [moderator], 'channel.manage', otherChannel, false],
    ['roles inherit from the town down', [admin], 'message.pin', channel, true],
    ['roles inherit from the floor to its rooms', [host], 'room.admit', room, true],
    ['roles do not inherit upwards', [host], 'room.admit', { kind: 'floor', floorId: 'f2' }, false],
    ['a private channel stops inherited reading', [admin], 'channel.read', secret, false],
    ['a locked room stops inherited entering', [admin], 'room.enter', lockedRoom, false],
    ['management still inherits into private channels', [admin], 'channel.manage', secret, true],
    ['an assignment at the private channel itself grants reading', [guest], 'channel.read', secret, true],
    ['a moderator there still gets no reading from it', [secretModerator], 'channel.read', secret, false],
    ['nothing assigned, nothing held', [], 'channel.read', channel, false],
  ])('%s', (_, assignments, permission, resource, expected) => {
    expect(holds(assignments, permission, resource)).toBe(expected);
  });

  it('never lets a town role read private content, whichever it is (ADR-0026)', () => {
    for (const roleId of ['owner', 'admin', 'member', 'editor'] as const) {
      expect(holds([{ roleId, scope: 'town' }], 'channel.read', secret)).toBe(false);
    }
  });
});

describe('holds with custom roles', () => {
  it("reads a custom role's permissions, and grants nothing for one that is gone", () => {
    const teamLead: RoleAssignment = { roleId: 'custom-1', scope: 'town' };
    const lookup = (roleId: string) => (roleId === 'custom-1' ? (['message.pin'] as const) : undefined);

    expect(holds([teamLead], 'message.pin', channel, lookup)).toBe(true);
    expect(holds([teamLead], 'message.pin', channel)).toBe(false);
  });
});
