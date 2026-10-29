declare const brand: unique symbol;

/** A nominal type: `Brand<string, "RoomId">` is not assignable to `Brand<string, "PersonId">`. */
export type Brand<T, Name extends string> = T & { readonly [brand]: Name };

/** Typed identifiers prevent mixing up IDs of different aggregates. */
export type Id<Name extends string> = Brand<string, Name>;

/**
 * Port for generating unique IDs. The kernel stays environment-free;
 * apps provide an implementation (e.g. based on `crypto.randomUUID()`).
 */
export interface IdGenerator {
  next(): string;
}

export function idFactory<Name extends string>(generator: IdGenerator) {
  return {
    generate: (): Id<Name> => generator.next() as Id<Name>,
    /** Rehydrates an ID from trusted storage or a validated contract. */
    from: (raw: string): Id<Name> => raw as Id<Name>,
  };
}
