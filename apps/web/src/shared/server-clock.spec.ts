import { describe, expect, it } from 'vitest';
import { ServerClock } from './server-clock.ts';

describe('ServerClock', () => {
  it('estimates the offset from the middle of the round trip', () => {
    let local = 10_000;
    const clock = new ServerClock(() => local);

    clock.addSample(10_000, 50_100, 10_200);
    local = 10_300;

    // The server said 50 100 at the local midpoint 10 100; 200 ms later it is 50 300.
    expect(clock.now()).toBe(50_300);
  });

  it('prefers samples with shorter round trips', () => {
    const clock = new ServerClock(() => 0);
    clock.addSample(0, 1_000, 100); // offset 950
    clock.addSample(0, 2_000, 400); // slower sample is ignored

    expect(clock.now()).toBe(950);
  });

  it('accepts a slower sample again after a reset', () => {
    const clock = new ServerClock(() => 0);
    clock.addSample(0, 1_000, 100);
    clock.reset();
    clock.addSample(0, 2_000, 400);

    expect(clock.now()).toBe(1_800);
  });
});
