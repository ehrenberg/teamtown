import { unwrap } from '@teamtown/kernel';
import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, avatarColorFor, Person, type PersonId } from './person.ts';

const id = (raw: string) => raw as PersonId;

describe('Person', () => {
  it('normalises the display name on registration', () => {
    const person = unwrap(Person.register({ id: id('p-1'), oidcSubject: 'sub', displayName: '  Lena   Hoffmann ' }));

    expect(person.displayName).toBe('Lena Hoffmann');
  });

  it('rejects an empty display name', () => {
    expect(Person.register({ id: id('p-1'), oidcSubject: 'sub', displayName: '   ' })).toEqual({
      ok: false,
      error: 'empty-display-name',
    });
  });

  it('derives a stable avatar colour from the brand palette', () => {
    expect(avatarColorFor('0d4f8f3c-2a1b-4c5d-9e8f-123456789abc')).toBe(
      avatarColorFor('0d4f8f3c-2a1b-4c5d-9e8f-123456789abc'),
    );
    expect(AVATAR_COLORS).toContain(avatarColorFor('any-id'));
  });

  it('syncs a changed name from the identity provider', () => {
    const person = unwrap(Person.register({ id: id('p-1'), oidcSubject: 'sub', displayName: 'Lena' }));

    expect(person.syncDisplayName('Lena Hoffmann')).toBe(true);
    expect(person.syncDisplayName('Lena Hoffmann')).toBe(false);
    expect(person.syncDisplayName('')).toBe(false);
    expect(person.displayName).toBe('Lena Hoffmann');
  });
});
