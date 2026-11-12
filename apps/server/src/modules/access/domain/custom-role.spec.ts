import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { customRole } from './custom-role.ts';
import { placeOf, placesFor } from './places.ts';
import { BUILT_IN_ROLES } from './roles.ts';

describe('placesFor (P-37)', () => {
  it('lets room permissions apply to the town, a floor or a room', () => {
    expect(placesFor(['room.lock', 'meeting.log.start'])).toEqual(['town', 'floor', 'room']);
  });

  it('lets channel permissions apply to the town or a channel', () => {
    expect(placesFor(['message.pin', 'channel.manage'])).toEqual(['town', 'channel']);
  });

  it('keeps mixed roles and town permissions to the town', () => {
    expect(placesFor(['room.lock', 'message.pin'])).toEqual(['town']);
    expect(placesFor(['room.lock', 'world.edit'])).toEqual(['town', 'floor']);
    expect(placesFor(['town.audit.read'])).toEqual(['town']);
  });

  it('gives the built-in roles the places they had', () => {
    expect(placesFor(BUILT_IN_ROLES['room-host'])).toEqual(['town', 'floor', 'room']);
    expect(placesFor(BUILT_IN_ROLES['channel-moderator'])).toEqual(['town', 'channel']);
    expect(placesFor(BUILT_IN_ROLES.editor)).toEqual(['town', 'floor']);
    expect(placesFor(BUILT_IN_ROLES.admin)).toEqual(['town']);
  });

  it('reads the place of a scope', () => {
    expect(['town', 'floor:f1', 'room:f1/r1', 'channel:c1', 'nonsense'].map(placeOf)).toEqual([
      'town',
      'floor',
      'room',
      'channel',
      null,
    ]);
  });
});

describe('customRole', () => {
  const role = (permissions: string[], name = 'Team Lead', roleId = 'custom-1') =>
    customRole({ roleId, name, permissions });

  it('keeps the permissions in catalogue order, once each, and trims the name', () => {
    expect(unwrap(role(['message.pin', 'room.lock', 'message.pin'], '  Team Lead '))).toEqual({
      roleId: 'custom-1',
      name: 'Team Lead',
      permissions: ['room.lock', 'message.pin'],
    });
  });

  it.each([
    ['no permission', role([])],
    ['an unknown permission', role(['room.lock', 'root.everything'])],
    ['the Owner permission (P-36)', role(['town.owners.manage'])],
    ['an empty name', role(['room.lock'], '   ')],
    ['a long name', role(['room.lock'], 'x'.repeat(81))],
    ['a built-in id', role(['room.lock'], 'Team Lead', 'admin')],
  ])('refuses %s', (_, result) => {
    expect(result).toEqual({ ok: false, error: 'invalid-role' });
  });
});
