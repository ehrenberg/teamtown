import { err, ok, type Result } from '@teamtown/kernel';
import {
  findPath,
  positionAt,
  sameTile,
  tileAt,
  WALK_SPEED_TILES_PER_SECOND,
  type FloorGrid,
  type Movement,
  type TileCoord,
} from '@teamtown/world-core';

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
    };

export type MoveError = 'not-on-floor' | 'unreachable';

/**
 * The live state of one floor. In memory only: positions and paths are never persisted (ADR-0012).
 * The server is authoritative: it computes every path and nobody walks through walls.
 */
export class FloorInstance {
  readonly #avatars = new Map<string, AvatarState>();
  #events: PresenceEvent[] = [];

  constructor(
    readonly floorId: string,
    private readonly grid: FloorGrid,
    private readonly spawnPoints: readonly TileCoord[],
  ) {}

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

    const from = avatar.movement ? tileAt(avatar.movement, now) : avatar.tile;
    if (sameTile(from, target)) {
      this.#avatars.set(personId, { ...avatar, tile: from, movement: null });
      return ok(null);
    }
    const path = findPath(this.grid, from, target);
    if (!path.ok) return err('unreachable');

    const movement: Movement = {
      from,
      path: path.value,
      startedAt: now,
      speedTilesPerSecond: WALK_SPEED_TILES_PER_SECOND,
    };
    this.#avatars.set(personId, { ...avatar, tile: from, movement });
    this.#events.push({ type: 'AvatarPathStarted', floorId: this.floorId, personId, movement });
    return ok(movement);
  }

  /** All avatars; finished movements are settled onto their target tile. */
  snapshot(now: number): AvatarState[] {
    return [...this.#avatars.values()].map((avatar) => this.#settled(avatar, now));
  }

  /** Returns and clears the recorded events. */
  pullEvents(): readonly PresenceEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
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
