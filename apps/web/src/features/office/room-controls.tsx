import { Button } from '@teamtown/ui';
import { DoorOpen, Hand, Lock, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { playKnock } from '../../media/knock-sound.ts';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { myKnock, useRoomStore, type DoorMode, type Knock } from '../../stores/room-store.ts';
import type { RoomInfo } from './rooms.ts';

export const DOOR_MODES: readonly DoorMode[] = ['open', 'knock', 'locked'];
export const DOOR_MODE_ICONS = { open: DoorOpen, knock: Hand, locked: Lock } as const;

/** Occupants switch the door of the room they are in (until M4 anyone inside may, ADR-0031). */
export function DoorModeControl({ room }: { readonly room: RoomInfo }) {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const current = useRoomStore((state) => state.doorModes[room.roomId] ?? 'open');

  return (
    <div role="group" aria-label={t('room.doorOf', { room: room.name })} className="flex items-center gap-0.5">
      {DOOR_MODES.map((mode) => {
        const Icon = DOOR_MODE_ICONS[mode];
        return (
          <Button
            key={mode}
            variant="ghost"
            aria-pressed={current === mode}
            className={`px-2.5 ${current === mode ? 'bg-neutral-200' : ''}`}
            onClick={() => void realtime.setDoorMode(room.roomId, mode)}
          >
            <Icon aria-hidden="true" className="size-4" />
            {t(`room.mode_${mode}`)}
          </Button>
        );
      })}
    </div>
  );
}

/** Knocks on the room one is in, with "let in" and "not now". A knock sound plays when a new one arrives. */
export function KnockTray({ roomId, roomName }: { readonly roomId: string | null; readonly roomName: string }) {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const avatars = usePresenceStore((state) => state.avatars);
  const allKnocks = useRoomStore((state) => state.knocks);
  const knocks = Object.values(allKnocks).filter(
    (knock: Knock) => knock.roomId === roomId && knock.requester !== myPersonId,
  );
  const heard = useRef(new Set<string>());

  useEffect(() => {
    const fresh = knocks.filter((knock) => !heard.current.has(knock.knockId));
    for (const knock of fresh) heard.current.add(knock.knockId);
    if (fresh.length > 0) playKnock();
  }, [knocks]);

  if (knocks.length === 0) return null;
  return (
    <section
      aria-label={t('room.knocks')}
      className="mb-4 flex flex-col gap-2 rounded-md border border-ochre-500 bg-ochre-100 p-2.5"
    >
      {knocks.map((knock) => {
        const name = avatars[knock.requester]?.displayName ?? '';
        return (
          <div key={knock.knockId} className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-sm">
              <Hand aria-hidden="true" className="size-4 shrink-0" />
              {t('room.knockingAt', { name, room: roomName })}
            </p>
            <div className="flex gap-1.5">
              <Button
                aria-label={t('room.admitPerson', { name })}
                onClick={() => void realtime.answerKnock(knock.knockId, true)}
              >
                {t('room.admit')}
              </Button>
              <Button
                variant="secondary"
                aria-label={t('room.declinePerson', { name })}
                onClick={() => void realtime.answerKnock(knock.knockId, false)}
              >
                {t('room.decline')}
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Shown after walking into a closed door: says why, and offers to knock where that is possible. */
export function DoorNotice({ room, onDismiss }: { readonly room: RoomInfo; readonly onDismiss: () => void }) {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const mode = useRoomStore((state) => state.doorModes[room.roomId] ?? 'open');
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const waiting = useRoomStore((state) => myKnock(state.knocks, myPersonId));

  if (mode === 'open') return null;
  return (
    <div
      role="status"
      className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-md bg-surface-raised px-4 py-2.5 text-sm shadow-raised"
    >
      <Lock aria-hidden="true" className="size-4 shrink-0" />
      <span>{t(mode === 'knock' ? 'room.doorKnockFirst' : 'room.doorClosed', { room: room.name })}</span>
      {mode === 'knock' && !waiting && (
        <Button
          variant="secondary"
          onClick={() => {
            void realtime.knockOnRoom(room.roomId);
            onDismiss();
          }}
        >
          {t('room.knock')}
        </Button>
      )}
      <button
        type="button"
        aria-label={t('room.dismiss')}
        onClick={onDismiss}
        className="rounded-sm p-1 text-text-secondary hover:bg-neutral-100"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
