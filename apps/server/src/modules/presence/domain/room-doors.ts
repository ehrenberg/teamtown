import { err, ok, type Result } from '@teamtown/kernel';

export type DoorMode = 'open' | 'knock' | 'locked';

export interface RoomSettings {
  readonly roomId: string;
  /** From the floor plan: the live door mode starts here and returns here when the room empties. */
  readonly doorMode: DoorMode;
  readonly doorModeAdjustable: boolean;
}

export type DoorModeError = 'room-not-found' | 'not-in-room' | 'door-mode-fixed';

/** How long an admitted person may take to walk in. */
export const ENTRY_PASS_MS = 30_000;
/** Someone who left a room may walk back in without knocking within this time (ADR-0031). */
export const RETURN_GRACE_MS = 30_000;

const graceKey = (personId: string, roomId: string): string => `${personId}|${roomId}`;

/**
 * Live door modes, entry passes and return grace periods of one floor's rooms. In memory only:
 * who was in which room is never persisted (ADR-0012). Until M4, any occupant may change the door mode.
 */
export class RoomDoors {
  readonly #settings: ReadonlyMap<string, RoomSettings>;
  readonly #modes = new Map<string, DoorMode>();
  readonly #roomOfPerson = new Map<string, string>();
  readonly #passes = new Map<string, { readonly roomId: string; readonly until: number }>();
  readonly #graces = new Map<string, number>();
  readonly #consentRequired = new Set<string>();

  constructor(settings: readonly RoomSettings[]) {
    this.#settings = new Map(settings.map((room) => [room.roomId, room]));
    for (const room of settings) this.#modes.set(room.roomId, room.doorMode);
  }

  modeOf(roomId: string): DoorMode {
    return this.#modes.get(roomId) ?? 'open';
  }

  modes(): { readonly roomId: string; readonly doorMode: DoorMode }[] {
    return [...this.#modes].map(([roomId, doorMode]) => ({ roomId, doorMode }));
  }

  roomOf(personId: string): string | null {
    return this.#roomOfPerson.get(personId) ?? null;
  }

  occupantsOf(roomId: string): string[] {
    return [...this.#roomOfPerson]
      .filter(([, room]) => room === roomId)
      .map(([personId]) => personId)
      .sort();
  }

  /** Returns whether the mode changed. */
  setMode(personId: string, roomId: string, mode: DoorMode): Result<boolean, DoorModeError> {
    const settings = this.#settings.get(roomId);
    if (!settings) return err('room-not-found');
    if (!settings.doorModeAdjustable) return err('door-mode-fixed');
    if (this.roomOf(personId) !== roomId) return err('not-in-room');
    if (this.modeOf(roomId) === mode) return ok(false);
    this.#modes.set(roomId, mode);
    return ok(true);
  }

  grantPass(personId: string, roomId: string, now: number): void {
    this.#passes.set(personId, { roomId, until: now + ENTRY_PASS_MS });
  }

  /** While a meeting in the room is logged, nobody enters without consenting first (ADR-0027). */
  setConsentRequired(roomId: string, required: boolean): void {
    if (required) this.#consentRequired.add(roomId);
    else this.#consentRequired.delete(roomId);
  }

  mayEnter(personId: string, roomId: string, now: number): boolean {
    return this.entryBlockedBy(personId, roomId, now) === null;
  }

  /** Why the person may not walk into the room right now, or `null` if they may. */
  entryBlockedBy(personId: string, roomId: string, now: number): 'consent-required' | 'door-closed' | null {
    const pass = this.#passes.get(personId);
    const hasPass = pass?.roomId === roomId && pass.until >= now;
    if (this.#consentRequired.has(roomId)) return hasPass ? null : 'consent-required';
    if (this.modeOf(roomId) === 'open' || this.occupantsOf(roomId).length === 0 || hasPass) return null;
    return (this.#graces.get(graceKey(personId, roomId)) ?? -Infinity) >= now ? null : 'door-closed';
  }

  /**
   * Records who is in which room now (`null`: on the floor but in no room; missing: not on the floor).
   * Starts grace periods for people who left a room, uses up entry passes, and resets the door mode of rooms
   * that became empty. Returns the rooms whose door mode was reset.
   */
  update(
    roomOfPerson: ReadonlyMap<string, string | null>,
    now: number,
  ): { readonly roomId: string; readonly doorMode: DoorMode }[] {
    for (const [personId, previous] of this.#roomOfPerson) {
      if (roomOfPerson.get(personId) !== previous)
        this.#graces.set(graceKey(personId, previous), now + RETURN_GRACE_MS);
    }
    this.#roomOfPerson.clear();
    for (const [personId, roomId] of roomOfPerson) {
      if (roomId === null) continue;
      this.#roomOfPerson.set(personId, roomId);
      if (this.#passes.get(personId)?.roomId === roomId) this.#passes.delete(personId);
    }
    for (const [personId, pass] of this.#passes) if (pass.until < now) this.#passes.delete(personId);
    for (const [key, until] of this.#graces) if (until < now) this.#graces.delete(key);

    const resets: { roomId: string; doorMode: DoorMode }[] = [];
    for (const [roomId, settings] of this.#settings) {
      if (this.modeOf(roomId) !== settings.doorMode && this.occupantsOf(roomId).length === 0) {
        this.#modes.set(roomId, settings.doorMode);
        resets.push({ roomId, doorMode: settings.doorMode });
      }
    }
    return resets;
  }
}
