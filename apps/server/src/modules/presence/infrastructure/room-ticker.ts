import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { UpdateRooms } from '../application/update-rooms.ts';

export const ROOM_TICK_MS = 200;

const logger = new Logger('Presence');

export class RoomTicker implements OnApplicationBootstrap, OnApplicationShutdown {
  #timer: NodeJS.Timeout | undefined;

  constructor(private readonly update: UpdateRooms) {}

  onApplicationBootstrap(): void {
    this.#timer = setInterval(() => {
      try {
        this.update.execute();
      } catch (error) {
        // Never log people, rooms or positions here (ADR-0012).
        logger.error(`Updating rooms failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, ROOM_TICK_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.#timer);
  }
}
