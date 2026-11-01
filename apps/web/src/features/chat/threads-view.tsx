import { X } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useChannels, usePeople, useThreads } from '../../api/queries.ts';
import { useChatStore } from '../../stores/chat-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { channelTitle } from './chat-shared.ts';
import { MentionContext } from './message-body.tsx';
import { MessageItem } from './message-item.tsx';

/**
 * The threads I follow, newest activity first, each with its root and replies expanded (ADR-0034). Threads with
 * unread replies are marked; reading a thread to its end moves my thread marker.
 */
export function ThreadsView() {
  const { t, i18n } = useTranslation();
  const threads = useThreads();
  const channels = useChannels();
  const people = usePeople();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const peopleById = useMemo(
    () => new Map(people.data?.people.map((person) => [person.personId, person])),
    [people.data],
  );
  const mentions = useMemo(
    () => ({ nameOf: (personId: string) => peopleById.get(personId)?.displayName, myPersonId }),
    [peopleById, myPersonId],
  );
  const time = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' });
  const list = threads.data?.threads ?? [];

  return (
    <MentionContext value={mentions}>
      <header className="flex items-center gap-1 border-b border-border-subtle px-4 py-3">
        <h2 className="flex-1 font-display text-base font-semibold">{t('chat.threads')}</h2>
        <button
          type="button"
          aria-label={t('chat.closePanel')}
          title={t('chat.closePanel')}
          onClick={() => {
            useChatStore.getState().close();
          }}
          className="grid size-8 place-items-center rounded-sm text-text-secondary hover:bg-neutral-100 hover:text-text-primary"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {threads.isPending && <p className="text-sm text-text-secondary">{t('chat.loading')}</p>}
        {threads.isError && (
          <p role="alert" className="text-sm">
            {t('chat.loadError')}
          </p>
        )}
        {threads.isSuccess && list.length === 0 && <p className="text-sm text-text-secondary">{t('chat.noThreads')}</p>}
        <ul className="flex flex-col gap-4">
          {list.map(({ channelId, root, unreadCount }) => {
            const channel = channels.data?.channels.find((c) => c.channelId === channelId);
            if (!channel) return null;
            const title = channelTitle(channel, myPersonId, peopleById, t);
            return (
              <li key={root.messageId} className="rounded-md border border-border-subtle p-2">
                <p className="mb-1 flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      useChatStore.getState().open(channelId);
                    }}
                    className="font-semibold hover:underline"
                  >
                    {title}
                  </button>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-terracotta-500 px-1.5 font-semibold text-white">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-white" />
                      {t('chat.newReplies', { count: unreadCount })}
                    </span>
                  )}
                </p>
                <MessageItem
                  message={root}
                  channel={channel}
                  title={title}
                  people={peopleById}
                  showAuthor
                  time={time.format(new Date(root.postedAt))}
                  expanded
                />
              </li>
            );
          })}
        </ul>
      </div>
    </MentionContext>
  );
}
