import { useQueryClient } from '@tanstack/react-query';
import type { ChannelSummary } from '@teamtown/contracts';
import { Button } from '@teamtown/ui';
import { Archive, ArchiveRestore, LogOut, Pencil, UserPlus, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { apiDelete, apiSend } from '../../api/api-client.ts';
import { useChannels, useMessages, usePeople } from '../../api/queries.ts';
import { useChatStore } from '../../stores/chat-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { NewMessageDialog, PeoplePickerDialog, PrivateMark, RenameChannelDialog } from './chat-dialogs.tsx';
import { channelTitle, errorText, type Person } from './chat-shared.ts';
import { channelPath, Composer } from './composer.tsx';
import { MentionContext } from './message-body.tsx';
import { flatten } from './message-cache.ts';
import { MessageItem } from './message-item.tsx';
import { ThreadsView } from './threads-view.tsx';

const GENERAL_CHANNEL_ID = 'general';
const MAX_DIRECT_MEMBERS = 8;
/** Pixels from the bottom that still count as "read to the bottom". */
const BOTTOM_SLACK_PX = 24;

/** The open channel or the threads view next to the world (ADR-0033, ADR-0034). Escape closes it. */
export function ChatPanel() {
  const { t } = useTranslation();
  const openChannelId = useChatStore((state) => state.openChannelId);
  const threadsOpen = useChatStore((state) => state.threadsOpen);
  const channels = useChannels();
  const channel = channels.data?.channels.find((c) => c.channelId === openChannelId) ?? null;

  const panel = useRef<HTMLElement>(null);

  // Escape closes the panel while the focus is in it (dialogs handle their own Escape first).
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (panel.current?.contains(document.activeElement)) useChatStore.getState().close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  if (!openChannelId && !threadsOpen) return null;
  return (
    <aside
      ref={panel}
      aria-label={t('chat.panel')}
      className="col-start-3 row-start-2 flex min-h-0 w-[360px] flex-col border-l border-border-subtle bg-surface-raised"
    >
      {threadsOpen ? (
        <ThreadsView />
      ) : channel ? (
        <OpenChannel key={channel.channelId} channel={channel} />
      ) : (
        <p className="p-4 text-sm text-text-secondary">{t(channels.isError ? 'chat.loadError' : 'chat.loading')}</p>
      )}
    </aside>
  );
}

function OpenChannel({ channel }: { readonly channel: ChannelSummary }) {
  const { t } = useTranslation();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const people = usePeople();
  const peopleById = useMemo(
    () => new Map(people.data?.people.map((person) => [person.personId, person])),
    [people.data],
  );
  const title = channelTitle(channel, myPersonId, peopleById, t);
  const mentions = useMemo(
    () => ({ nameOf: (personId: string) => peopleById.get(personId)?.displayName, myPersonId }),
    [peopleById, myPersonId],
  );

  return (
    <MentionContext value={mentions}>
      <ChannelHeader channel={channel} title={title} />
      <MessageList channel={channel} title={title} people={peopleById} />
      <ChannelComposer channel={channel} title={title} />
    </MentionContext>
  );
}

function ChannelHeader({ channel, title }: { readonly channel: ChannelSummary; readonly title: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const [dialog, setDialog] = useState<'rename' | 'invite' | 'add-to-pair' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = channelPath(channel.channelId);
  const isCreator = channel.creatorId !== null && channel.creatorId === myPersonId;
  const isGroup = channel.kind === 'direct' && channel.group;
  const isPair = channel.kind === 'direct' && !channel.group;
  const canLeave = channel.channelId !== GENERAL_CHANNEL_ID && !isPair && channel.members.includes(myPersonId ?? '');
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['channels'] });
  const report = (failure: unknown) => {
    setError(errorText(failure, t));
  };
  const closeDialog = (open: boolean) => {
    if (!open) setDialog(null);
  };

  const action = (label: string, icon: ReactNode, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary"
    >
      {icon}
    </button>
  );

  return (
    <header className="flex flex-col gap-1 border-b border-border-subtle px-4 py-3">
      <div className="flex items-center gap-1">
        <h2 className="flex min-w-0 flex-1 items-center gap-1.5 font-display text-base font-semibold">
          <span className="truncate">{title}</span>
          {channel.kind === 'private' && <PrivateMark />}
        </h2>
        {isCreator &&
          !channel.archived &&
          action(t('chat.rename'), <Pencil aria-hidden="true" className="size-4" />, () => {
            setDialog('rename');
          })}
        {((isCreator && channel.kind === 'private') || isGroup || isPair) &&
          !channel.archived &&
          action(
            t(channel.kind === 'private' ? 'chat.invite' : 'chat.addPeople'),
            <UserPlus aria-hidden="true" className="size-4" />,
            () => {
              setDialog(isPair ? 'add-to-pair' : 'invite');
            },
          )}
        {isCreator &&
          action(
            t(channel.archived ? 'chat.unarchive' : 'chat.archive'),
            channel.archived ? (
              <ArchiveRestore aria-hidden="true" className="size-4" />
            ) : (
              <Archive aria-hidden="true" className="size-4" />
            ),
            () => {
              apiSend('PATCH', path, { archived: !channel.archived }).then(refresh, report);
            },
          )}
        {canLeave &&
          action(t('chat.leave'), <LogOut aria-hidden="true" className="size-4" />, () => {
            apiDelete(`${path}/members/me`).then(() => {
              useChatStore.getState().close();
              refresh();
            }, report);
          })}
        {action(t('chat.closePanel'), <X aria-hidden="true" className="size-4" />, () => {
          useChatStore.getState().close();
        })}
      </div>
      <p className="text-xs text-text-secondary">
        {t('chat.memberCount', { count: channel.members.length })}
        {channel.archived && ` · ${t('chat.archivedHint')}`}
      </p>
      {error && (
        <p role="alert" className="text-xs">
          {error}
        </p>
      )}
      {dialog === 'rename' && <RenameChannelDialog channel={channel} open onOpenChange={closeDialog} />}
      <PeoplePickerDialog
        open={dialog === 'invite'}
        onOpenChange={closeDialog}
        title={t(channel.kind === 'private' ? 'chat.invite' : 'chat.addPeople')}
        description={t(channel.kind === 'private' ? 'chat.inviteIntro' : 'chat.addPeopleIntro')}
        confirmLabel={t(channel.kind === 'private' ? 'chat.invite' : 'chat.addPeople')}
        exclude={channel.members}
        max={channel.kind === 'private' ? MAX_DIRECT_MEMBERS : MAX_DIRECT_MEMBERS - channel.members.length}
        onConfirm={async (personIds) => {
          await apiSend('POST', `${path}/members`, { personIds });
          refresh();
        }}
      />
      {/* A 1:1 DM stays between its two people: adding someone starts a group DM with all three. */}
      <NewMessageDialog
        open={dialog === 'add-to-pair'}
        onOpenChange={closeDialog}
        initial={channel.members.filter((personId) => personId !== myPersonId)}
      />
    </header>
  );
}

function MessageList({
  channel,
  title,
  people,
}: {
  readonly channel: ChannelSummary;
  readonly title: string;
  readonly people: ReadonlyMap<string, Person>;
}) {
  const { t, i18n } = useTranslation();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const history = useMessages(channel.channelId);
  const messages = flatten(history.data);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  /** The newest message the read marker was moved to (or is already at). */
  const readTo = useRef<string | null>(channel.readMarker);
  /** Roots whose threads are expanded inline (ADR-0034). */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const newest = messages.at(-1);
  const isMember = myPersonId !== null && channel.members.includes(myPersonId);
  const day = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' });
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' });
  const byId = new Map(messages.map((message) => [message.messageId, message]));
  const toggle = (messageId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(messageId)) next.add(messageId);
      return next;
    });
  };

  // Stay at the newest message while reading at the bottom.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && atBottom.current) element.scrollTop = element.scrollHeight;
  }, [newest?.messageId]);

  const markRead = () => {
    if (!isMember || !newest || newest.messageId === readTo.current || !atBottom.current) return;
    if (document.visibilityState !== 'visible') return;
    readTo.current = newest.messageId;
    void apiSend('PUT', `${channelPath(channel.channelId)}/read-marker`, { messageId: newest.messageId });
  };
  useEffect(markRead);

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_SLACK_PX;
    markRead();
  };

  return (
    <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {history.hasNextPage && (
        <Button
          variant="ghost"
          className="mb-2 w-full"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {t('chat.loadOlder')}
        </Button>
      )}
      {history.isPending && <p className="text-sm text-text-secondary">{t('chat.loading')}</p>}
      {history.isError && (
        <p role="alert" className="text-sm">
          {t('chat.loadError')}
        </p>
      )}
      {history.isSuccess && messages.length === 0 && <p className="text-sm text-text-secondary">{t('chat.empty')}</p>}
      <ol role="log" aria-live="polite" aria-label={t('chat.messages')} className="flex flex-col">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const posted = new Date(message.postedAt);
          const newDay = !previous || day.format(new Date(previous.postedAt)) !== day.format(posted);
          const sameAuthor =
            !newDay &&
            previous.authorId === message.authorId &&
            !previous.thread &&
            !message.threadRootId &&
            posted.getTime() - new Date(previous.postedAt).getTime() < 5 * 60_000;
          const root = message.threadRootId ? byId.get(message.threadRootId) : undefined;
          return (
            <li key={message.messageId}>
              {newDay && (
                <p className="my-2 text-center text-xs font-medium text-text-secondary">{day.format(posted)}</p>
              )}
              <MessageItem
                message={message}
                channel={channel}
                title={title}
                people={people}
                showAuthor={!sameAuthor}
                time={time.format(posted)}
                {...(message.threadRootId
                  ? { repliedTo: root && !root.deleted ? excerpt(root.body) : null }
                  : {
                      expanded: expanded.has(message.messageId),
                      onToggleThread: () => {
                        toggle(message.messageId);
                      },
                    })}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The first words of a root, without Markdown marks or mention tokens. */
const excerpt = (body: string) => {
  const plain = body
    .replace(/<@[^>]+>/g, '@…')
    .replace(/[*_`#>[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 60 ? `${plain.slice(0, 60)}…` : plain;
};

/** Members write; others of a public channel join first; archived channels take nothing new. */
function ChannelComposer({ channel, title }: { readonly channel: ChannelSummary; readonly title: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const [error, setError] = useState<string | null>(null);
  const isMember = myPersonId !== null && channel.members.includes(myPersonId);

  if (channel.archived) {
    return <p className="border-t border-border-subtle p-4 text-sm text-text-secondary">{t('chat.archivedHint')}</p>;
  }
  if (isMember) return <Composer channel={channel} title={title} />;
  return (
    <div className="border-t border-border-subtle p-4">
      {error && (
        <p role="alert" className="mb-1.5 text-xs">
          {error}
        </p>
      )}
      <Button
        onClick={() => {
          apiSend('POST', `${channelPath(channel.channelId)}/members`, { personIds: [myPersonId] }).then(
            () => void queryClient.invalidateQueries({ queryKey: ['channels'] }),
            (failure: unknown) => {
              setError(errorText(failure, t));
            },
          );
        }}
      >
        {t('chat.join')}
      </Button>
    </div>
  );
}
