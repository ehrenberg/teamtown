import { Permission } from '@teamtown/contracts';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../../domain/permissions.ts';

describe('the permission catalogue', () => {
  it('is the same on the server and in the contracts the client reads', () => {
    expect([...PERMISSIONS]).toEqual(Permission.options);
  });
});
