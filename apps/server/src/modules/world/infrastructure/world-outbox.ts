import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type { MikroORM } from '@mikro-orm/postgresql';
import { OutboxRelay } from '../../../platform/outbox/outbox.ts';
import type { WorldEventStream } from '../application/world-event-stream.ts';
import type { WorldEvent } from '../domain/events.ts';

export class WorldOutbox implements OnApplicationBootstrap, OnApplicationShutdown {
  readonly relay: OutboxRelay<WorldEvent>;

  constructor(orm: MikroORM, events: WorldEventStream) {
    this.relay = new OutboxRelay<WorldEvent>(orm, 'world', (recorded) => {
      events.publish(recorded);
    });
  }

  onApplicationBootstrap(): void {
    this.relay.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.relay.stop();
  }
}
