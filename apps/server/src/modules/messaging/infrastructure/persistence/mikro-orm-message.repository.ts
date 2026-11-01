import type { MikroORM } from '@mikro-orm/postgresql';
import { appendToOutbox } from '../../../../platform/outbox/outbox.ts';
import type { MessagePage, MessageRepository } from '../../application/ports/message-repository.port.ts';
import { Message } from '../../domain/message.ts';
import { MessageRecord } from './messaging.entities.ts';

export class MikroOrmMessageRepository implements MessageRepository {
  constructor(
    private readonly orm: MikroORM,
    /** Tells the outbox relay that new events wait (ADR-0018). */
    private readonly eventsRecorded: () => void,
  ) {}

  async findById(messageId: string): Promise<Message | null> {
    const record = await this.orm.em.fork().findOne(MessageRecord, { messageId });
    return record ? toDomain(record) : null;
  }

  async page(channelId: string, before: Message | null, limit: number): Promise<MessagePage> {
    const older = before
      ? {
          $or: [
            { postedAt: { $lt: before.props.postedAt } },
            { postedAt: before.props.postedAt, messageId: { $lt: before.props.messageId } },
          ],
        }
      : {};
    const records = await this.orm.em
      .fork()
      .find(
        MessageRecord,
        { channelId, ...older },
        { orderBy: { postedAt: 'desc', messageId: 'desc' }, limit: limit + 1 },
      );
    return { messages: records.slice(0, limit).map(toDomain), hasMore: records.length > limit };
  }

  async save(message: Message): Promise<void> {
    const events = message.pullEvents();
    const { props } = message;
    await this.orm.em.fork().transactional(async (em) => {
      await em.upsert(MessageRecord, {
        messageId: props.messageId,
        channelId: props.channelId,
        authorId: props.authorId,
        body: props.body,
        postedAt: props.postedAt,
        editedAt: props.editedAt,
        deletedAt: props.deletedAt,
      });
      await appendToOutbox(em, 'messaging', events);
    });
    if (events.length > 0) this.eventsRecorded();
  }
}

function toDomain(record: MessageRecord): Message {
  return Message.restore({
    messageId: record.messageId,
    channelId: record.channelId,
    authorId: record.authorId,
    body: record.body,
    postedAt: record.postedAt,
    editedAt: record.editedAt ?? null,
    deletedAt: record.deletedAt ?? null,
  });
}
