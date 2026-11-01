import type { Message } from '../domain/message.ts';
import type { ChannelRepository } from './ports/channel-repository.port.ts';
import type { MessageRepository, ThreadSummary } from './ports/message-repository.port.ts';
import type { ThreadRepository } from './ports/thread-repository.port.ts';

/** Followed threads listed at most; older ones drop out of the view. */
const LIMIT = 30;

export interface ThreadOverview {
  readonly channelId: string;
  readonly root: Message;
  readonly summary: ThreadSummary | null;
  readonly unreadCount: number;
}

/**
 * Use case: the threads view, the person's followed threads, newest activity first (ADR-0034). Threads of
 * channels the person can't read anymore (e.g. a private channel they left) are left out.
 */
export class ListThreads {
  constructor(
    private readonly channels: ChannelRepository,
    private readonly messages: MessageRepository,
    private readonly threads: ThreadRepository,
  ) {}

  async execute(personId: string): Promise<ThreadOverview[]> {
    const followed = await this.threads.listFollowed(personId, LIMIT);
    const readable = new Map<string, boolean>();
    for (const channelId of new Set(followed.map((thread) => thread.channelId))) {
      readable.set(channelId, (await this.channels.findById(channelId))?.canRead(personId) ?? false);
    }
    const visible = followed.filter((thread) => readable.get(thread.channelId));
    const summaries = await this.messages.threadSummaries(visible.map((thread) => thread.rootMessageId));
    const overviews: ThreadOverview[] = [];
    for (const thread of visible) {
      const root = await this.messages.findById(thread.rootMessageId);
      if (!root) continue;
      overviews.push({
        channelId: thread.channelId,
        root,
        summary: summaries.get(thread.rootMessageId) ?? null,
        unreadCount: thread.unreadCount,
      });
    }
    return overviews;
  }
}
