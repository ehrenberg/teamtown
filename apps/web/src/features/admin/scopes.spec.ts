import type { FloorPlan } from '@teamtown/contracts';
import { describe, expect, it } from 'vitest';
import { scopeLabel, scopesFor, type Places } from './scopes.ts';

const t = ((key: string) => key) as never;
const plan = { floorId: 'f1', name: 'Ground', rooms: [{ id: 'r1', name: 'Alster' }] } as unknown as FloorPlan;
const places: Places = {
  floors: [{ floorId: 'f1', name: 'Ground', level: 0 }],
  plans: [plan],
  channels: [{ channelId: 'c1', name: 'team', memberCount: 1, archived: false, isMember: true }],
};

describe('scopesFor', () => {
  const scopes = (role: Parameters<typeof scopesFor>[0]) => scopesFor(role, places, t).map((option) => option.scope);

  it('offers each role only where it applies', () => {
    expect(scopes('owner')).toEqual(['town']);
    expect(scopes('admin')).toEqual(['town']);
    expect(scopes('editor')).toEqual(['town', 'floor:f1']);
    expect(scopes('room-host')).toEqual(['town', 'floor:f1', 'room:f1/r1']);
    expect(scopes('channel-moderator')).toEqual(['town', 'channel:c1']);
  });
});

describe('scopeLabel', () => {
  it('names places', () => {
    expect(scopeLabel('town', places, t)).toBe('admin.scopeTown');
    expect(scopeLabel('floor:f1', places, t)).toBe('Ground');
    expect(scopeLabel('room:f1/r1', places, t)).toBe('Ground · Alster');
    expect(scopeLabel('channel:c1', places, t)).toBe('#team');
  });

  it('never names a private channel (ADR-0026)', () => {
    expect(scopeLabel('channel:secret', places, t)).toBe('admin.privateChannel');
  });

  it('says so when a room is gone', () => {
    expect(scopeLabel('room:f1/gone', places, t)).toBe('admin.unknownPlace');
  });
});
