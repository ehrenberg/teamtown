import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { PurgeExpiredUploads } from '../application/purge-expired-uploads.ts';

const HOUR_MS = 60 * 60 * 1000;
const logger = new Logger('Files');

/** Deletes pending uploads nobody claimed within 24 hours (P-22), at start-up and hourly. */
export class UploadExpiry implements OnApplicationBootstrap, OnApplicationShutdown {
  #timer: NodeJS.Timeout | undefined;

  constructor(private readonly purge: PurgeExpiredUploads) {}

  onApplicationBootstrap(): void {
    const run = () => {
      this.purge
        .execute()
        .then((deleted) => {
          if (deleted > 0) logger.log(`Deleted ${String(deleted)} expired uploads`);
        })
        .catch((error: unknown) => {
          logger.error(`Deleting expired uploads failed: ${error instanceof Error ? error.message : String(error)}`);
        });
    };
    run();
    this.#timer = setInterval(run, HOUR_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.#timer);
  }
}
