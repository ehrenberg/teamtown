import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@teamtown/ui';
import { CircleDot, NotebookText, Trash2 } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiDelete } from '../../api/api-client.ts';
import { useFloors, useMyMeetingLogs } from '../../api/queries.ts';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { roomCallOf, useRoomStore } from '../../stores/room-store.ts';
import type { RoomInfo } from './rooms.ts';

const OVERLAY = 'fixed inset-0 bg-espresso/40';
const CONTENT =
  'fixed top-1/2 left-1/2 flex w-[min(30rem,90vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-md bg-surface-raised p-5 shadow-raised';

/**
 * In the header while in a room call: start a logged meeting, or see that it is logged (and end it as host).
 * Nothing is logged unless someone starts it here (ADR-0026).
 */
export function MeetingLogControls({ room }: { readonly room: RoomInfo | null }) {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const inRoomCall = useRoomStore((state) => room !== null && roomCallOf(state.roomCalls, myPersonId) === room.roomId);
  const logged = useRoomStore((state) => room !== null && state.loggedRooms.includes(room.roomId));
  const mine = useRoomStore((state) => (state.myMeetingLog?.roomId === room?.roomId ? state.myMeetingLog : null));
  const [starting, setStarting] = useState(false);
  if (!room) return null;

  if (logged) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-terracotta-100 px-2 py-1 text-xs font-semibold text-terracotta-900">
          <CircleDot aria-hidden="true" className="size-3.5" />
          {mine ? t('log.badge', { title: mine.title }) : t('log.badgeUnknown')}
        </span>
        {mine?.hostId === myPersonId && (
          <Button variant="ghost" onClick={() => void realtime.endMeetingLog()}>
            {t('log.end')}
          </Button>
        )}
      </div>
    );
  }
  if (!inRoomCall) return null;
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setStarting(true);
        }}
      >
        <CircleDot aria-hidden="true" className="size-4" />
        {t('log.start')}
      </Button>
      <StartMeetingLogDialog room={room} open={starting} onOpenChange={setStarting} />
    </>
  );
}

function StartMeetingLogDialog({
  room,
  open,
  onOpenChange,
}: {
  readonly room: RoomInfo;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const [title, setTitle] = useState<string | null>(null);
  const value = title ?? t('log.defaultTitle', { room: room.name });

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!value.trim()) return;
    void realtime.startMeetingLog(value.trim());
    setTitle(null);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={CONTENT}>
          <Dialog.Title className="font-display text-lg font-semibold">{t('log.startTitle')}</Dialog.Title>
          <Dialog.Description className="text-sm text-text-secondary">{t('log.startIntro')}</Dialog.Description>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('log.title')}
              <input
                value={value}
                maxLength={120}
                required
                onChange={(event) => {
                  setTitle(event.target.value);
                }}
                className="min-h-6 rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 font-normal"
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit">{t('log.startConfirm')}</Button>
              <Dialog.Close asChild>
                <Button variant="secondary">{t('log.cancel')}</Button>
              </Dialog.Close>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Asks for consent before one is logged (ADR-0027): from inside the room when logging starts, or before walking
 * in. Nothing about the person is stored unless they choose "Join".
 */
export function MeetingLogConsentDialog({ roomNames }: { readonly roomNames: ReadonlyMap<string, string> }) {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const request = useRoomStore((state) => state.consentRequest);
  if (!request) return null;

  const answer = (join: boolean) => {
    void realtime.answerMeetingLog(request.roomId, join);
    useRoomStore.getState().requestConsent(null);
  };
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
            <CircleDot aria-hidden="true" className="size-5" />
            {t('log.consentTitle')}
          </Dialog.Title>
          <Dialog.Description className="text-sm">
            {request.title
              ? t('log.consentWithTitle', { title: request.title })
              : t('log.consentWithoutTitle', { room: roomNames.get(request.roomId) ?? '' })}
          </Dialog.Description>
          <div className="flex gap-2">
            {/* Radix moves the focus to the first button. */}
            <Button
              onClick={() => {
                answer(true);
              }}
            >
              {t('log.join')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                answer(false);
              }}
            >
              {t('log.dontJoin')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** "My meetings": the logs one took part in; the host may delete them early (ADR-0027). */
export function MyMeetingsButton({ roomNames }: { readonly roomNames: ReadonlyMap<string, string> }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const logs = useMyMeetingLogs(open);
  const floors = useFloors();
  const queryClient = useQueryClient();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const time = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  const floorName = (floorId: string) => floors.data?.floors.find((floor) => floor.floorId === floorId)?.name ?? '';

  const remove = (meetingId: string) => {
    void apiDelete(`/meeting-logs/${encodeURIComponent(meetingId)}`).then(() =>
      queryClient.invalidateQueries({ queryKey: ['meeting-logs'] }),
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost">
          <NotebookText aria-hidden="true" className="size-4" />
          {t('log.myMeetings')}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY} />
        <Dialog.Content className={CONTENT}>
          <Dialog.Title className="font-display text-lg font-semibold">{t('log.myMeetings')}</Dialog.Title>
          <Dialog.Description className="text-sm text-text-secondary">{t('log.myMeetingsIntro')}</Dialog.Description>
          {logs.isPending && <p className="text-sm text-text-secondary">{t('log.loading')}</p>}
          {logs.isError && (
            <p role="alert" className="text-sm">
              {t('log.loadError')}
            </p>
          )}
          {logs.data?.logs.length === 0 && <p className="text-sm text-text-secondary">{t('log.none')}</p>}
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {logs.data?.logs.map((log) => (
              <li key={log.meetingId} className="flex items-start gap-2 rounded-sm bg-surface-sunken p-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{log.title}</p>
                  <p className="text-xs text-text-secondary">
                    {roomNames.get(log.roomId) ?? log.roomId} · {floorName(log.floorId)} ·{' '}
                    {t('log.when', {
                      start: time.format(new Date(log.startedAt)),
                      end: log.endedAt ? time.format(new Date(log.endedAt)) : t('log.running'),
                    })}
                  </p>
                  <p className="text-xs">
                    {t('log.participants', { names: log.participants.map((p) => p.displayName).join(', ') })}
                  </p>
                </div>
                {log.hostId === myPersonId && (
                  <Button
                    variant="secondary"
                    aria-label={t('log.deleteLog', { title: log.title })}
                    onClick={() => {
                      remove(log.meetingId);
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    {t('log.delete')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Dialog.Close asChild>
            <Button variant="secondary" className="self-start">
              {t('log.close')}
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
