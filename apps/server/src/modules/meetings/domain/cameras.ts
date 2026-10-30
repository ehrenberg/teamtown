import { err, ok, type Result } from '@teamtown/kernel';

/** Identifies the conversation or call a person is in, e.g. `conversation:c1`, `room:ground:elbe`, `direct:x`. */
export type CallKey = string;

export interface CameraChanged {
  readonly type: 'CameraChanged';
  readonly personId: string;
  readonly on: boolean;
}

/**
 * Who has the camera on. The camera is opt-in per call (ADR-0031): it can only be on inside a conversation or call,
 * and it goes off when the person's call changes or ends. In memory only.
 */
export class Cameras {
  /** personId → the call the camera was switched on in. */
  readonly #on = new Map<string, CallKey>();

  /** Returns the change, or `null` if nothing changed. */
  set(personId: string, on: boolean, callKey: CallKey | null): Result<CameraChanged | null, 'not-in-call'> {
    if (!on) {
      return ok(this.#on.delete(personId) ? { type: 'CameraChanged', personId, on: false } : null);
    }
    if (callKey === null) return err('not-in-call');
    const wasOn = this.#on.has(personId);
    this.#on.set(personId, callKey);
    return ok(wasOn ? null : { type: 'CameraChanged', personId, on: true });
  }

  /** Switches off the cameras of people who are no longer in the call they switched them on in. */
  sync(callKeyOf: (personId: string) => CallKey | null): CameraChanged[] {
    const off: CameraChanged[] = [];
    for (const [personId, callKey] of this.#on) {
      if (callKeyOf(personId) === callKey) continue;
      this.#on.delete(personId);
      off.push({ type: 'CameraChanged', personId, on: false });
    }
    return off;
  }

  isOn(personId: string): boolean {
    return this.#on.has(personId);
  }
}
