/** Time is injected so that domain logic and tests stay deterministic. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A controllable clock for tests. */
export class FixedClock implements Clock {
  #current: Date;

  constructor(start: Date) {
    this.#current = new Date(start);
  }

  now(): Date {
    return new Date(this.#current);
  }

  advanceBy(milliseconds: number): void {
    this.#current = new Date(this.#current.getTime() + milliseconds);
  }
}
