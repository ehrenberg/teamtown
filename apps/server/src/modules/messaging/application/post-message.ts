import { err, ok, type Clock, type IdGenerator, type Result } from '@teamtown/kernel';
import { MAX_ATTACHMENTS, messageBody } from '../domain/message.ts';
import type { Attachment, Message } from '../domain/message.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { ClaimAttachmentsError, FileAttachments } from './ports/file-attachments.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';
import type { ThreadRepository } from './ports/thread-repository.port.ts';

export type PostMessageError =
  | 'not-found'
  | 'not-channel-member'
  | 'channel-archived'
  | 'invalid-message'
  | 'invalid-thread-root'
  | 'too-many-attachments'
  | ClaimAttachmentsError;

/**
 * Use case: a member posts a message or a thread reply; the members hear of it through the outbox (overview §6.3).
 * A reply to a reply goes to the same root, so threads stay one level deep (decided 2026-11-01). With
 * `attachmentUploadIds`, it claims those uploads from the Files context first (P-22, P-23).
 */
export class PostMessage {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly threads: ThreadRepository,
    private readonly fileAttachments: FileAttachments,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    body: string;
    threadRootId?: string | undefined;
    alsoInChannel?: boolean | undefined;
    attachmentUploadIds?: readonly string[] | undefined;
  }): Promise<Result<Message, PostMessageError>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    if (!channel) return err('not-found');
    if (!channel.isMember(input.personId)) return err('not-channel-member');
    if (channel.isArchived) return err('channel-archived');
    // Validated again by `Message.create`; checked here first so a failing body never claims attachments.
    const uploadIds = input.attachmentUploadIds ?? [];
    const bodyCheck = messageBody(input.body, uploadIds.length > 0);
    if (!bodyCheck.ok) return bodyCheck;

    let root: Message | null = null;
    if (input.threadRootId !== undefined) {
      const target = await this.messages.findById(input.threadRootId);
      root = target?.isReply ? await this.messages.findById(target.threadId) : target;
      // `Channel.post` checks this, too, but only after the claim, which would strand the uploads.
      if (root?.props.channelId !== channel.props.channelId) return err('invalid-thread-root');
    }

    if (uploadIds.length > MAX_ATTACHMENTS) return err('too-many-attachments');
    const messageId = this.ids.next();
    let attachments: Attachment[] = [];
    if (uploadIds.length > 0) {
      const claimed = await this.fileAttachments.claim({ uploadIds, messageId, uploaderId: input.personId });
      if (!claimed.ok) return claimed;
      attachments = claimed.value;
    }

    const posted = channel.post({
      messageId,
      authorId: input.personId,
      body: input.body,
      threadRoot: root,
      alsoInChannel: input.alsoInChannel,
      attachments,
      now: this.clock.now(),
    });
    if (!posted.ok) return posted;
    const message = posted.value;
    await this.messages.save(message);

    const marker = { messageId: message.props.messageId, postedAt: message.props.postedAt };
    if (message.inChannel) {
      // The own message counts as read, also in the author's other clients.
      channel.markRead(input.personId, marker);
      await this.channels.save(channel);
    }
    if (root) {
      const thread = await this.threads.find(channel.props.channelId, root.props.messageId);
      thread.recordReply(message, root.props.authorId, channel.membersAmong(message.props.mentions));
      await this.threads.save(thread);
    }
    return ok(message);
  }
}
