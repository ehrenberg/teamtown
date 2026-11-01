import { MessageSchema, type ChannelSummary, type MessageContract } from '@teamtown/contracts';
import { Button } from '@teamtown/ui';
import { MessageSquareReply, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiDelete, apiSend } from '../../api/api-client.ts';
import { useReplies, useThreads } from '../../api/queries.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { errorText, type Person } from './chat-shared.ts';
import { channelPath, Composer, MentionTextarea } from './composer.tsx';
import { MessageBody } from './message-body.tsx';
import { flatten } from './message-cache.ts';
import { QUICK_EMOJI, ReactionChips, ReactionPicker, toggleReaction } from './reactions.tsx';

const toolButton = 'grid size-7 place-items-center rounded-sm hover:bg-neutral-100';

/**
 * One message: author, body, reactions and, for roots, the thread summary that expands the replies inline
 * (ADR-0034). On hover or focus a toolbar offers quick reactions, the picker, "Reply in thread", edit and delete.
 */
export function MessageItem({
  message,
  channel,
  title,
  people,
  showAuthor,
  time,
  expanded = false,
  onToggleThread,
  repliedTo,
}: {
  readonly message: MessageContract;
  readonly channel: ChannelSummary;
  readonly title: string;
  readonly people: ReadonlyMap<string, Person>;
  readonly showAuthor: boolean;
  readonly time: string;
  /** Roots only: whether the thread is expanded under this message. */
  readonly expanded?: boolean;
  readonly onToggleThread?: () => void;
  /** A reply also sent to the channel, shown there: an excerpt of its root, or `null` if that isn't loaded. */
  readonly repliedTo?: string | null;
}) {
  const { t } = useTranslation();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = `${channelPath(message.channelId)}/messages/${encodeURIComponent(message.messageId)}`;
  const nameOf = (personId: string) => people.get(personId)?.displayName ?? t('chat.someone');
  const name = nameOf(message.authorId);
  const isMember = myPersonId !== null && channel.members.includes(myPersonId);
  const open = !channel.archived;
  const canReact = isMember && open && !message.deleted;
  const isMine = message.authorId === myPersonId;
  const mentionsMe = myPersonId !== null && message.mentions.includes(myPersonId);
  const report = (failure: unknown) => {
    setError(errorText(failure, t));
  };
  const react = (emoji: string) => {
    const mine = message.reactions.some((r) => r.emoji === emoji && r.personIds.includes(myPersonId ?? ''));
    toggleReaction(message, emoji, mine).catch(report);
  };

  return (
    <>
      <article
        aria-label={t('chat.messageBy', { name, time })}
        className={`group relative rounded-sm px-1 hover:bg-neutral-50 ${showAuthor ? 'mt-2' : ''} ${
          mentionsMe ? 'border-l-2 border-terracotta-500 bg-terracotta-100/40 pl-2' : ''
        }`}
      >
        {showAuthor && (
          <p className="flex items-baseline gap-2 text-sm">
            <span className="font-semibold">{name}</span>
            <span className="text-xs text-text-secondary">{time}</span>
          </p>
        )}
        {repliedTo !== undefined && (
          <p className="truncate text-xs text-text-secondary">
            {repliedTo ? t('chat.repliedToThread', { excerpt: repliedTo }) : t('chat.repliedToAThread')}
          </p>
        )}
        {message.deleted ? (
          <p className="text-sm text-text-secondary italic">{t('chat.deleted')}</p>
        ) : editing ? (
          <MessageEditor
            message={message}
            memberIds={channel.members}
            onCancel={() => {
              setEditing(false);
            }}
            onSave={async (body) => {
              try {
                await apiSend('PATCH', path, { body }, MessageSchema);
                setEditing(false);
                setError(null);
                return true;
              } catch (failure) {
                report(failure);
                return false;
              }
            }}
          />
        ) : (
          <div className="text-sm break-words">
            <MessageBody body={message.body} />
            {message.editedAt && <span className="text-xs text-text-secondary"> ({t('chat.edited')})</span>}
          </div>
        )}
        <ReactionChips message={message} myPersonId={myPersonId} nameOf={nameOf} canReact={canReact} onError={report} />
        {error && (
          <p role="alert" className="text-xs">
            {error}
          </p>
        )}

        {!editing && (canReact || (isMine && open && !message.deleted)) && (
          <div
            role="toolbar"
            aria-label={t('chat.messageActions')}
            className="absolute -top-3 right-1 hidden items-center gap-0.5 rounded-sm bg-surface-raised p-0.5 shadow-raised group-focus-within:flex group-hover:flex"
          >
            {canReact &&
              QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  aria-label={t('chat.reactWith', { emoji })}
                  title={t('chat.reactWith', { emoji })}
                  onClick={() => {
                    react(emoji);
                  }}
                  className={`${toolButton} text-sm`}
                >
                  {emoji}
                </button>
              ))}
            {canReact && <ReactionPicker onPick={react} />}
            {onToggleThread && isMember && !message.deleted && (
              <button
                type="button"
                aria-label={t('chat.replyInThread')}
                title={t('chat.replyInThread')}
                onClick={() => {
                  if (!expanded) onToggleThread();
                }}
                className={toolButton}
              >
                <MessageSquareReply aria-hidden="true" className="size-3.5" />
              </button>
            )}
            {isMine && !message.deleted && (
              <>
                <button
                  type="button"
                  aria-label={t('chat.edit')}
                  title={t('chat.edit')}
                  onClick={() => {
                    setEditing(true);
                  }}
                  className={toolButton}
                >
                  <Pencil aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={t('chat.delete')}
                  title={t('chat.delete')}
                  onClick={() => {
                    apiDelete(path).catch(report);
                  }}
                  className={toolButton}
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </article>
      {/* Outside the article, so hovering a reply doesn't show the root's toolbar. */}
      {onToggleThread && (message.thread !== null || expanded) && (
        <ThreadSummaryButton message={message} people={people} expanded={expanded} onToggle={onToggleThread} />
      )}
      {expanded && <InlineThread root={message} channel={channel} title={title} people={people} />}
    </>
  );
}

function ThreadSummaryButton({
  message,
  people,
  expanded,
  onToggle,
}: {
  readonly message: MessageContract;
  readonly people: ReadonlyMap<string, Person>;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  const { t, i18n } = useTranslation();
  const thread = message.thread;
  const count = thread?.replyCount ?? 0;
  const last = thread
    ? new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(new Date(thread.lastReplyAt))
    : '';
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="mt-1 flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs font-medium text-text-link hover:bg-neutral-100"
    >
      <span aria-hidden="true" className="flex -space-x-1">
        {(thread?.replierIds ?? []).map((personId) => (
          <span
            key={personId}
            className="size-3.5 rounded-full ring-1 ring-surface-raised"
            style={{ backgroundColor: people.get(personId)?.avatarColor ?? 'var(--color-neutral-300)' }}
          />
        ))}
      </span>
      {count > 0 ? t('chat.replies', { count }) : t('chat.newThread')}
      {count > 0 && <span className="font-normal text-text-secondary">{t('chat.lastReply', { time: last })}</span>}
    </button>
  );
}

/** The replies under their root and a reply composer; reading to the newest reply moves my thread marker. */
export function InlineThread({
  root,
  channel,
  title,
  people,
}: {
  readonly root: MessageContract;
  readonly channel: ChannelSummary;
  readonly title: string;
  readonly people: ReadonlyMap<string, Person>;
}) {
  const { t, i18n } = useTranslation();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const replies = useReplies(channel.channelId, root.messageId, true);
  const threads = useThreads();
  const messages = flatten(replies.data);
  const newest = messages.at(-1);
  const readTo = useRef<string | null>(null);
  const following = threads.data?.threads.some((thread) => thread.root.messageId === root.messageId) ?? false;
  const isMember = myPersonId !== null && channel.members.includes(myPersonId);
  const threadPath = `${channelPath(channel.channelId)}/threads/${encodeURIComponent(root.messageId)}`;
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' });

  // Seeing the newest reply counts as reading the thread (only followers keep a marker).
  useEffect(() => {
    if (!following || !newest || newest.messageId === readTo.current || document.visibilityState !== 'visible') return;
    readTo.current = newest.messageId;
    void apiSend('PUT', `${threadPath}/read-marker`, { messageId: newest.messageId });
  });

  return (
    <section
      aria-label={t('chat.threadOf', { name: people.get(root.authorId)?.displayName ?? t('chat.someone') })}
      className="mt-1 mb-2 ml-1 border-l-2 border-border-subtle pl-3"
    >
      {replies.hasNextPage && (
        <Button
          variant="ghost"
          className="mb-1 w-full"
          disabled={replies.isFetchingNextPage}
          onClick={() => void replies.fetchNextPage()}
        >
          {t('chat.loadOlderReplies')}
        </Button>
      )}
      {replies.isPending && <p className="text-xs text-text-secondary">{t('chat.loading')}</p>}
      {replies.isError && (
        <p role="alert" className="text-xs">
          {t('chat.loadError')}
        </p>
      )}
      <ol className="flex flex-col">
        {messages.map((reply, index) => (
          <li key={reply.messageId}>
            <MessageItem
              message={reply}
              channel={channel}
              title={title}
              people={people}
              showAuthor={messages[index - 1]?.authorId !== reply.authorId}
              time={time.format(new Date(reply.postedAt))}
            />
          </li>
        ))}
      </ol>
      {isMember && !channel.archived && (
        <Composer channel={channel} title={title} threadRootId={root.messageId} focusOnMount={messages.length === 0} />
      )}
      {threads.isSuccess && (root.thread !== null || messages.length > 0) && (
        <button
          type="button"
          onClick={() => {
            const done = () => void threads.refetch();
            (following ? apiDelete(`${threadPath}/follow`) : apiSend('PUT', `${threadPath}/follow`, {})).then(
              done,
              done,
            );
          }}
          className="mt-1 text-xs text-text-secondary underline"
        >
          {following ? t('chat.stopFollowing') : t('chat.follow')}
        </button>
      )}
    </section>
  );
}

function MessageEditor({
  message,
  memberIds,
  onSave,
  onCancel,
}: {
  readonly message: MessageContract;
  readonly memberIds: readonly string[];
  readonly onSave: (body: string) => Promise<boolean>;
  readonly onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <MentionTextarea
        label={t('chat.editMessage')}
        memberIds={memberIds}
        initial={message.body}
        rows={3}
        focusOnMount
        onSubmit={onSave}
        onEscape={onCancel}
      />
      <div className="flex gap-1.5">
        <Button variant="ghost" onClick={onCancel}>
          {t('chat.cancel')}
        </Button>
      </div>
      <p className="text-xs text-text-secondary">{t('chat.editHint')}</p>
    </div>
  );
}
