import { describe, expect, it } from 'vitest';
import { andThen, err, map, ok, unwrap, type Result } from './result.ts';

const parsePositive = (input: number): Result<number, 'not-positive'> => (input > 0 ? ok(input) : err('not-positive'));

describe('Result', () => {
  it('maps the value of a successful result', () => {
    expect(map(ok(2), (value) => value * 3)).toEqual(ok(6));
  });

  it('passes an error through map untouched', () => {
    expect(map(parsePositive(-1), (value) => value * 3)).toEqual(err('not-positive'));
  });

  it('chains results with andThen', () => {
    expect(andThen(ok(5), parsePositive)).toEqual(ok(5));
    expect(andThen(ok(0), parsePositive)).toEqual(err('not-positive'));
  });

  it('throws when unwrapping an error', () => {
    expect(() => unwrap(parsePositive(0))).toThrow(/not-positive/);
  });
});
