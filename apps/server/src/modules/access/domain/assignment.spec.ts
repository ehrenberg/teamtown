import { describe, expect, it } from 'vitest';
import { checkAssignable, type Assignment } from './assignment.ts';

const person = { kind: 'person', id: 'anna' } as const;
const group = { kind: 'group', id: 'team' } as const;

describe('checkAssignable', () => {
  it.each<[string, Assignment]>([
    ['Admin for the town', { principal: person, roleId: 'admin', scope: 'town' }],
    ['Owner for a person', { principal: person, roleId: 'owner', scope: 'town' }],
    ['Editor for a floor', { principal: group, roleId: 'editor', scope: 'floor:f1' }],
    ['Room Host for a room', { principal: group, roleId: 'room-host', scope: 'room:f1/r1' }],
    ['Room Host for a floor', { principal: person, roleId: 'room-host', scope: 'floor:f1' }],
    ['Channel Moderator for a channel', { principal: group, roleId: 'channel-moderator', scope: 'channel:c1' }],
  ])('accepts %s', (_, assignment) => {
    expect(checkAssignable(assignment).ok).toBe(true);
  });

  it.each<[string, Assignment]>([
    ['Owner for a group (ADR-0038)', { principal: group, roleId: 'owner', scope: 'town' }],
    ['Owner below the town', { principal: person, roleId: 'owner', scope: 'floor:f1' }],
    ['Admin for a channel', { principal: person, roleId: 'admin', scope: 'channel:c1' }],
    ['Editor for a room', { principal: person, roleId: 'editor', scope: 'room:f1/r1' }],
    ['Room Host for a channel', { principal: person, roleId: 'room-host', scope: 'channel:c1' }],
    ['Channel Moderator for a room', { principal: person, roleId: 'channel-moderator', scope: 'room:f1/r1' }],
  ])('refuses %s', (_, assignment) => {
    expect(checkAssignable(assignment)).toEqual({ ok: false, error: 'role-not-assignable' });
  });
});
