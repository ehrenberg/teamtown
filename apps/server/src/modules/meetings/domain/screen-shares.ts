import { err, ok, type Result } from '@teamtown/kernel';
import type { CallKey } from './cameras.ts';

export interface ScreenShareChange {
  readonly callKey: CallKey;
  readonly sharer: string | null;
  /** Whoever shared before; told when someone else takes over or the share ends. */
  readonly previous: string | null;
}

/** Screen sharing is for room calls and direct calls only, not for proximity conversations (ADR-0031). */
const canShareIn = (callKey: CallKey): boolean => callKey.startsWith('room:') || callKey.startsWith('direct:');

/** At most one screen share per call; a new sharer takes over (decided 2026-10-30). In memory only. */
export class ScreenShares {
  readonly #sharers = new Map<CallKey, string>();

  start(personId: string, callKey: CallKey | null): Result<ScreenShareChange | null, 'screen-share-not-here'> {
    if (callKey === null || !canShareIn(callKey)) return err('screen-share-not-here');
    const previous = this.#sharers.get(callKey) ?? null;
    if (previous === personId) return ok(null);
    this.#sharers.set(callKey, personId);
    return ok({ callKey, sharer: personId, previous });
  }

  stop(personId: string): ScreenShareChange | null {
    for (const [callKey, sharer] of this.#sharers) {
      if (sharer !== personId) continue;
      this.#sharers.delete(callKey);
      return { callKey, sharer: null, previous: personId };
    }
    return null;
  }

  /** Ends the shares of people who left the call they shared in. */
  sync(callKeyOf: (personId: string) => CallKey | null): ScreenShareChange[] {
    const ended: ScreenShareChange[] = [];
    for (const [callKey, sharer] of this.#sharers) {
      if (callKeyOf(sharer) === callKey) continue;
      this.#sharers.delete(callKey);
      ended.push({ callKey, sharer: null, previous: sharer });
    }
    return ended;
  }

  sharerOf(callKey: CallKey): string | null {
    return this.#sharers.get(callKey) ?? null;
  }
}
