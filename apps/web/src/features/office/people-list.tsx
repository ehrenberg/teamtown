import type { AvatarState, ConversationContract } from '@teamtown/contracts';
import { StatusDot } from '@teamtown/ui';
import { Lock, MicOff, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { conversationOf, useConversationStore } from '../../stores/conversation-store.ts';
import { useMediaStore } from '../../stores/media-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';

const byName = (a: AvatarState, b: AvatarState) => a.displayName.localeCompare(b.displayName);

/** Non-spatial view of the floor (principle "spatial is optional"). */
export function PeopleList({ onTalkTo }: { readonly onTalkTo: (personId: string) => void }) {
  const { t } = useTranslation();
  const avatars = usePresenceStore((state) => state.avatars);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const conversations = useConversationStore((state) => state.conversations);
  const mine = conversationOf(conversations, myPersonId);
  const people = Object.values(avatars).sort(byName);

  const groups = Object.values(conversations).sort((a, b) =>
    a === mine ? -1 : b === mine ? 1 : a.conversationId.localeCompare(b.conversationId),
  );
  const talking = new Set(groups.flatMap((c) => c.participants));
  const alone = people.filter((person) => !talking.has(person.personId));
  const membersOf = (conversation: ConversationContract) =>
    people.filter((person) => conversation.participants.includes(person.personId));

  const row = (person: AvatarState) => (
    <PersonRow
      key={person.personId}
      person={person}
      isMe={person.personId === myPersonId}
      canTalkTo={person.personId !== myPersonId && !mine?.participants.includes(person.personId)}
      onTalkTo={onTalkTo}
    />
  );

  return (
    <section aria-labelledby="people-heading" className="flex flex-col gap-2">
      <h2
        id="people-heading"
        className="font-display text-xs font-semibold tracking-wide text-text-secondary uppercase"
      >
        {t('office.people')}
      </h2>
      <p className="text-xs text-text-secondary">{t('office.peopleCount', { count: people.length })}</p>

      {groups.map((conversation) => (
        <div
          key={conversation.conversationId}
          role="group"
          aria-label={t(conversation.locked ? 'conversation.groupLocked' : 'conversation.group')}
          className="rounded-md border border-border-subtle bg-surface-raised/60 p-1.5"
        >
          <p className="flex items-center gap-1.5 px-1.5 pb-1 text-xs font-medium text-text-secondary">
            {conversation.locked && <Lock aria-hidden="true" className="size-3.5" />}
            {t(conversation === mine ? 'conversation.yours' : 'conversation.title')}
          </p>
          <ul className="flex flex-col gap-1">{membersOf(conversation).map(row)}</ul>
        </div>
      ))}

      {alone.length > 0 && <ul className="flex flex-col gap-1">{alone.map(row)}</ul>}
    </section>
  );
}

function PersonRow({
  person,
  isMe,
  canTalkTo,
  onTalkTo,
}: {
  readonly person: AvatarState;
  readonly isMe: boolean;
  readonly canTalkTo: boolean;
  readonly onTalkTo: (personId: string) => void;
}) {
  const { t } = useTranslation();
  const speaking = useMediaStore((state) => state.speaking.includes(person.personId));
  const muted = useMediaStore((state) => state.muted.includes(person.personId));

  return (
    <li className="group flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-neutral-200">
      <span
        aria-hidden="true"
        className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${
          speaking ? 'ring-2 ring-status-available ring-offset-1 ring-offset-surface-sunken' : ''
        }`}
        style={{ backgroundColor: person.avatarColor }}
      >
        {person.displayName.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate">
        {person.displayName}
        {isMe && <span className="text-text-secondary"> ({t('office.you')})</span>}
        {speaking && <span className="sr-only"> ({t('conversation.speaking')})</span>}
      </span>
      {speaking && <Volume2 aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />}
      {muted && (
        <MicOff role="img" aria-label={t('conversation.muted')} className="size-3.5 shrink-0 text-text-secondary" />
      )}
      {canTalkTo && (
        <button
          type="button"
          onClick={() => {
            onTalkTo(person.personId);
          }}
          aria-label={t('conversation.talkToPerson', { name: person.displayName })}
          className="shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-medium text-text-link hover:bg-neutral-100"
        >
          {t('conversation.talkTo')}
        </button>
      )}
      <StatusDot status="available" label={t('status.available')} />
    </li>
  );
}
