import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { MessagingEventStream } from '../../messaging/public-api.ts';
import type { DeleteAttachmentsOfMessage } from '../application/delete-attachments-of-message.ts';

/** Deletes a message's claimed attachments when Messaging reports it deleted (P-21, ADR-0018). */
export class MessageDeletedListener implements OnModuleInit, OnModuleDestroy {
  readonly #logger = new Logger('Files');
  #unsubscribe: (() => void) | null = null;

  constructor(
    private readonly events: MessagingEventStream,
    private readonly deleteAttachments: DeleteAttachmentsOfMessage,
  ) {}

  onModuleInit(): void {
    this.#unsubscribe = this.events.subscribe((event) => {
      if (event.type !== 'MessageDeleted') return;
      this.deleteAttachments.execute(event.messageId).catch((error: unknown) => {
        this.#logger.error(
          `Deleting attachments for message ${event.messageId} failed: ` +
            (error instanceof Error ? error.message : String(error)),
        );
      });
    });
  }

  onModuleDestroy(): void {
    this.#unsubscribe?.();
  }
}
