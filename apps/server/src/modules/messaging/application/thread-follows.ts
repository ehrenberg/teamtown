import { err, ok, type Result } from '@teamtown/kernel';
import type { Message } from '../domain/message.ts';
import type { Thread } from '../domain/thread.ts';
import { findReadableChannel } from './channel-access.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository } from './ports/message-repository.port.ts';
import type { ThreadRepository } from './ports/thread-repository.port.ts';

/** The thread of a root the person may read, or `not-found`. */
async function readableThread(
  ports: { channels: ChannelRepository; messages: MessageRepository; threads: ThreadRepository },
  input: { personId: string; channelId: string; rootMessageId: string },
): Promise<Result<{ thread: Thread; root: Message }, 'not-found'>> {
  const channel = await findReadableChannel(ports.channels, input.channelId, input.personId);
  const root = channel ? await ports.messages.findById(input.rootMessageId) : null;
  if (root?.props.channelId !== input.channelId || root.isReply) return err('not-found');
  return ok({ thread: await ports.threads.find(input.channelId, input.rootMessageId), root });
}

/** Use case: someone who can read the channel follows a thread or stops following it (ADR-0034). */
export class SetThreadFollowing {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly threads: ThreadRepository,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    rootMessageId: string;
    following: boolean;
  }): Promise<Result<void, 'not-found'>> {
    const found = await readableThread(
      { channels: this.channels, messages: this.messages, threads: this.threads },
      input,
    );
    if (!found.ok) return found;
    const { thread } = found.value;
    if (input.following) thread.follow(input.personId);
    else thread.unfollow(input.personId);
    await this.threads.save(thread);
    return ok(undefined);
  }
}

/** Use case: a follower read a thread up to a reply; the marker only moves forward. */
export class MoveThreadReadMarker {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly threads: ThreadRepository,
  ) {}

  async execute(input: {
    personId: string;
    channelId: string;
    rootMessageId: string;
    messageId: string;
  }): Promise<Result<void, 'not-found'>> {
    const found = await readableThread(
      { channels: this.channels, messages: this.messages, threads: this.threads },
      input,
    );
    const reply = found.ok ? await this.messages.findById(input.messageId) : null;
    if (!found.ok || reply?.props.threadRootId !== input.rootMessageId) return err('not-found');
    found.value.thread.markRead(input.personId, { messageId: reply.props.messageId, postedAt: reply.props.postedAt });
    await this.threads.save(found.value.thread);
    return ok(undefined);
  }
}
