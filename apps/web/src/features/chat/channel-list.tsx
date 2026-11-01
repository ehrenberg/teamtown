import type { ChannelSummary } from '@teamtown/contracts';
import { AtSign, Compass, MessagesSquare, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useChannels, usePeople, useThreads } from '../../api/queries.ts';
import { useChatStore } from '../../stores/chat-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { BrowseChannelsDialog, NewChannelDialog, NewMessageDialog, PrivateMark } from './chat-dialogs.tsx';
import { channelTitle } from './chat-shared.ts';

const byName = (a: ChannelSummary, b: ChannelSummary) =>
  Number(a.archived) - Number(b.archived) || (a.name ?? '').localeCompare(b.name ?? '');
const byLatest = (a: ChannelSummary, b: ChannelSummary) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');

/** Channels and DMs in the sidebar (ADR-0033): the non-spatial way into the chat. */
export function ChannelList() {
  const { t } = useTranslation();
  const channels = useChannels();
  const people = usePeople();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const openChannelId = useChatStore((state) => state.openChannelId);
  const threadsOpen = useChatStore((state) => state.threadsOpen);
  const threads = useThreads();
  const unreadReplies = (threads.data?.threads ?? []).reduce((sum, thread) => sum + thread.unreadCount, 0);
  const [dialog, setDialog] = useState<'new-channel' | 'browse' | 'new-message' | null>(null);
  const peopleById = useMemo(
    () => new Map(people.data?.people.map((person) => [person.personId, person])),
    [people.data],
  );
  const all = channels.data?.channels ?? [];
  const named = all.filter((channel) => channel.kind !== 'direct').sort(byName);
  const direct = all.filter((channel) => channel.kind === 'direct').sort(byLatest);
  const closeDialog = (open: boolean) => {
    if (!open) setDialog(null);
  };

  const row = (channel: ChannelSummary) => {
    const title = channelTitle(channel, myPersonId, peopleById, t);
    const unread = channel.unreadCount;
    const mentions = channel.mentionCount;
    return (
      <li key={channel.channelId}>
        <button
          type="button"
          aria-current={channel.channelId === openChannelId ? 'true' : undefined}
          onClick={() => {
            useChatStore.getState().open(channel.channelId);
          }}
          className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-neutral-200 aria-[current]:bg-neutral-200 ${
            channel.archived ? 'text-text-secondary' : ''
          }`}
        >
          <span className={`min-w-0 flex-1 truncate ${unread > 0 ? 'font-semibold' : ''}`}>{title}</span>
          {channel.kind === 'private' && <PrivateMark />}
          {mentions > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-espresso px-1.5 text-xs font-semibold text-cream">
              <AtSign aria-hidden="true" className="size-3" />
              {mentions}
              <span className="sr-only">{t('chat.mentions', { count: mentions })}</span>
            </span>
          )}
          {unread > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-terracotta-500 px-1.5 text-xs font-semibold text-white">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-white" />
              {unread}
              <span className="sr-only">{t('chat.unread', { count: unread })}</span>
            </span>
          )}
        </button>
      </li>
    );
  };

  const heading = (id: string, label: string, actions: ReactNode) => (
    <div className="flex items-center gap-1">
      <h2 id={id} className="flex-1 font-display text-xs font-semibold tracking-wide text-text-secondary uppercase">
        {label}
      </h2>
      {actions}
    </div>
  );
  const iconButton = (label: string, icon: ReactNode, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-6 place-items-center rounded-sm text-text-secondary hover:bg-neutral-200 hover:text-text-primary"
    >
      {icon}
    </button>
  );

  return (
    <>
      {/* Followed threads with unread replies (ADR-0034). */}
      <button
        type="button"
        aria-current={threadsOpen ? 'true' : undefined}
        onClick={() => {
          useChatStore.getState().openThreads();
        }}
        className="mt-6 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-neutral-200 aria-[current]:bg-neutral-200"
      >
        <MessagesSquare aria-hidden="true" className="size-4 text-text-secondary" />
        <span className={`flex-1 ${unreadReplies > 0 ? 'font-semibold' : ''}`}>{t('chat.threads')}</span>
        {unreadReplies > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-terracotta-500 px-1.5 text-xs font-semibold text-white">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-white" />
            {unreadReplies}
            <span className="sr-only">{t('chat.unreadReplies', { count: unreadReplies })}</span>
          </span>
        )}
      </button>
      <section aria-labelledby="channels-heading" className="mt-4 flex flex-col gap-1">
        {heading(
          'channels-heading',
          t('chat.channels'),
          <>
            {iconButton(t('chat.browse'), <Compass aria-hidden="true" className="size-4" />, () => {
              setDialog('browse');
            })}
            {iconButton(t('chat.newChannel'), <Plus aria-hidden="true" className="size-4" />, () => {
              setDialog('new-channel');
            })}
          </>,
        )}
        {channels.isError && <p className="text-xs text-text-secondary">{t('chat.loadError')}</p>}
        <ul className="flex flex-col">{named.map(row)}</ul>
      </section>
      <section aria-labelledby="dms-heading" className="mt-4 flex flex-col gap-1">
        {heading(
          'dms-heading',
          t('chat.directMessages'),
          iconButton(t('chat.newMessage'), <Plus aria-hidden="true" className="size-4" />, () => {
            setDialog('new-message');
          }),
        )}
        {channels.isSuccess && direct.length === 0 && (
          <p className="px-2 text-xs text-text-secondary">{t('chat.noDirectMessages')}</p>
        )}
        <ul className="flex flex-col">{direct.map(row)}</ul>
      </section>
      <NewChannelDialog open={dialog === 'new-channel'} onOpenChange={closeDialog} />
      <BrowseChannelsDialog open={dialog === 'browse'} onOpenChange={closeDialog} />
      <NewMessageDialog open={dialog === 'new-message'} onOpenChange={closeDialog} />
    </>
  );
}
