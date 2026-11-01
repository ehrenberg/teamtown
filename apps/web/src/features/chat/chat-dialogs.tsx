import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { ChannelSummarySchema, type ChannelSummary } from '@teamtown/contracts';
import { Button } from '@teamtown/ui';
import { Check, Lock } from 'lucide-react';
import { useId, useState, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiSend } from '../../api/api-client.ts';
import { useBrowseChannels, usePeople } from '../../api/queries.ts';
import { useChatStore } from '../../stores/chat-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { CONTENT, errorText, INPUT, OVERLAY } from './chat-shared.ts';

function ChatDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={CONTENT}>
          <Dialog.Title className="font-display text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-text-secondary">{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Puts a channel the person just created, joined or opened into the list and opens it. */
function useOpenChannel() {
  const queryClient = useQueryClient();
  return (channel: ChannelSummary) => {
    void queryClient.invalidateQueries({ queryKey: ['channels'] });
    useChatStore.getState().open(channel.channelId);
  };
}

export function NewChannelDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const openChannel = useOpenChannel();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'public' | 'private'>('public');
  const [error, setError] = useState<string | null>(null);
  const kindId = useId();

  const close = (next: boolean) => {
    if (!next) {
      setName('');
      setKind('public');
      setError(null);
    }
    onOpenChange(next);
  };
  const create = (event: SyntheticEvent) => {
    event.preventDefault();
    apiSend('POST', '/channels', { kind, name }, ChannelSummarySchema).then(
      (channel) => {
        openChannel(channel);
        close(false);
      },
      (failure: unknown) => {
        setError(errorText(failure, t));
      },
    );
  };

  return (
    <ChatDialog open={open} onOpenChange={close} title={t('chat.newChannel')} description={t('chat.newChannelIntro')}>
      <form onSubmit={create} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('chat.channelName')}
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            maxLength={40}
            required
            placeholder={t('chat.channelNamePlaceholder')}
            className={INPUT}
          />
        </label>
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-1 font-medium">{t('chat.visibility')}</legend>
          {(['public', 'private'] as const).map((option) => (
            <div key={option} className="flex items-start gap-2">
              <input
                id={`${kindId}-${option}`}
                type="radio"
                name="channel-kind"
                checked={kind === option}
                onChange={() => {
                  setKind(option);
                }}
                aria-describedby={`${kindId}-${option}-hint`}
                className="mt-1"
              />
              <label htmlFor={`${kindId}-${option}`}>
                <span className="font-medium">{t(`chat.kind_${option}`)}</span>
                <span id={`${kindId}-${option}-hint`} className="block text-xs text-text-secondary">
                  {t(`chat.kindHint_${option}`)}
                </span>
              </label>
            </div>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit">{t('chat.create')}</Button>
          <Dialog.Close asChild>
            <Button variant="secondary">{t('chat.cancel')}</Button>
          </Dialog.Close>
        </div>
      </form>
    </ChatDialog>
  );
}

export function BrowseChannelsDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const channels = useBrowseChannels(open);
  const openChannel = useOpenChannel();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const [error, setError] = useState<string | null>(null);

  const join = (channelId: string) => {
    apiSend(
      'POST',
      `/channels/${encodeURIComponent(channelId)}/members`,
      { personIds: [myPersonId] },
      ChannelSummarySchema,
    ).then(
      (channel) => {
        openChannel(channel);
        onOpenChange(false);
      },
      (failure: unknown) => {
        setError(errorText(failure, t));
      },
    );
  };
  const sorted = [...(channels.data?.channels ?? [])].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name),
  );

  return (
    <ChatDialog
      open={open}
      onOpenChange={(next) => {
        setError(null);
        onOpenChange(next);
      }}
      title={t('chat.browse')}
      description={t('chat.browseIntro')}
    >
      {channels.isError && (
        <p role="alert" className="text-sm">
          {t('chat.loadError')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {sorted.map((channel) => (
          <li key={channel.channelId} className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm">
            <span className={`min-w-0 flex-1 truncate ${channel.archived ? 'text-text-secondary' : ''}`}>
              #{channel.name}
              <span className="block text-xs text-text-secondary">
                {t('chat.memberCount', { count: channel.memberCount })}
                {channel.archived && ` · ${t('chat.archived')}`}
              </span>
            </span>
            {channel.isMember ? (
              <Button
                variant="secondary"
                onClick={() => {
                  useChatStore.getState().open(channel.channelId);
                  onOpenChange(false);
                }}
              >
                {t('chat.open')}
              </Button>
            ) : (
              !channel.archived && (
                <Button
                  variant="secondary"
                  aria-label={t('chat.joinChannel', { name: channel.name })}
                  onClick={() => {
                    join(channel.channelId);
                  }}
                >
                  {t('chat.join')}
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
      <Dialog.Close asChild>
        <Button variant="secondary" className="self-start">
          {t('chat.close')}
        </Button>
      </Dialog.Close>
    </ChatDialog>
  );
}

/**
 * Picks people: for a new DM, to invite into a private channel or to add to a group DM.
 * `max` counts the people one may still pick.
 */
export function PeoplePickerDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  exclude,
  initial = [],
  max,
  onConfirm,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly exclude: readonly string[];
  readonly initial?: readonly string[];
  readonly max: number;
  readonly onConfirm: (personIds: string[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const people = usePeople(open);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([...initial]);
  const [error, setError] = useState<string | null>(null);
  const full = picked.length >= max;

  const close = (next: boolean) => {
    if (!next) {
      setQuery('');
      setPicked([...initial]);
      setError(null);
    }
    onOpenChange(next);
  };
  const toggle = (personId: string) => {
    setPicked((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
    );
  };
  const confirm = (event: SyntheticEvent) => {
    event.preventDefault();
    onConfirm(picked).then(
      () => {
        close(false);
      },
      (failure: unknown) => {
        setError(errorText(failure, t));
      },
    );
  };
  const candidates = (people.data?.people ?? [])
    .filter((person) => !exclude.includes(person.personId))
    .filter((person) => person.displayName.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <ChatDialog
      open={open}
      onOpenChange={close}
      title={title}
      description={full ? t('chat.pickedAll', { count: max }) : description}
    >
      <form onSubmit={confirm} className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          aria-label={t('chat.searchPeople')}
          placeholder={t('chat.searchPeople')}
          className={INPUT}
        />
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {candidates.map((person) => {
            const selected = picked.includes(person.personId);
            return (
              <li key={person.personId}>
                <label
                  className={`flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-neutral-100 ${
                    !selected && full ? 'opacity-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!selected && full}
                    onChange={() => {
                      toggle(person.personId);
                    }}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: person.avatarColor }}
                  >
                    {selected ? <Check className="size-4" /> : person.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{person.displayName}</span>
                  {selected && <span className="text-xs text-text-secondary">{t('chat.picked')}</span>}
                </label>
              </li>
            );
          })}
        </ul>
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={picked.length === 0}>
            {confirmLabel}
          </Button>
          <Dialog.Close asChild>
            <Button variant="secondary">{t('chat.cancel')}</Button>
          </Dialog.Close>
        </div>
      </form>
    </ChatDialog>
  );
}

/** A new DM with up to seven others (ADR-0033); it opens the existing one if there is one. */
export function NewMessageDialog({
  open,
  onOpenChange,
  initial = [],
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly initial?: readonly string[];
}) {
  const { t } = useTranslation();
  const openChannel = useOpenChannel();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  return (
    <PeoplePickerDialog
      key={initial.join(':')}
      open={open}
      onOpenChange={onOpenChange}
      title={t('chat.newMessage')}
      description={t('chat.newMessageIntro')}
      confirmLabel={t('chat.openMessage')}
      exclude={myPersonId ? [myPersonId] : []}
      initial={initial}
      max={7}
      onConfirm={async (personIds) => {
        openChannel(await apiSend('POST', '/direct-messages', { personIds }, ChannelSummarySchema));
      }}
    />
  );
}

export function RenameChannelDialog({
  channel,
  open,
  onOpenChange,
}: {
  readonly channel: ChannelSummary;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(channel.name ?? '');
  const [error, setError] = useState<string | null>(null);

  const rename = (event: SyntheticEvent) => {
    event.preventDefault();
    apiSend('PATCH', `/channels/${encodeURIComponent(channel.channelId)}`, { name }, ChannelSummarySchema).then(
      () => {
        void queryClient.invalidateQueries({ queryKey: ['channels'] });
        onOpenChange(false);
      },
      (failure: unknown) => {
        setError(errorText(failure, t));
      },
    );
  };

  return (
    <ChatDialog
      open={open}
      onOpenChange={(next) => {
        setError(null);
        setName(channel.name ?? '');
        onOpenChange(next);
      }}
      title={t('chat.rename')}
      description={t('chat.renameIntro')}
    >
      <form onSubmit={rename} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('chat.channelName')}
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            maxLength={40}
            required
            className={INPUT}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit">{t('chat.save')}</Button>
          <Dialog.Close asChild>
            <Button variant="secondary">{t('chat.cancel')}</Button>
          </Dialog.Close>
        </div>
      </form>
    </ChatDialog>
  );
}

/** The lock that marks private channels, with text for screen readers. */
export function PrivateMark() {
  const { t } = useTranslation();
  return <Lock role="img" aria-label={t('chat.kind_private')} className="size-3.5 shrink-0 text-text-secondary" />;
}
