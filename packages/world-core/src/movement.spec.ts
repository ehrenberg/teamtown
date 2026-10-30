import { describe, expect, it } from 'vitest';
import { movementDurationMs, positionAt, tileAt, type Movement } from './movement.ts';
import { tile } from './tile.ts';

const START = 1_000_000;
const walk = (path: Movement['path'], speedTilesPerSecond = 2): Movement => ({
  from: tile(0, 0),
  path,
  startedAt: START,
  speedTilesPerSecond,
});

describe('movement timing', () => {
  it('starts at the origin tile', () => {
    expect(positionAt(walk([tile(1, 0)]), START)).toMatchObject({ x: 0, y: 0, arrived: false });
  });

  it('interpolates linearly along a straight segment', () => {
    expect(positionAt(walk([tile(1, 0), tile(2, 0)]), START + 750)).toMatchObject({ x: 1.5, y: 0 });
  });

  it('takes √2 times longer for a diagonal step', () => {
    expect(movementDurationMs(walk([tile(1, 1)]))).toBeCloseTo((Math.SQRT2 / 2) * 1000);
  });

  it('stays at the target after arrival', () => {
    expect(positionAt(walk([tile(0, 1), tile(0, 2)]), START + 60_000)).toMatchObject({ x: 0, y: 2, arrived: true });
  });

  it('reports the heading of the current segment', () => {
    expect(positionAt(walk([tile(1, 0), tile(1, 1)]), START + 600).heading).toEqual({ dx: 0, dy: 1 });
  });

  it('treats a movement that has not started yet as standing at the origin', () => {
    expect(positionAt(walk([tile(1, 0)]), START - 500)).toMatchObject({ x: 0, y: 0 });
  });

  it('rounds to the closest tile for interruptions', () => {
    const movement = walk([tile(1, 0), tile(2, 0)]);
    expect(tileAt(movement, START + 200)).toEqual(tile(0, 0));
    expect(tileAt(movement, START + 300)).toEqual(tile(1, 0));
  });
});
