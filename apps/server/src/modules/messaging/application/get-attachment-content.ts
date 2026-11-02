import { err, type Result } from '@teamtown/kernel';
import { findReadableChannel } from './channel-access.ts';
import type { AttachmentContent, FileAttachments } from './ports/file-attachments.port.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';

/**
 * Use case: reads an attachment's bytes for whoever can read the message that carries it (same access as the
 * message itself, docs/features/messaging-files.md). A private channel a person cannot read answers `not-found`,
 * never a separate "forbidden", so it never leaks that the channel exists.
 */
export class GetAttachmentContent {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly fileAttachments: FileAttachments,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    messageId: string;
    fileId: string;
  }): Promise<Result<AttachmentContent, 'not-found'>> {
    const channel = await findReadableChannel(this.channels, input.channelId, input.personId);
    const message = channel ? await this.messages.findById(input.messageId) : null;
    if (!channel || message?.props.channelId !== input.channelId) return err('not-found');
    if (!message.props.attachments.some((attachment) => attachment.fileId === input.fileId)) return err('not-found');
    return this.fileAttachments.getContent(input.fileId);
  }
}
