import { Logger, type OnApplicationShutdown, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { WorldEventStream } from '../../world/public-api.ts';
import type { SynchronizeRoomWalls } from '../application/synchronize-room-walls.ts';

/** Reconciles after every persisted room lifecycle event; duplicate delivery is harmless (ADR-0018). */
export class RoomWallLifecycle implements OnModuleInit, OnModuleDestroy, OnApplicationShutdown {
  readonly #logger = new Logger('Room walls');
  #unsubscribe: (() => void) | null = null;
  #pending = Promise.resolve();

  constructor(
    private readonly events: WorldEventStream,
    private readonly synchronize: SynchronizeRoomWalls,
  ) {}

  onModuleInit(): void {
    this.#unsubscribe = this.events.subscribe(() => {
      this.#pending = this.#pending
        .then(() => this.synchronize.execute())
        .catch((error: unknown) => {
          this.#logger.error(
            `Synchronizing room walls failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    });
  }

  onModuleDestroy(): void {
    this.#unsubscribe?.();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.#pending;
  }
}
