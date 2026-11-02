import type { OnApplicationBootstrap } from '@nestjs/common';
import type { SynchronizeRoomWalls } from '../application/synchronize-room-walls.ts';

/** Reconciles rooms imported before M3c; lifecycle events use the same idempotent application behaviour. */
export class RoomWallBootstrap implements OnApplicationBootstrap {
  constructor(private readonly synchronize: SynchronizeRoomWalls) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.synchronize.execute();
  }
}
