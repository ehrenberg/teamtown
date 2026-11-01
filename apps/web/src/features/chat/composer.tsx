import { useQueryClient } from '@tanstack/react-query';
import { MessageSchema, type ChannelSummary, type MessageContract } from '@teamtown/contracts';
import { Button } from '@teamtown/ui';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiSend } from '../../api/api-client.ts';
import { messagesKey, repliesKey, usePeople } from '../../api/queries.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { errorText, type Person } from './chat-shared.ts';
import { withPosted, type MessagePages } from './message-cache.ts';
import { insertMention, mentionedIds, mentionQueryAt, toDisplay, toTokens, type MentionPick } from './mentions.ts';

const MAX_DIRECT_MEMBERS = 8;
const MAX_SUGGESTIONS = 6;

export const channelPath = (channelId: string) => `/channels/${encodeURIComponent(channelId)}`;

/** Enter sends, Shift+Enter makes a new line. */
const isSend = (event: KeyboardEvent<HTMLTextAreaElement>) =>
  event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing;

/** Who may add people to the channel (ADR-0033, ADR-0034); `false` for a 1:1 DM. */
export function canAddPeople(channel: ChannelSummary, myPersonId: string | null): boolean {
  const isMember = myPersonId !== null && channel.members.includes(myPersonId);
  switch (channel.kind) {
    case 'public':
      return isMember;
    case 'private':
      return channel.creatorId !== null && channel.creatorId === myPersonId;
    case 'direct':
      return channel.group && isMember && channel.members.length < MAX_DIRECT_MEMBERS;
  }
}

/**
 * A textarea with `@` mentions (ADR-0034): typing `@` opens a list of people, channel members first; arrow keys and
 * Enter pick, Escape closes. It shows `@Name` and hands out the body with `<@personId>` tokens.
 */
export function MentionTextarea({
  label,
  placeholder,
  memberIds,
  initial = '',
  rows = 2,
  focusOnMount = false,
  onSubmit,
  onEscape,
}: {
  readonly label: string;
  readonly placeholder?: string;
  readonly memberIds: readonly string[];
  readonly initial?: string;
  readonly rows?: number;
  /** For the edit and reply boxes, which the person just chose to open. */
  readonly focusOnMount?: boolean;
  /** Gets the body with tokens; resolves `true` when it was sent, so the text is cleared. */
  readonly onSubmit: (body: string) => Promise<boolean>;
  readonly onEscape?: () => void;
}) {
  const { t } = useTranslation();
  const people = usePeople();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const listId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const everyone = useMemo(() => people.data?.people ?? [], [people.data]);
  const [initialDisplay] = useState(() =>
    toDisplay(initial, (personId) => everyone.find((person) => person.personId === personId)?.displayName),
  );
  const [text, setText] = useState(initialDisplay.text);
  const [picks, setPicks] = useState<MentionPick[]>(initialDisplay.picks);
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    if (!query) return [];
    const needle = query.query.toLocaleLowerCase();
    const members = new Set(memberIds);
    return everyone
      .filter((person) => person.personId !== myPersonId && person.displayName.toLocaleLowerCase().includes(needle))
      .sort(
        (a, b) =>
          Number(members.has(b.personId)) - Number(members.has(a.personId)) ||
          a.displayName.localeCompare(b.displayName),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [query, everyone, memberIds, myPersonId]);
  const open = suggestions.length > 0;

  const track = (value: string, caret: number) => {
    setText(value);
    setQuery(mentionQueryAt(value, caret));
    setActive(0);
  };

  const pick = (person: Person) => {
    const element = textarea.current;
    if (!query || !element) return;
    const next = insertMention(text, element.selectionStart, query.start, person.displayName);
    setText(next.text);
    setPicks((current) => [
      ...current.filter((p) => p.personId !== person.personId),
      { personId: person.personId, displayName: person.displayName },
    ]);
    setQuery(null);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(next.caret, next.caret);
    });
  };

  const submit = () => {
    if (!text.trim()) return;
    const sent = text;
    void onSubmit(toTokens(text, picks)).then((done) => {
      if (done && textarea.current?.value === sent) {
        setText('');
        setPicks([]);
      }
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((index) => (index + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const person = suggestions[active];
        if (person) {
          event.preventDefault();
          pick(person);
          return;
        }
      }
      if (event.key === 'Escape') {
        // Closes the list only, not the chat panel.
        event.preventDefault();
        setQuery(null);
        return;
      }
    }
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }
    if (isSend(event)) {
      event.preventDefault();
      submit();
    }
  };

  const optionId = (index: number) => `${listId}-option-${String(index)}`;
  return (
    <div className="relative">
      <textarea
        ref={textarea}
        value={text}
        rows={rows}
        maxLength={4000}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- only where the person just chose to write (edit, reply)
        autoFocus={focusOnMount}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        placeholder={placeholder}
        onChange={(event) => {
          track(event.target.value, event.target.selectionStart);
        }}
        onSelect={(event) => {
          setQuery(mentionQueryAt(event.currentTarget.value, event.currentTarget.selectionStart));
        }}
        onBlur={() => {
          setQuery(null);
        }}
        onKeyDown={onKeyDown}
        className="w-full resize-none rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-sm"
      />
      <div
        id={listId}
        role="listbox"
        aria-label={t('chat.mentionSomeone')}
        hidden={!open}
        className="absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded-md border border-border-subtle bg-surface-raised py-1 shadow-raised"
      >
        {suggestions.map((person, index) => (
          <div
            key={person.personId}
            id={optionId(index)}
            role="option"
            // The textarea keeps the focus and points at the active option (aria-activedescendant).
            tabIndex={-1}
            aria-selected={index === active}
            // Keeps the focus in the textarea; the pick happens on mouse down, before the blur closes the list.
            onMouseDown={(event) => {
              event.preventDefault();
              pick(person);
            }}
            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm aria-selected:bg-neutral-100"
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: person.avatarColor }}
            />
            <span className="flex-1 truncate">{person.displayName}</span>
            {!memberIds.includes(person.personId) && (
              <span className="text-xs text-text-secondary">{t('chat.notMember')}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Writes into a channel, or into a thread when `threadRootId` is set (with "Also send to the channel").
 * After sending it hints at mentioned people who aren't in the channel (ADR-0034).
 */
export function Composer({
  channel,
  title,
  threadRootId,
  focusOnMount = false,
}: {
  readonly channel: ChannelSummary;
  readonly title: string;
  readonly threadRootId?: string;
  readonly focusOnMount?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const people = usePeople();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const checkboxId = useId();
  const [alsoInChannel, setAlsoInChannel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outsiders, setOutsiders] = useState<string[]>([]);
  const path = channelPath(channel.channelId);
  const nameOf = (personId: string) =>
    people.data?.people.find((person) => person.personId === personId)?.displayName ?? t('chat.someone');

  const send = async (body: string): Promise<boolean> => {
    try {
      const message: MessageContract = await apiSend(
        'POST',
        `${path}/messages`,
        threadRootId ? { body, threadRootId, alsoInChannel } : { body },
        MessageSchema,
      );
      setError(null);
      setOutsiders(mentionedIds(body).filter((personId) => !channel.members.includes(personId)));
      if (threadRootId) {
        queryClient.setQueryData<MessagePages>(repliesKey(threadRootId), (data) => withPosted(data, message));
      }
      if (!threadRootId || alsoInChannel) {
        queryClient.setQueryData<MessagePages>(messagesKey(channel.channelId), (data) => withPosted(data, message));
      }
      return true;
    } catch (failure) {
      setError(errorText(failure, t));
      return false;
    }
  };

  const addOutsiders = () => {
    apiSend('POST', `${path}/members`, { personIds: outsiders }).then(
      () => {
        setOutsiders([]);
        void queryClient.invalidateQueries({ queryKey: ['channels'] });
      },
      (failure: unknown) => {
        setError(errorText(failure, t));
      },
    );
  };

  const target = channel.kind === 'direct' ? t('chat.theConversation') : title;
  return (
    <div className={threadRootId ? 'mt-1' : 'border-t border-border-subtle p-3'}>
      {error && (
        <p role="alert" className="mb-1.5 text-xs">
          {error}
        </p>
      )}
      {outsiders.length > 0 && (
        <div role="status" className="mb-1.5 flex items-center gap-2 rounded-md bg-ochre-100 px-2 py-1.5 text-xs">
          <span className="flex-1">
            {t('chat.notInChannel', { names: outsiders.map(nameOf).join(', '), count: outsiders.length })}
          </span>
          {canAddPeople(channel, myPersonId) && (
            <Button variant="secondary" onClick={addOutsiders}>
              {t('chat.addToChannel')}
            </Button>
          )}
          <button
            type="button"
            onClick={() => {
              setOutsiders([]);
            }}
            className="text-text-secondary underline"
          >
            {t('chat.dismiss')}
          </button>
        </div>
      )}
      <MentionTextarea
        label={threadRootId ? t('chat.replyLabel') : t('chat.composerLabel', { title })}
        placeholder={threadRootId ? t('chat.replyPlaceholder') : t('chat.composerPlaceholder', { title })}
        memberIds={channel.members}
        rows={threadRootId ? 1 : 2}
        focusOnMount={focusOnMount}
        onSubmit={send}
      />
      {threadRootId ? (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
          <input
            id={checkboxId}
            type="checkbox"
            checked={alsoInChannel}
            onChange={(event) => {
              setAlsoInChannel(event.target.checked);
            }}
          />
          <label htmlFor={checkboxId}>{t('chat.alsoSendTo', { target })}</label>
        </div>
      ) : (
        <p className="mt-1 text-xs text-text-secondary">{t('chat.composerHint')}</p>
      )}
    </div>
  );
}
