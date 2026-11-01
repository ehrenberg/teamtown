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

/** Replaces a message wherever it is loaded (edited or deleted). */
export function withReplaced(data: MessagePages | undefined, message: MessageContract): MessagePages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      messages: page.messages.map((m) => (m.messageId === message.messageId ? message : m)),
    })),
  };
}

export function withDeleted(data: MessagePages | undefined, messageId: string): MessagePages | undefined {
  const existing = data?.pages.flatMap((page) => page.messages).find((m) => m.messageId === messageId);
  return existing ? withReplaced(data, { ...existing, body: '', deleted: true }) : data;
}

/** All loaded messages, oldest first. */
export const flatten = (data: MessagePages | undefined): MessageContract[] =>
  data ? [...data.pages].reverse().flatMap((page) => page.messages) : [];
