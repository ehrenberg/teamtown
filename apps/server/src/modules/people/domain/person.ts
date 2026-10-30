import { err, ok, type Id, type Result } from '@teamtown/kernel';

export type PersonId = Id<'Person'>;

/** Avatar colours from the brand palette (docs/design/brand-guide.md §4), all readable with white text. */
export const AVATAR_COLORS = [
  '#D9653B',
  '#2F6F8F',
  '#5F9470',
  '#B54D2A',
  '#22546C',
  '#4F7A5C',
  '#9A6B12',
  '#7A3018',
] as const;

const MAX_DISPLAY_NAME_LENGTH = 80;

export type DisplayNameError = 'empty-display-name';

/** Deterministic colour per person, so everyone sees the same colour without storing a choice. */
export function avatarColorFor(personId: string): string {
  let hash = 0;
  for (const char of personId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

function normaliseDisplayName(raw: string): Result<string, DisplayNameError> {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_DISPLAY_NAME_LENGTH);
  return name.length > 0 ? ok(name) : err('empty-display-name');
}

/** A member's profile (People context). Created on the first login; identity data comes from OIDC. */
export class Person {
  private constructor(
    readonly id: PersonId,
    readonly oidcSubject: string,
    private name: string,
    readonly avatarColor: string,
  ) {}

  static register(props: { id: PersonId; oidcSubject: string; displayName: string }): Result<Person, DisplayNameError> {
    const name = normaliseDisplayName(props.displayName);
    if (!name.ok) return name;
    return ok(new Person(props.id, props.oidcSubject, name.value, avatarColorFor(props.id)));
  }

  /** Recreates a person from storage; the data was validated when it was stored. */
  static rehydrate(props: { id: PersonId; oidcSubject: string; displayName: string; avatarColor: string }): Person {
    return new Person(props.id, props.oidcSubject, props.displayName, props.avatarColor);
  }

  get displayName(): string {
    return this.name;
  }

  /** Keeps the name in sync with the identity provider. Returns whether it changed. */
  syncDisplayName(raw: string): boolean {
    const name = normaliseDisplayName(raw);
    if (!name.ok || name.value === this.name) return false;
    this.name = name.value;
    return true;
  }
}
