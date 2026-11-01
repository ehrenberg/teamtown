import type { InfiniteData } from '@tanstack/react-query';
import type { MessageContract, MessagePageResponse } from '@teamtown/contracts';

export type MessagePages = InfiniteData<MessagePageResponse>;

/** Adds a pushed message to the newest page, unless it is already there (e.g. the own post's answer). */
export function withPosted(data: MessagePages | undefined, message: MessageContract): MessagePages | undefined {
  if (!data) return data;
  const [newest, ...older] = data.pages;
  if (!newest || data.pages.some((page) => page.messages.some((m) => m.messageId === message.messageId))) return data;
  return { ...data, pages: [{ ...newest, messages: [...newest.messages, message] }, ...older] };
}

/** Replaces a message wherever it is loaded (edited or deleted); a root keeps its thread summary. */
export function withReplaced(data: MessagePages | undefined, message: MessageContract): MessagePages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((m) =>
        m.messageId === message.messageId ? { ...message, thread: message.thread ?? m.thread } : m,
      ),
    })),
  };
}

export function withDeleted(data: MessagePages | undefined, messageId: string): MessagePages | undefined {
  const existing = data?.pages.flatMap((page) => page.messages).find((m) => m.messageId === messageId);
  return existing ? withReplaced(data, { ...existing, body: '', mentions: [], reactions: [], deleted: true }) : data;
}

/** Applies a pushed reaction change to the message wherever it is loaded (ADR-0034). */
export function withReaction(
  data: MessagePages | undefined,
  change: { readonly messageId: string; readonly personId: string; readonly emoji: string; readonly added: boolean },
): MessagePages | undefined {
  const existing = data?.pages.flatMap((page) => page.messages).find((m) => m.messageId === change.messageId);
  if (!existing) return data;
  const reaction = existing.reactions.find((r) => r.emoji === change.emoji);
  if ((reaction?.personIds.includes(change.personId) ?? false) === change.added) return data;
  const reactions = change.added
    ? reaction
      ? existing.reactions.map((r) => (r === reaction ? { ...r, personIds: [...r.personIds, change.personId] } : r))
      : [...existing.reactions, { emoji: change.emoji, personIds: [change.personId] }]
    : existing.reactions
        .map((r) => (r === reaction ? { ...r, personIds: r.personIds.filter((id) => id !== change.personId) } : r))
        .filter((r) => r.personIds.length > 0);
  return withReplaced(data, { ...existing, reactions });
}

/** Counts a new reply on its root: one more reply, the newest time, the replier first (live pushes carry no summary). */
export function withReply(data: MessagePages | undefined, reply: MessageContract): MessagePages | undefined {
  const root = data?.pages.flatMap((page) => page.messages).find((m) => m.messageId === reply.threadRootId);
  if (!root) return data;
  const thread = {
    replyCount: (root.thread?.replyCount ?? 0) + 1,
    lastReplyAt: reply.postedAt,
    replierIds: [reply.authorId, ...(root.thread?.replierIds ?? []).filter((id) => id !== reply.authorId)].slice(0, 3),
  };
  return withReplaced(data, { ...root, thread });
}

/** All loaded messages, oldest first. */
export const flatten = (data: MessagePages | undefined): MessageContract[] =>
  data ? [...data.pages].reverse().flatMap((page) => page.messages) : [];
