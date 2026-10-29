import { err, ok, type Result } from '@teamtown/kernel';
import { neighbourOn, tileKey, type Side, type TileCoord } from './tile.ts';

export type FloorGridError = 'invalid-size';

const MAX_GRID_SIDE = 1024;

/** A wall edge is stored once, normalised to the tile on its north or west side. */
const edgeKey = (between: TileCoord, and: TileCoord): string =>
  between.x + between.y <= and.x + and.y
    ? `${tileKey(between)}|${tileKey(and)}`
    : `${tileKey(and)}|${tileKey(between)}`;

/**
 * Immutable walkability model of one floor: blocked tiles (furniture, voids) and
 * walls on tile edges. Pathfinding and movement validation are based on it.
 */
export class FloorGrid {
  private constructor(
    readonly width: number,
    readonly height: number,
    private readonly blockedTiles: ReadonlySet<string>,
    private readonly walls: ReadonlySet<string>,
  ) {}

  static builder(width: number, height: number): Result<FloorGridBuilder, FloorGridError> {
    const isValidSide = (side: number) => Number.isInteger(side) && side > 0 && side <= MAX_GRID_SIDE;
    if (!isValidSide(width) || !isValidSide(height)) {
      return err('invalid-size');
    }
    return ok(new FloorGridBuilder((blocked, walls) => new FloorGrid(width, height, blocked, walls)));
  }

  isInside({ x, y }: TileCoord): boolean {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isWalkable(coord: TileCoord): boolean {
    return this.isInside(coord) && !this.blockedTiles.has(tileKey(coord));
  }

  hasWallBetween(a: TileCoord, b: TileCoord): boolean {
    return this.walls.has(edgeKey(a, b));
  }

  /**
   * Whether an avatar can step from one tile to an adjacent one (including diagonals).
   * Diagonal steps must not cut corners: both orthogonal detours have to be passable.
   */
  canStep(from: TileCoord, to: TileCoord): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const isAdjacent = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0);
    if (!isAdjacent || !this.isWalkable(to)) {
      return false;
    }
    if (dx === 0 || dy === 0) {
      return !this.hasWallBetween(from, to);
    }
    const viaX = { x: from.x + dx, y: from.y };
    const viaY = { x: from.x, y: from.y + dy };
    return this.canStep(from, viaX) && this.canStep(viaX, to) && this.canStep(from, viaY) && this.canStep(viaY, to);
  }
}

export class FloorGridBuilder {
  readonly #blockedTiles = new Set<string>();
  readonly #walls = new Set<string>();

  constructor(private readonly create: (blocked: ReadonlySet<string>, walls: ReadonlySet<string>) => FloorGrid) {}

  blockTile(coord: TileCoord): this {
    this.#blockedTiles.add(tileKey(coord));
    return this;
  }

  /** Places a wall on the given side of a tile, e.g. the east edge of (3,4). */
  addWall(coord: TileCoord, side: Side): this {
    this.#walls.add(edgeKey(coord, neighbourOn(coord, side)));
    return this;
  }

  build(): FloorGrid {
    return this.create(new Set(this.#blockedTiles), new Set(this.#walls));
  }
}
