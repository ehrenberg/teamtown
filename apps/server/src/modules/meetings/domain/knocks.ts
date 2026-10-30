import { err, ok, type Result } from '@teamtown/kernel';

export type KnockOutcome = 'admitted' | 'declined' | 'expired' | 'cancelled';

export interface KnockRequest {
  readonly knockId: string;
  readonly floorId: string;
  readonly roomId: string;
  readonly requester: string;
  readonly expiresAt: number;
}

export type KnockError = 'knock-pending' | 'knock-not-found';

/** Without an answer, a knock expires after this time. */
export const KNOCK_TIMEOUT_MS = 60_000;

/** Open knocks. In memory only: who knocked where is never persisted or logged (ADR-0012). */
export class Knocks {
  readonly #open = new Map<string, KnockRequest>();

  constructor(private readonly newId: () => string) {}

  /** A person has at most one open knock. */
  request(input: Omit<KnockRequest, 'knockId' | 'expiresAt'>, now: number): Result<KnockRequest, 'knock-pending'> {
    if (this.all().some((knock) => knock.requester === input.requester)) return err('knock-pending');
    const knock: KnockRequest = { ...input, knockId: this.newId(), expiresAt: now + KNOCK_TIMEOUT_MS };
    this.#open.set(knock.knockId, knock);
    return ok(knock);
  }

  get(knockId: string): KnockRequest | null {
    return this.#open.get(knockId) ?? null;
  }

  /** Closes a knock; the first answer wins, so later answers find nothing. */
  close(knockId: string): Result<KnockRequest, 'knock-not-found'> {
    const knock = this.#open.get(knockId);
    if (!knock) return err('knock-not-found');
    this.#open.delete(knockId);
    return ok(knock);
  }

  all(): KnockRequest[] {
    return [...this.#open.values()];
  }

  /** Closes and returns the knocks whose time ran out. */
  expire(now: number): KnockRequest[] {
    const expired = this.all().filter((knock) => knock.expiresAt < now);
    for (const knock of expired) this.#open.delete(knock.knockId);
    return expired;
  }
}
