import type { ChannelSummary, MessageContract } from '@teamtown/contracts';
import { Button } from '@teamtown/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiDelete } from '../../api/api-client.ts';
import { usePinned } from '../../api/queries.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { canPin, errorText, messageExcerpt, type Person } from './chat-shared.ts';
import { channelPath } from './composer.tsx';

/** A conversation's pinned messages, newest first; selecting one shows it in the conversation (P-24). */
export function PinnedView({
  channel,
  people,
  onShow,
}: {
  readonly channel: ChannelSummary;
  readonly people: ReadonlyMap<string, Person>;
  readonly onShow: (message: MessageContract) => void;
}) {
  const { t, i18n } = useTranslation();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const pinned = usePinned(channel.channelId);
  const [error, setError] = useState<string | null>(null);
  const time = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' });
  const list = pinned.data?.messages ?? [];
  const mayUnpin = canPin(channel, myPersonId);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {pinned.isPending && <p className="text-sm text-text-secondary">{t('chat.loading')}</p>}
      {pinned.isError && (
        <p role="alert" className="text-sm">
          {t('chat.loadError')}
        </p>
      )}
      {pinned.isSuccess && list.length === 0 && <p className="text-sm text-text-secondary">{t('chat.noPinned')}</p>}
      {error && (
        <p role="alert" className="mb-2 text-xs">
          {error}
        </p>
      )}
      <ul aria-label={t('chat.pinned')} className="flex flex-col gap-2">
        {list.map((message) => {
          const name = people.get(message.authorId)?.displayName ?? t('chat.someone');
          const label = messageExcerpt(message.body) || message.attachments[0]?.fileName;
          return (
            <li key={message.messageId} className="rounded-md border border-border-subtle p-2">
              <button
                type="button"
                onClick={() => {
                  onShow(message);
                }}
                className="block w-full rounded-sm text-left hover:bg-neutral-50"
              >
                <span className="flex items-baseline gap-2 text-xs">
                  <span className="font-semibold">{name}</span>
                  <span className="text-text-secondary">{time.format(new Date(message.postedAt))}</span>
                </span>
                <span className="block text-sm break-words">{label}</span>
              </button>
              {mayUnpin && (
                <Button
                  variant="ghost"
                  className="mt-1"
                  onClick={() => {
                    const path = `${channelPath(channel.channelId)}/messages/${encodeURIComponent(message.messageId)}/pin`;
                    apiDelete(path).catch((failure: unknown) => {
                      setError(errorText(failure, t));
                    });
                  }}
                >
                  {t('chat.unpin')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
