import { describe, expect, it } from 'vitest';
import { stepForKey } from './keyboard-steps.ts';

describe('stepForKey', () => {
  it('maps WASD and arrow keys to the same screen directions', () => {
    expect(stepForKey('KeyW')).toEqual(stepForKey('ArrowUp'));
    expect(stepForKey('KeyD')).toEqual(stepForKey('ArrowRight'));
  });

  it('moves away from the camera when going up the screen', () => {
    expect(stepForKey('ArrowUp')).toEqual({ x: -1, y: -1 });
  });

  it('keeps opposite keys opposite', () => {
    const left = stepForKey('ArrowLeft');
    const right = stepForKey('ArrowRight');
    expect(left && right && { x: left.x + right.x, y: left.y + right.y }).toEqual({ x: 0, y: 0 });
  });

  it('ignores other keys', () => {
    expect(stepForKey('Space')).toBeNull();
  });
});
