import { err, ok, type Result } from '@teamtown/kernel';
import {
  findPath,
  positionAt,
  reachableTiles,
  RoomMap,
  sameTile,
  tileAt,
  tileKey,
  WALK_SPEED_TILES_PER_SECOND,
  type FloorGrid,
  type Movement,
  type StepGuard,
  type TileCoord,
} from '@teamtown/world-core';
import { RoomDoors, type DoorMode, type DoorModeError, type RoomSettings } from './room-doors.ts';

/** Who is shown on the floor. Provided by the caller (People context data). */
export interface Occupant {
  readonly personId: string;
  readonly displayName: string;
  readonly avatarColor: string;
}

export interface AvatarState {
  readonly occupant: Occupant;
  /** Where the avatar stands, or where its current movement started. */
  readonly tile: TileCoord;
  readonly movement: Movement | null;
}

export type PresenceEvent =
  | { readonly type: 'AvatarJoined'; readonly floorId: string; readonly avatar: AvatarState }
  | { readonly type: 'AvatarLeft'; readonly floorId: string; readonly personId: string }
  | {
      readonly type: 'AvatarPathStarted';
      readonly floorId: string;
      readonly personId: string;
      readonly movement: Movement;
    }
  | {
      readonly type: 'DoorModeChanged';
      readonly floorId: string;
      readonly roomId: string;
      readonly doorMode: DoorMode;
    };

export type MoveError = 'not-on-floor' | 'unreachable' | 'door-closed' | 'consent-required';
export type AdmitError = 'not-on-floor' | 'room-not-found' | 'unreachable';

export interface FloorRooms {
  readonly roomMap: RoomMap;
  readonly settings: readonly RoomSettings[];
}

const NO_ROOMS: FloorRooms = {
  roomMap: RoomMap.build({ width: 1, height: 1, floorAreas: [], walls: [], doors: [], furniture: [] }, []),
  settings: [],
};

const distance = (a: TileCoord, b: TileCoord): number => Math.hypot(a.x - b.x, a.y - b.y);

const fromKey = (key: string): TileCoord => {
  const [x = 0, y = 0] = key.split(',').map(Number);
  return { x, y };
};

/**
 * The live state of one floor. In memory only: positions and paths are never persisted (ADR-0012).
 * The server is authoritative: it computes every path, nobody walks through walls, and nobody walks into a
 * room whose door is closed to them.
 */
export class FloorInstance {
  readonly #avatars = new Map<string, AvatarState>();
  readonly #doors: RoomDoors;
  #events: PresenceEvent[] = [];

  constructor(
    readonly floorId: string,
    private readonly grid: FloorGrid,
    private readonly spawnPoints: readonly TileCoord[],
    private readonly rooms: FloorRooms = NO_ROOMS,
  ) {
    this.#doors = new RoomDoors(rooms.settings);
  }

  get isEmpty(): boolean {
    return this.#avatars.size === 0;
  }

  has(personId: string): boolean {
    return this.#avatars.has(personId);
  }

  /** Places the person on a free spawn point. Joining again (e.g. a second browser tab) keeps the avatar. */
  join(occupant: Occupant, now: number): AvatarState {
    const existing = this.#avatars.get(occupant.personId);
    if (existing) return existing;

    const avatar: AvatarState = { occupant, tile: this.#freeSpawnPoint(now), movement: null };
    this.#avatars.set(occupant.personId, avatar);
    this.#events.push({ type: 'AvatarJoined', floorId: this.floorId, avatar });
    return avatar;
  }

  leave(personId: string): boolean {
    const removed = this.#avatars.delete(personId);
    if (removed) {
      this.#events.push({ type: 'AvatarLeft', floorId: this.floorId, personId });
    }
    return removed;
  }

  /**
   * Starts walking to `target`. A walking avatar continues from the tile it is closest to.
   * Returns `null` if the avatar already stands on the target.
   */
  moveTo(personId: string, target: TileCoord, now: number): Result<Movement | null, MoveError> {
    const avatar = this.#avatars.get(personId);
    if (!avatar) return err('not-on-floor');

    this.updateRooms(now);
    const from = this.#currentTile(avatar, now);
    if (sameTile(from, target)) {
      this.#avatars.set(personId, { ...avatar, tile: from, movement: null });
      return ok(null);
    }
    const targetRoom = this.rooms.roomMap.roomAt(target);
    if (targetRoom !== null && targetRoom !== this.rooms.roomMap.roomAt(from)) {
      const blocked = this.#doors.entryBlockedBy(personId, targetRoom, now);
      if (blocked) return err(blocked);
    }
    const guard = this.#entryGuard(personId, now);
    let path = findPath(this.grid, from, target, guard);
    if (!path.ok && this.#isShutIn(from, guard)) {
      // Leaving is always possible: whoever is shut in behind a closed room may cross it to get out.
      path = findPath(this.grid, from, target);
    }
    if (!path.ok) return err('unreachable');

    return ok(this.#startMovement(avatar, from, path.value, now));
  }

  /** Lets an admitted person into a room and walks them to the nearest free tile inside. */
  admit(personId: string, roomId: string, now: number): Result<Movement | null, AdmitError> {
    const avatar = this.#avatars.get(personId);
    if (!avatar) return err('not-on-floor');
    if (!this.rooms.settings.some((room) => room.roomId === roomId)) return err('room-not-found');

    this.updateRooms(now);
    this.#doors.grantPass(personId, roomId, now);
    const from = this.#currentTile(avatar, now);
    if (this.rooms.roomMap.roomAt(from) === roomId) return ok(null);

    const taken = new Set(
      this.snapshot(now)
        .filter((other) => other.occupant.personId !== personId)
        .map((other) => tileKey(other.movement?.path.at(-1) ?? other.tile)),
    );
    const target = [...reachableTiles(this.grid, from, this.#entryGuard(personId, now))]
      .filter((key) => !taken.has(key))
      .map(fromKey)
      .filter((coord) => this.rooms.roomMap.roomAt(coord) === roomId)
      .sort((a, b) => distance(from, a) - distance(from, b))[0];
    if (!target) return err('unreachable');

    const moved = this.moveTo(personId, target, now);
    return moved.ok ? moved : err('unreachable');
  }

  /** While a meeting in the room is logged, only people who consented walk in (ADR-0027). */
  setConsentRequired(roomId: string, required: boolean, now: number): void {
    this.#doors.setConsentRequired(roomId, required);
    if (required) this.#stopAtClosedDoors(now);
  }

  /** Walks the person out of the room to the nearest free tile outside, e.g. after declining a logged meeting. */
  walkOut(personId: string, roomId: string, now: number): Result<Movement | null, AdmitError> {
    const avatar = this.#avatars.get(personId);
    if (!avatar) return err('not-on-floor');
    const from = this.#currentTile(avatar, now);
    if (this.rooms.roomMap.roomAt(from) !== roomId) return ok(null);

    const taken = new Set(
      this.snapshot(now)
        .filter((other) => other.occupant.personId !== personId)
        .map((other) => tileKey(other.movement?.path.at(-1) ?? other.tile)),
    );
    const target = [...reachableTiles(this.grid, from, this.#entryGuard(personId, now))]
      .filter((key) => !taken.has(key))
      .map(fromKey)
      .filter((coord) => this.rooms.roomMap.roomAt(coord) !== roomId)
      .sort((a, b) => distance(from, a) - distance(from, b))[0];
    if (!target) return err('unreachable');
    const moved = this.moveTo(personId, target, now);
    return moved.ok ? moved : err('unreachable');
  }

  setDoorMode(personId: string, roomId: string, doorMode: DoorMode, now: number): Result<void, DoorModeError> {
    this.updateRooms(now);
    const changed = this.#doors.setMode(personId, roomId, doorMode);
    if (!changed.ok) return changed;
    if (changed.value) {
      this.#events.push({ type: 'DoorModeChanged', floorId: this.floorId, roomId, doorMode });
      this.#stopAtClosedDoors(now);
    }
    return ok(undefined);
  }

  /**
   * Brings room occupancy up to date: starts grace periods, uses up entry passes and resets the door mode of
   * rooms that became empty. Runs before every command and on a short tick.
   */
  updateRooms(now: number): void {
    const roomOfPerson = new Map<string, string | null>();
    for (const avatar of this.#avatars.values()) {
      roomOfPerson.set(avatar.occupant.personId, this.rooms.roomMap.roomAt(this.#currentTile(avatar, now)));
    }
    for (const { roomId, doorMode } of this.#doors.update(roomOfPerson, now)) {
      this.#events.push({ type: 'DoorModeChanged', floorId: this.floorId, roomId, doorMode });
    }
  }

  roomOf(personId: string, now: number): string | null {
    const avatar = this.#avatars.get(personId);
    return avatar ? this.rooms.roomMap.roomAt(this.#currentTile(avatar, now)) : null;
  }

  occupantsOf(roomId: string, now: number): string[] {
    return [...this.#avatars.keys()].filter((personId) => this.roomOf(personId, now) === roomId).sort();
  }

  doorModes(): { readonly roomId: string; readonly doorMode: DoorMode }[] {
    return this.#doors.modes();
  }

  /** All avatars; finished movements are settled onto their target tile. */
  snapshot(now: number): AvatarState[] {
    return [...this.#avatars.values()].map((avatar) => this.#settled(avatar, now));
  }

  positions(
    now: number,
  ): { readonly personId: string; readonly position: { readonly x: number; readonly y: number } }[] {
    return [...this.#avatars.values()].map((avatar) => {
      const position = avatar.movement ? positionAt(avatar.movement, now) : avatar.tile;
      return { personId: avatar.occupant.personId, position: { x: position.x, y: position.y } };
    });
  }

  /** Returns and clears the recorded events. */
  pullEvents(): readonly PresenceEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  #currentTile(avatar: AvatarState, now: number): TileCoord {
    return avatar.movement ? tileAt(avatar.movement, now) : avatar.tile;
  }

  #startMovement(avatar: AvatarState, from: TileCoord, path: readonly TileCoord[], now: number): Movement {
    const movement: Movement = { from, path, startedAt: now, speedTilesPerSecond: WALK_SPEED_TILES_PER_SECOND };
    const personId = avatar.occupant.personId;
    this.#avatars.set(personId, { ...avatar, tile: from, movement });
    this.#events.push({ type: 'AvatarPathStarted', floorId: this.floorId, personId, movement });
    return movement;
  }

  #entryGuard(personId: string, now: number): StepGuard {
    return this.rooms.roomMap.entryGuard((roomId) => this.#doors.mayEnter(personId, roomId, now));
  }

  #isShutIn(from: TileCoord, guard: StepGuard): boolean {
    const reachable = reachableTiles(this.grid, from, guard);
    return !this.spawnPoints.some((spawn) => reachable.has(tileKey(spawn)));
  }

  /** Whoever is walking into a room that just closed to them stops in front of its door. */
  #stopAtClosedDoors(now: number): void {
    for (const avatar of [...this.#avatars.values()]) {
      if (!avatar.movement || positionAt(avatar.movement, now).arrived) continue;
      const from = tileAt(avatar.movement, now);
      const passed = avatar.movement.path.findIndex((step) => sameTile(step, from));
      const remaining = avatar.movement.path.slice(passed + 1);
      const guard = this.#entryGuard(avatar.occupant.personId, now);
      const blockedAt = remaining.findIndex((step, i) => !guard(remaining[i - 1] ?? from, step));
      if (blockedAt >= 0) this.#startMovement(avatar, from, remaining.slice(0, blockedAt), now);
    }
  }

  #settled(avatar: AvatarState, now: number): AvatarState {
    if (!avatar.movement || !positionAt(avatar.movement, now).arrived) return avatar;
    return { ...avatar, tile: avatar.movement.path.at(-1) ?? avatar.tile, movement: null };
  }

  #freeSpawnPoint(now: number): TileCoord {
    const occupied = this.snapshot(now).map((avatar) => avatar.tile);
    const free = this.spawnPoints.find((spawn) => !occupied.some((tile) => sameTile(tile, spawn)));
    const fallback = this.spawnPoints[0];
    if (!fallback) {
      throw new Error(`Floor ${this.floorId} has no spawn points`);
    }
    return free ?? fallback;
  }
}
