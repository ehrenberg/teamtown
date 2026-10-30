import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { PurgeExpiredMeetingLogs } from '../application/purge-expired-meeting-logs.ts';

const HOUR_MS = 60 * 60 * 1000;
const logger = new Logger('Meetings');

/** Deletes expired meeting logs at start-up and every hour (ADR-0027). Logs only the count. */
export class MeetingLogRetention implements OnApplicationBootstrap, OnApplicationShutdown {
  #timer: NodeJS.Timeout | undefined;

  constructor(private readonly purge: PurgeExpiredMeetingLogs) {}

  onApplicationBootstrap(): void {
    const run = () => {
      this.purge
        .execute()
        .then((deleted) => {
          if (deleted > 0) logger.log(`Deleted ${String(deleted)} expired meeting logs`);
        })
        .catch((error: unknown) => {
          logger.error(
            `Deleting expired meeting logs failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    };
    run();
    this.#timer = setInterval(run, HOUR_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.#timer);
  }
}
