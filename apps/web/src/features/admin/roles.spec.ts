import { Permission } from '@teamtown/contracts';
import { describe, expect, it } from 'vitest';
import { areaOf } from './roles.ts';

describe('areaOf', () => {
  it('sorts every permission into an area, and keeps the Owner permission out (P-36)', () => {
    expect(areaOf('town.owners.manage')).toBeNull();
    expect(Permission.options.filter((permission) => areaOf(permission) === null)).toEqual(['town.owners.manage']);
  });

  it('groups them as the form shows them', () => {
    expect(areaOf('town.audit.read')).toBe('town');
    expect(areaOf('channel.create.private')).toBe('town');
    expect(areaOf('room.lock')).toBe('rooms');
    expect(areaOf('call.mute.others')).toBe('rooms');
    expect(areaOf('world.edit')).toBe('rooms');
    expect(areaOf('message.pin')).toBe('channels');
    expect(areaOf('file.upload')).toBe('channels');
    expect(areaOf('call.direct')).toBe('direct');
  });
});
