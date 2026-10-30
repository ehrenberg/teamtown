import * as Dialog from '@radix-ui/react-dialog';
import type { DirectCallContract } from '@teamtown/contracts';
import { Button } from '@teamtown/ui';
import { Phone, PhoneOff, UserPlus, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFloors } from '../../api/queries.ts';
import { playRing } from '../../media/ring-tone.ts';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import type { CommandResult } from '../../realtime/realtime-client.ts';
import { roleIn, useCallStore } from '../../stores/call-store.ts';
import { useMediaStore } from '../../stores/media-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';

const RING_INTERVAL_MS = 2_000;
const MAX_CALL_SIZE = 8;

const OVERLAY = 'fixed inset-0 bg-espresso/40';
const CONTENT =
  'fixed top-1/2 left-1/2 flex w-[min(28rem,90vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-md bg-surface-raised p-5 shadow-raised';

/** Names of people anywhere: from this floor's avatars, otherwise from the last list of everyone online. */
export function useNameOf(): (personId: string) => string {
  const avatars = usePresenceStore((state) => state.avatars);
  const online = useCallStore((state) => state.online);
  return (personId) =>
    avatars[personId]?.displayName ?? online.find((person) => person.personId === personId)?.displayName ?? '';
}

/** Calls of other people on other floors need names: ask for everyone online when someone unknown shows up. */
function useResolveNames(call: DirectCallContract | null): void {
  const realtime = useRealtime();
  const nameOf = useNameOf();
  const ids = call ? [...call.participants, ...call.invitations.map((i) => i.personId)] : [];
  const unknown = ids.some((id) => nameOf(id) === '');
  useEffect(() => {
    if (unknown) void realtime.listOnlinePeople();
  }, [unknown, realtime]);
}

/** Turns a refused StartCall/InviteToCall into a notice the caller can read. */
function noticeFor(personId: string, result: CommandResult): void {
  if (result.ok) return;
  const { notify } = useCallStore.getState();
  notify({ personId, outcome: result.code === 'busy' ? 'busy' : 'cancelled' });
}

/** The list of everyone online, to call someone or (while in a call) to add them. */
export function CallSomeoneDialog({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const floors = useFloors();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const online = useCallStore((state) => state.online);
  const call = useCallStore((state) => state.call);
  const [query, setQuery] = useState('');
  const inCall = roleIn(call, myPersonId) === 'participant' ? call : null;
  const inCallAlready = new Set(inCall ? [...inCall.participants, ...inCall.invitations.map((i) => i.personId)] : []);
  const full = inCall ? inCallAlready.size >= MAX_CALL_SIZE : false;

  useEffect(() => {
    if (open) void realtime.listOnlinePeople();
  }, [open, realtime]);

  const close = (next: boolean) => {
    if (!next) setQuery('');
    onOpenChange(next);
  };

  const floorName = (floorId: string) => floors.data?.floors.find((floor) => floor.floorId === floorId)?.name ?? '';
  const people = online
    .filter((person) => person.personId !== myPersonId && !inCallAlready.has(person.personId))
    .filter((person) => person.displayName.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const ring = (personId: string) => {
    const result = inCall ? realtime.inviteToCall(inCall.callId, personId) : realtime.startCall(personId);
    void result.then((outcome) => {
      noticeFor(personId, outcome);
    });
    close(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={CONTENT}>
          <Dialog.Title className="font-display text-lg font-semibold">
            {t(inCall ? 'call.addSomeone' : 'call.callSomeone')}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-text-secondary">
            {full ? t('call.full') : t('call.dialogIntro')}
          </Dialog.Description>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            aria-label={t('call.search')}
            placeholder={t('call.search')}
            className="min-h-6 rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-sm"
          />
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {people.map((person) => (
              <li key={person.personId} className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm">
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: person.avatarColor }}
                >
                  {person.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {person.displayName}
                  <span className="text-text-secondary"> · {floorName(person.floorId)}</span>
                </span>
                <Button
                  variant="secondary"
                  disabled={full}
                  aria-label={t(inCall ? 'call.addPerson' : 'call.callPerson', { name: person.displayName })}
                  onClick={() => {
                    ring(person.personId);
                  }}
                >
                  {t(inCall ? 'call.add' : 'call.call')}
                </Button>
              </li>
            ))}
          </ul>
          {people.length === 0 && (
            <p className="text-sm text-text-secondary">
              {query.trim() ? t('call.noMatch', { query: query.trim() }) : t('call.noOne')}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Ringing: a dialog with accept and decline, and a soft ring tone as long as it rings. */
export function IncomingCallDialog() {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const call = useCallStore((state) => state.call);
  const nameOf = useNameOf();
  const ringing = roleIn(call, myPersonId) === 'ringing' ? call : null;
  useResolveNames(call);

  useEffect(() => {
    if (!ringing) return;
    playRing();
    const timer = setInterval(playRing, RING_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [ringing]);

  if (!ringing) return null;
  const invitation = ringing.invitations.find((i) => i.personId === myPersonId);
  const caller = nameOf(invitation?.invitedBy ?? '');
  const others = ringing.participants.filter((id) => id !== invitation?.invitedBy).map(nameOf);
  const answer = (accept: boolean) => void realtime.answerCall(ringing.callId, accept);

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) answer(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={CONTENT}>
          <Dialog.Title className="flex items-center gap-2 font-display text-lg font-semibold">
            <Phone aria-hidden="true" className="size-5 motion-safe:animate-knock" />
            {t('call.incoming')}
          </Dialog.Title>
          <Dialog.Description className="text-sm">
            {others.length > 0
              ? t('call.incomingGroup', { name: caller, others: others.join(', ') })
              : t('call.incomingFrom', { name: caller })}
          </Dialog.Description>
          <div className="flex gap-2">
            {/* Radix moves the focus to the first button: accepting is the likely answer. */}
            <Button
              onClick={() => {
                answer(true);
              }}
            >
              <Phone aria-hidden="true" className="size-4" />
              {t('call.accept')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                answer(false);
              }}
            >
              <PhoneOff aria-hidden="true" className="size-4" />
              {t('call.decline')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** In the sidebar while in a call: who is in it, who is being rung, add someone, hang up. */
export function CallPanel({ onAddSomeone }: { readonly onAddSomeone: () => void }) {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const call = useCallStore((state) => state.call);
  const notice = useCallStore((state) => state.lastNotice);
  const nameOf = useNameOf();
  const speaking = useMediaStore((state) => state.speaking);
  useResolveNames(call);

  const mine = roleIn(call, myPersonId) === 'participant' ? call : null;
  const noticeText = notice ? t(`call.outcome_${notice.outcome}`, { name: nameOf(notice.personId) }) : '';
  if (!mine) {
    return notice && notice.outcome !== 'accepted' ? (
      <p role="status" className="mb-4 text-xs text-text-secondary">
        {noticeText}
      </p>
    ) : null;
  }

  const others = mine.participants.filter((id) => id !== myPersonId);
  const ringingOnly = others.length === 0;
  return (
    <section
      aria-labelledby="call-heading"
      className="mb-4 flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-raised p-2.5"
    >
      <h2 id="call-heading" className="flex items-center gap-1.5 text-sm font-semibold">
        <Phone aria-hidden="true" className="size-4" />
        {ringingOnly
          ? t('call.calling', { names: mine.invitations.map((i) => nameOf(i.personId)).join(', ') })
          : t('call.yourCall')}
      </h2>
      <ul className="flex flex-col gap-0.5 text-sm">
        {others.map((id) => (
          <li key={id} className="flex items-center gap-1.5">
            {nameOf(id)}
            {speaking.includes(id) && (
              <>
                <Volume2 aria-hidden="true" className="size-3.5 text-text-secondary" />
                <span className="sr-only"> ({t('conversation.speaking')})</span>
              </>
            )}
          </li>
        ))}
        {!ringingOnly &&
          mine.invitations.map((invitation) => (
            <li key={invitation.personId} className="text-text-secondary">
              {nameOf(invitation.personId)} ({t('call.ringing')})
            </li>
          ))}
      </ul>
      {notice && (
        <p role="status" className="text-xs text-text-secondary">
          {noticeText}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {!ringingOnly && (
          <Button variant="secondary" onClick={onAddSomeone}>
            <UserPlus aria-hidden="true" className="size-4" />
            {t('call.addSomeone')}
          </Button>
        )}
        <Button variant="secondary" onClick={() => void realtime.leaveCall(mine.callId)}>
          <PhoneOff aria-hidden="true" className="size-4" />
          {t('call.hangUp')}
        </Button>
      </div>
    </section>
  );
}

/** Polite announcements when one's call starts or ends. */
export function CallAnnouncer() {
  const { t } = useTranslation();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const call = useCallStore((state) => state.call);
  const nameOf = useNameOf();
  const [message, setMessage] = useState('');
  const mine = roleIn(call, myPersonId) === 'participant' ? call : null;
  const others = mine ? mine.participants.filter((id) => id !== myPersonId) : [];
  const key = others.join();
  const [previous, setPrevious] = useState('');

  if (key !== previous) {
    setPrevious(key);
    if (key) setMessage(t('call.inCallWith', { names: others.map(nameOf).join(', ') }));
    else if (previous) setMessage(t('call.ended'));
  }

  return (
    <p aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
