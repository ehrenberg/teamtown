import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type { MikroORM } from '@mikro-orm/postgresql';
import { OutboxRelay } from '../../../platform/outbox/outbox.ts';
import type { MessagingEventStream } from '../application/messaging-event-stream.ts';
import type { MessagingEvent } from '../domain/events.ts';

/** Relays the Messaging outbox to the in-process listeners, e.g. the realtime gateway (ADR-0018). */
export class MessagingOutbox implements OnApplicationBootstrap, OnApplicationShutdown {
  readonly relay: OutboxRelay<MessagingEvent>;

  constructor(orm: MikroORM, events: MessagingEventStream) {
    this.relay = new OutboxRelay<MessagingEvent>(orm, 'messaging', (recorded) => {
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
