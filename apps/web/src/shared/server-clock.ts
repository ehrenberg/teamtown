/**
 * Estimates the offset between the server clock and the local clock from Ping/Pong round trips.
 * Movements carry server timestamps, so every client must animate in server time.
 * The sample with the shortest round trip is the most accurate one and wins.
 */
export class ServerClock {
  #offsetMs = 0;
  #bestRoundTripMs = Number.POSITIVE_INFINITY;

  constructor(private readonly localNow: () => number = Date.now) {}

  /** Current server time in ms since the epoch. */
  now(): number {
    return this.localNow() + this.#offsetMs;
  }

  /** Records a Ping/Pong sample: local send time, server time, local receive time. */
  addSample(clientSentAt: number, serverTime: number, clientReceivedAt: number): void {
    const roundTrip = clientReceivedAt - clientSentAt;
    if (roundTrip < 0 || roundTrip > this.#bestRoundTripMs) return;
    this.#bestRoundTripMs = roundTrip;
    this.#offsetMs = serverTime - (clientSentAt + roundTrip / 2);
  }

  /** After a reconnect, the network path may have changed: start over. */
  reset(): void {
    this.#bestRoundTripMs = Number.POSITIVE_INFINITY;
  }
}

export const serverClock = new ServerClock();
