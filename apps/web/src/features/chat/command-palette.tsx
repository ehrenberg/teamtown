import * as Dialog from '@radix-ui/react-dialog';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChannelSummarySchema,
  MIN_SEARCH_LENGTH,
  SearchMessagesResponse,
  type ChannelSummary,
  type SearchResult,
} from '@teamtown/contracts';
import { Button } from '@teamtown/ui';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet, apiSend } from '../../api/api-client.ts';
import { useBrowseChannels, useChannels, useMyAccess, usePeople } from '../../api/queries.ts';
import { useAdminStore } from '../../stores/admin-store.ts';
import { useChatStore } from '../../stores/chat-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { channelTitle, messageExcerpt, OVERLAY } from './chat-shared.ts';
import { pickChannels, pickPeople } from './palette-entries.ts';

const SEARCH_DELAY_MS = 250;
const SNIPPET_LENGTH = 120;

const isMac = navigator.platform.startsWith('Mac');

interface Entry {
  readonly id: string;
  readonly section: string;
  readonly content: ReactNode;
  /** Keeps the palette open, for "Show more". */
  readonly stayOpen?: boolean;
  readonly run: () => void;
}

/** Search stays out of the cache once the palette closes: nothing remembers what was looked for. */
function useMessageSearch(query: string, channelId: string | null) {
  return useInfiniteQuery({
    queryKey: ['search', query, channelId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ q: query, offset: String(pageParam) });
      if (channelId) params.set('channelId', channelId);
      return apiGet(`/search/messages?${params.toString()}`, SearchMessagesResponse);
    },
    initialPageParam: 0,
    getNextPageParam: (page, pages) =>
      page.hasMore ? pages.reduce((sum, { results }) => sum + results.length, 0) : undefined,
    enabled: query.length >= MIN_SEARCH_LENGTH,
    gcTime: 0,
  });
}

function MessageEntry({ result, title, author }: { result: SearchResult; title: string; author: string }) {
  const { i18n } = useTranslation();
  const posted = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' }).format(
    new Date(result.message.postedAt),
  );
  const text = messageExcerpt(result.snippet, SNIPPET_LENGTH) || result.message.attachments[0]?.fileName;
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-xs text-text-secondary">
        {title} · {author} · {posted}
      </span>
      <span className="block truncate">{text}</span>
    </span>
  );
}

/**
 * One field for going to, and finding, anything (P-29): a combobox, with the focus staying in the field and the arrow
 * keys moving through a single list of entries. Channels and people match right away, in the client; messages come
 * from the server a moment after typing stops.
 */
function PaletteBody({ onRun }: { readonly onRun: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const openChannelId = useChatStore((state) => state.openChannelId);
  const channels = useChannels();
  const browse = useBrowseChannels(true);
  const people = usePeople();
  const access = useMyAccess();
  const peopleById = useMemo(
    () => new Map(people.data?.people.map((person) => [person.personId, person])),
    [people.data],
  );
  const listId = useId();
  const checkboxId = useId();
  const [query, setQuery] = useState('');
  const [settled, setSettled] = useState('');
  const [onlyHere, setOnlyHere] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(query.trim());
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const openChannel = channels.data?.channels.find((channel) => channel.channelId === openChannelId);
  const titleOf = (channel: Pick<ChannelSummary, 'kind' | 'name' | 'members'>) =>
    channelTitle(channel, myPersonId, peopleById, t);
  const search = useMessageSearch(settled, onlyHere ? openChannelId : null);
  const results = search.data?.pages.flatMap((page) => page.results) ?? [];
  const searching = query.trim().length >= MIN_SEARCH_LENGTH;

  const openDirectMessage = (personId: string) => {
    void apiSend('POST', '/direct-messages', { personIds: [personId] }, ChannelSummarySchema).then((channel) => {
      void queryClient.invalidateQueries({ queryKey: ['channels'] });
      useChatStore.getState().open(channel.channelId);
    });
  };

  const goTo = (id: string, label: string, run: () => void, allowed = true): Entry[] =>
    allowed && label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      ? [{ id, section: t('palette.goTo'), content: label, run }]
      : [];

  const entries: Entry[] = [
    ...goTo('threads', t('palette.goToThreads'), () => {
      useChatStore.getState().openThreads();
    }),
    ...goTo(
      'administration',
      t('admin.title'),
      () => {
        useAdminStore.getState().setOpen(true);
      },
      access.data?.canManageRoles === true,
    ),
    ...pickChannels(query, channels.data?.channels ?? [], browse.data?.channels ?? [], titleOf).map((entry) => ({
      id: `channel-${entry.channelId}`,
      section: t('palette.channels'),
      content: (
        <>
          <span className="flex-1 truncate">{entry.label}</span>
          {entry.kind !== 'channel' && (
            <span className="text-xs text-text-secondary">
              {t(entry.kind === 'room' ? 'chat.roomWall' : 'palette.notJoined')}
            </span>
          )}
        </>
      ),
      run: () => {
        useChatStore.getState().open(entry.channelId);
      },
    })),
    ...pickPeople(query, people.data?.people ?? [], myPersonId).map((person) => ({
      id: `person-${person.personId}`,
      section: t('palette.people'),
      content: <span className="flex-1 truncate">{person.displayName}</span>,
      run: () => {
        openDirectMessage(person.personId);
      },
    })),
    ...results.map((result) => ({
      id: `message-${result.message.messageId}`,
      section: t('palette.messages'),
      content: (
        <MessageEntry
          result={result}
          title={titleOf(result.channel)}
          author={peopleById.get(result.message.authorId)?.displayName ?? t('chat.someone')}
        />
      ),
      run: () => {
        const { channelId, messageId, threadRootId } = result.message;
        useChatStore.getState().show({ channelId, messageId, threadRootId });
      },
    })),
    ...(search.hasNextPage
      ? [
          {
            id: 'more',
            section: t('palette.messages'),
            content: t('palette.showMore'),
            stayOpen: true,
            run: () => {
              void search.fetchNextPage();
            },
          },
        ]
      : []),
  ];
  const current = Math.min(active, entries.length - 1);
  const optionId = (entry: Entry) => `${listId}-${entry.id}`;
  const activeEntry = entries[current];
  const activeId = activeEntry ? optionId(activeEntry) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const run = (entry: Entry) => {
    entry.run();
    if (!entry.stayOpen) onRun();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && entries.length > 0) {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current + step + entries.length) % entries.length);
    }
    if (event.key === 'Enter' && activeEntry) {
      event.preventDefault();
      run(activeEntry);
    }
  };

  const sections = [...new Set(entries.map((entry) => entry.section))];
  const messagesState = !searching
    ? null
    : search.isError
      ? t('palette.searchError')
      : query.trim() !== settled || search.isPending
        ? t('palette.searching')
        : results.length === 0
          ? t('palette.noMessages', { query: settled })
          : t('palette.resultCount', { count: results.length });

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <Search aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the person just opened the palette to type here
          autoFocus
          role="combobox"
          aria-label={t('palette.label')}
          aria-autocomplete="list"
          aria-expanded={entries.length > 0}
          aria-controls={listId}
          aria-activedescendant={activeId}
          placeholder={t('palette.label')}
          value={query}
          maxLength={200}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {openChannel && (
        <div className="flex items-center gap-1.5 border-b border-border-subtle px-4 py-2 text-xs text-text-secondary">
          <input
            id={checkboxId}
            type="checkbox"
            checked={onlyHere}
            onChange={(event) => {
              setOnlyHere(event.target.checked);
              setActive(0);
            }}
          />
          <label htmlFor={checkboxId}>{t('palette.onlyIn', { title: titleOf(openChannel) })}</label>
        </div>
      )}
      <div id={listId} role="listbox" aria-label={t('palette.results')} className="min-h-0 overflow-y-auto p-2">
        {sections.map((section) => (
          <div key={section} role="group" aria-label={section}>
            <p aria-hidden="true" className="px-2 pt-2 pb-1 text-xs font-semibold text-text-secondary uppercase">
              {section}
            </p>
            {entries
              .filter((entry) => entry.section === section)
              .map((entry) => (
                <div
                  key={entry.id}
                  id={optionId(entry)}
                  role="option"
                  // The field keeps the focus and points at the active option (aria-activedescendant).
                  tabIndex={-1}
                  aria-selected={entry === activeEntry}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    run(entry);
                  }}
                  onMouseEnter={() => {
                    setActive(entries.indexOf(entry));
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-neutral-100"
                >
                  {entry.content}
                </div>
              ))}
          </div>
        ))}
      </div>
      <p role="status" className="border-t border-border-subtle px-4 py-2 text-xs text-text-secondary empty:hidden">
        {messagesState}
      </p>
    </div>
  );
}

/** The "Search" button of the top bar and `Ctrl/⌘+K`, which work from anywhere, also while typing. */
export function CommandPalette() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  /** Where the focus goes back to, unless an entry took the person somewhere else. */
  const returnTo = useRef<HTMLElement | null>(null);
  const ran = useRef(false);

  const openPalette = useCallback(() => {
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ran.current = false;
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) {
        return;
      }
      event.preventDefault();
      if (open) setOpen(false);
      else openPalette();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, openPalette]);

  return (
    <>
      <Button variant="ghost" onClick={openPalette}>
        <Search aria-hidden="true" className="size-4" />
        {t('palette.open')}
        <kbd className="rounded-sm border border-border-subtle px-1 text-xs text-text-secondary">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </Button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={OVERLAY} />
          <Dialog.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (!ran.current) returnTo.current?.focus();
            }}
            className="fixed top-[12vh] left-1/2 flex max-h-[70vh] w-[min(36rem,92vw)] -translate-x-1/2 flex-col overflow-hidden rounded-md bg-surface-raised shadow-raised"
          >
            <Dialog.Title className="sr-only">{t('palette.title')}</Dialog.Title>
            <PaletteBody
              onRun={() => {
                ran.current = true;
                setOpen(false);
              }}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
