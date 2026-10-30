import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { ExpireKnocks } from '../application/expire-knocks.ts';
import type { UpdateDirectCalls } from '../application/update-direct-calls.ts';
import type { ReconcileMediaRooms } from '../application/reconcile-media-rooms.ts';
import type { UpdateConversations } from '../application/update-conversations.ts';

export const CONVERSATION_TICK_MS = 200;
export const RECONCILE_INTERVAL_MS = 5_000;

const logger = new Logger('Meetings');

function every(intervalMs: number, name: string, task: () => Promise<void>): NodeJS.Timeout {
  let running = false;
  return setInterval(() => {
    if (running) return;
    running = true;
    task()
      .catch((error: unknown) => {
        // Never log participants or positions here (ADR-0012).
        logger.error(`${name} failed: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);
}

export class ProximityTicker implements OnApplicationBootstrap, OnApplicationShutdown {
  #timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly update: UpdateConversations,
    private readonly reconcile: ReconcileMediaRooms,
    private readonly expireKnocks: ExpireKnocks,
    private readonly updateCalls: UpdateDirectCalls,
  ) {}

  onApplicationBootstrap(): void {
    this.#timers = [
      every(CONVERSATION_TICK_MS, 'Updating conversations', () => this.update.execute()),
      every(CONVERSATION_TICK_MS, 'Expiring knocks', () => {
        this.expireKnocks.execute();
        return Promise.resolve();
      }),
      every(CONVERSATION_TICK_MS, 'Updating direct calls', () => this.updateCalls.execute()),
      every(RECONCILE_INTERVAL_MS, 'Reconciling media rooms', () => this.reconcile.execute()),
    ];
  }

  onApplicationShutdown(): void {
    for (const timer of this.#timers) clearInterval(timer);
    this.#timers = [];
  }
}
