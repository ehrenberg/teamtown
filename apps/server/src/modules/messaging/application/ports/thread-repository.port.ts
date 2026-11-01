import type { Thread } from '../../domain/thread.ts';

/** A thread the person follows, as the threads view lists it. */
export interface FollowedThread {
  readonly channelId: string;
  readonly rootMessageId: string;
  /** Replies by others after the person's thread read marker; deleted ones don't count. */
  readonly unreadCount: number;
  readonly lastReplyAt: Date;
}

export interface ThreadRepository {
  /** The thread with its stored follows; a thread nobody follows yet has none. */
  find(channelId: string, rootMessageId: string): Promise<Thread>;
  /** The person's followed threads with replies, newest activity first. */
  listFollowed(personId: string, limit: number): Promise<FollowedThread[]>;
  /** Writes the changed follows and the recorded events into the outbox in one transaction (ADR-0018). */
  save(thread: Thread): Promise<void>;
}

export const THREAD_REPOSITORY = Symbol('THREAD_REPOSITORY');
