export interface RoomCall {
  readonly roomId: string;
  /** Sorted person IDs. */
  readonly participants: readonly string[];
}

export interface RoomCallChanged {
  readonly type: 'RoomCallChanged';
  readonly floorId: string;
  readonly roomCall: RoomCall;
  readonly joined: readonly string[];
  readonly left: readonly string[];
}

/**
 * The calls of a floor's audio-isolated rooms: everyone inside is in the call (ADR-0031). Derived from room
 * occupancy, in memory only.
 */
export class FloorRoomCalls {
  readonly #calls = new Map<string, RoomCall>();

  constructor(readonly floorId: string) {}

  /** `occupants` holds the people inside each audio-isolated room. */
  update(occupants: ReadonlyMap<string, readonly string[]>): RoomCallChanged[] {
    const changes: RoomCallChanged[] = [];
    const roomIds = new Set([...this.#calls.keys(), ...occupants.keys()]);
    for (const roomId of roomIds) {
      const before = this.#calls.get(roomId)?.participants ?? [];
      const after = [...(occupants.get(roomId) ?? [])].sort();
      const joined = after.filter((personId) => !before.includes(personId));
      const left = before.filter((personId) => !after.includes(personId));
      if (joined.length === 0 && left.length === 0) continue;

      const roomCall = { roomId, participants: after };
      if (after.length === 0) this.#calls.delete(roomId);
      else this.#calls.set(roomId, roomCall);
      changes.push({ type: 'RoomCallChanged', floorId: this.floorId, roomCall, joined, left });
    }
    return changes;
  }

  get(roomId: string): RoomCall | null {
    return this.#calls.get(roomId) ?? null;
  }

  all(): RoomCall[] {
    return [...this.#calls.values()];
  }
}
