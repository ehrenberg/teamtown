import { Logger } from '@nestjs/common';
import type { EntityManager, MikroORM } from '@mikro-orm/postgresql';

/**
 * Transactional outbox (ADR-0018). A module writes its recorded events into `<schema>.outbox` in the same
 * transaction as the aggregate change; the relay hands them to the in-process listeners after the commit.
 *
 * A row is deleted as soon as it was dispatched: event payloads can hold content (e.g. a message body), and a
 * deleted message must not linger in the outbox. Delivery is at most once per process; clients reload after a
 * reconnect, so a lost push costs nothing but a moment.
 */

/** The table every persistent module creates in its own schema. */
export const outboxTableSql = (schema: string): string => `create table "${schema}"."outbox" (
  "seq" bigserial primary key,
  "event" jsonb not null,
  "recorded_at" timestamptz not null default now()
);`;

/** Writes events inside the caller's transaction (`em` must be the transactional entity manager). */
export async function appendToOutbox(em: EntityManager, schema: string, events: readonly object[]): Promise<void> {
  if (events.length === 0) return;
  const placeholders = events.map(() => '(?::jsonb)').join(', ');
  await em.execute(
    `insert into "${schema}"."outbox" ("event") values ${placeholders}`,
    events.map((event) => JSON.stringify(event)),
  );
}

const POLL_INTERVAL_MS = 2_000;
const BATCH_SIZE = 200;

export class OutboxRelay<Event> {
  readonly #logger: Logger;
  #timer: NodeJS.Timeout | undefined;
  #draining: Promise<void> | null = null;
  #again = false;

  constructor(
    private readonly orm: MikroORM,
    private readonly schema: string,
    private readonly dispatch: (events: readonly Event[]) => void,
  ) {
    this.#logger = new Logger(`Outbox ${schema}`);
  }

  /** Polls for rows left over (e.g. from before a restart), next to the kicks after each commit. */
  start(): void {
    this.kick();
    this.#timer = setInterval(() => {
      this.kick();
    }, POLL_INTERVAL_MS);
  }

  stop(): Promise<void> {
    clearInterval(this.#timer);
    return this.#draining ?? Promise.resolve();
  }

  /** Dispatches pending events soon; calls while a drain is running are coalesced into one more drain. */
  kick(): void {
    if (this.#draining) {
      this.#again = true;
      return;
    }
    this.#draining = this.#drain()
      .catch((error: unknown) => {
        this.#logger.error(`Dispatching events failed: ${error instanceof Error ? error.message : String(error)}`);
      })
      .finally(() => {
        this.#draining = null;
        if (this.#again) {
          this.#again = false;
          this.kick();
        }
      });
  }

  /** Resolves once everything recorded so far is dispatched (for tests and shutdown). */
  async flush(): Promise<void> {
    while (this.#draining) await this.#draining;
  }

  async #drain(): Promise<void> {
    for (;;) {
      // `skip locked` keeps a second server process from dispatching the same rows.
      const rows = await this.orm.em.fork().execute<{ seq: string; event: Event }[]>(
        `delete from "${this.schema}"."outbox" where "seq" in (
           select "seq" from "${this.schema}"."outbox" order by "seq" limit ${String(BATCH_SIZE)} for update skip locked
         ) returning "seq", "event"`,
      );
      if (rows.length === 0) return;
      rows.sort((a, b) => Number(a.seq) - Number(b.seq));
      try {
        this.dispatch(rows.map((row) => row.event));
      } catch (error) {
        this.#logger.error(`A listener failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (rows.length < BATCH_SIZE) return;
    }
  }
}
