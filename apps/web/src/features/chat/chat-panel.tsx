import { useQueryClient } from '@tanstack/react-query';
import { MessageSchema, type ChannelSummary, type MessageContract } from '@teamtown/contracts';
import { Button } from '@teamtown/ui';
import { Archive, ArchiveRestore, LogOut, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { apiDelete, apiSend } from '../../api/api-client.ts';
import { messagesKey, useChannels, useMessages, usePeople } from '../../api/queries.ts';
import { useChatStore } from '../../stores/chat-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { NewMessageDialog, PeoplePickerDialog, PrivateMark, RenameChannelDialog } from './chat-dialogs.tsx';
import { channelTitle, errorText, type Person } from './chat-shared.ts';
import { MessageBody } from './message-body.tsx';
import { flatten, withPosted, type MessagePages } from './message-cache.ts';

const GENERAL_CHANNEL_ID = 'general';
const MAX_DIRECT_MEMBERS = 8;
/** Pixels from the bottom that still count as "read to the bottom". */
const BOTTOM_SLACK_PX = 24;

const channelPath = (channelId: string) => `/channels/${encodeURIComponent(channelId)}`;

/** The open channel next to the world (ADR-0033). Escape closes it. */
export function ChatPanel() {
  const { t } = useTranslation();
  const openChannelId = useChatStore((state) => state.openChannelId);
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

  if (!openChannelId) return null;
  return (
    <aside
      ref={panel}
      aria-label={t('chat.panel')}
      className="col-start-3 row-start-2 flex min-h-0 w-[360px] flex-col border-l border-border-subtle bg-surface-raised"
    >
      {channel ? (
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

  return (
    <>
      <ChannelHeader channel={channel} title={title} />
      <MessageList channel={channel} people={peopleById} />
      <Composer channel={channel} title={title} />
    </>
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
  people,
}: {
  readonly channel: ChannelSummary;
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
  const newest = messages.at(-1);
  const isMember = myPersonId !== null && channel.members.includes(myPersonId);
  const day = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full' });
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' });

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
            posted.getTime() - new Date(previous.postedAt).getTime() < 5 * 60_000;
          return (
            <li key={message.messageId}>
              {newDay && (
                <p className="my-2 text-center text-xs font-medium text-text-secondary">{day.format(posted)}</p>
              )}
              <MessageItem
                message={message}
                author={people.get(message.authorId)}
                showAuthor={!sameAuthor}
                time={time.format(posted)}
                isMine={message.authorId === myPersonId}
                canChange={!channel.archived}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MessageItem({
  message,
  author,
  showAuthor,
  time,
  isMine,
  canChange,
}: {
  readonly message: MessageContract;
  readonly author: Person | undefined;
  readonly showAuthor: boolean;
  readonly time: string;
  readonly isMine: boolean;
  readonly canChange: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = `${channelPath(message.channelId)}/messages/${encodeURIComponent(message.messageId)}`;
  const name = author?.displayName ?? t('chat.someone');

  return (
    <article
      aria-label={t('chat.messageBy', { name, time })}
      className={`group relative rounded-sm px-1 hover:bg-neutral-50 ${showAuthor ? 'mt-2' : ''}`}
    >
      {showAuthor && (
        <p className="flex items-baseline gap-2 text-sm">
          <span className="font-semibold">{name}</span>
          <span className="text-xs text-text-secondary">{time}</span>
        </p>
      )}
      {message.deleted ? (
        <p className="text-sm text-text-secondary italic">{t('chat.deleted')}</p>
      ) : editing ? (
        <MessageEditor
          initial={message.body}
          onCancel={() => {
            setEditing(false);
          }}
          onSave={(body) => {
            apiSend('PATCH', path, { body }, MessageSchema).then(
              () => {
                setEditing(false);
                setError(null);
              },
              (failure: unknown) => {
                setError(errorText(failure, t));
              },
            );
          }}
        />
      ) : (
        <div className="text-sm break-words">
          <MessageBody body={message.body} />
          {message.editedAt && <span className="text-xs text-text-secondary"> ({t('chat.edited')})</span>}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs">
          {error}
        </p>
      )}
      {isMine && canChange && !message.deleted && !editing && (
        <div className="absolute top-0 right-0 hidden gap-0.5 rounded-sm bg-surface-raised shadow-raised group-focus-within:flex group-hover:flex">
          <button
            type="button"
            aria-label={t('chat.edit')}
            title={t('chat.edit')}
            onClick={() => {
              setEditing(true);
            }}
            className="grid size-7 place-items-center rounded-sm hover:bg-neutral-100"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={t('chat.delete')}
            title={t('chat.delete')}
            onClick={() => {
              apiDelete(path).catch((failure: unknown) => {
                setError(errorText(failure, t));
              });
            }}
            className="grid size-7 place-items-center rounded-sm hover:bg-neutral-100"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      )}
    </article>
  );
}

/** Enter sends, Shift+Enter makes a new line. */
const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>, send: () => void) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
    event.preventDefault();
    send();
  }
};

function MessageEditor({
  initial,
  onSave,
  onCancel,
}: {
  readonly initial: string;
  readonly onSave: (body: string) => void;
  readonly onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState(initial);
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={body}
        aria-label={t('chat.editMessage')}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the person just chose to edit this message
        autoFocus
        rows={3}
        onChange={(event) => {
          setBody(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
          sendOnEnter(event, () => {
            if (body.trim()) onSave(body);
          });
        }}
        className="resize-none rounded-md border border-border-subtle bg-surface-sunken px-2 py-1.5 text-sm"
      />
      <div className="flex gap-1.5">
        <Button
          variant="secondary"
          onClick={() => {
            if (body.trim()) onSave(body);
          }}
        >
          {t('chat.save')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('chat.cancel')}
        </Button>
      </div>
    </div>
  );
}

function Composer({ channel, title }: { readonly channel: ChannelSummary; readonly title: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const path = channelPath(channel.channelId);
  const isMember = myPersonId !== null && channel.members.includes(myPersonId);

  if (channel.archived) {
    return <p className="border-t border-border-subtle p-4 text-sm text-text-secondary">{t('chat.archivedHint')}</p>;
  }
  if (!isMember) {
    return (
      <div className="border-t border-border-subtle p-4">
        <Button
          onClick={() => {
            apiSend('POST', `${path}/members`, { personIds: [myPersonId] }).then(
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

  const send = () => {
    if (!body.trim()) return;
    const sent = body;
    setBody('');
    apiSend('POST', `${path}/messages`, { body: sent }, MessageSchema).then(
      (message) => {
        setError(null);
        queryClient.setQueryData<MessagePages>(messagesKey(channel.channelId), (data) => withPosted(data, message));
      },
      (failure: unknown) => {
        setBody(sent);
        setError(errorText(failure, t));
      },
    );
  };

  return (
    <div className="border-t border-border-subtle p-3">
      {error && (
        <p role="alert" className="mb-1.5 text-xs">
          {error}
        </p>
      )}
      <textarea
        value={body}
        rows={2}
        maxLength={4000}
        aria-label={t('chat.composerLabel', { title })}
        placeholder={t('chat.composerPlaceholder', { title })}
        onChange={(event) => {
          setBody(event.target.value);
        }}
        onKeyDown={(event) => {
          sendOnEnter(event, send);
        }}
        className="w-full resize-none rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-sm"
      />
      <p className="mt-1 text-xs text-text-secondary">{t('chat.composerHint')}</p>
    </div>
  );
}
