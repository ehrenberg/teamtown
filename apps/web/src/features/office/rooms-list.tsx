import { tileAt, type RoomMap } from '@teamtown/world-core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import { serverClock } from '../../shared/server-clock.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { myKnock, useRoomStore } from '../../stores/room-store.ts';
import { DOOR_MODE_ICONS } from './room-controls.tsx';
import type { RoomInfo } from './rooms.ts';

const POLL_MS = 500;
const LINK_BUTTON = 'min-h-6 rounded-sm px-1.5 py-0.5 text-xs font-medium text-text-link hover:bg-neutral-100';

/** Who is in which room, polled, because walking changes rooms without any event. */
function useOccupancy(roomMap: RoomMap): Readonly<Record<string, readonly string[]>> {
  const [occupancy, setOccupancy] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const update = () => {
      const now = serverClock.now();
      const next: Record<string, string[]> = {};
      for (const avatar of Object.values(usePresenceStore.getState().avatars)) {
        const roomId = roomMap.roomAt(avatar.movement ? tileAt(avatar.movement, now) : avatar.tile);
        if (roomId) next[roomId] = [...(next[roomId] ?? []), avatar.personId];
      }
      setOccupancy((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
    };
    update();
    const timer = setInterval(update, POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [roomMap]);

  return occupancy;
}

/** Non-spatial view of the rooms (principle "spatial is optional"): door modes, who is inside, go there, knock. */
export function RoomsList({
  rooms,
  roomMap,
  myRoomId,
  onGoTo,
}: {
  readonly rooms: readonly RoomInfo[];
  readonly roomMap: RoomMap;
  readonly myRoomId: string | null;
  readonly onGoTo: (roomId: string) => void;
}) {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const avatars = usePresenceStore((state) => state.avatars);
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const doorModes = useRoomStore((state) => state.doorModes);
  const waitingFor = useRoomStore((state) => myKnock(state.knocks, myPersonId));
  const occupancy = useOccupancy(roomMap);
  const sorted = [...rooms].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section aria-labelledby="rooms-heading" className="mt-6 flex flex-col gap-2">
      <h2 id="rooms-heading" className="font-display text-xs font-semibold tracking-wide text-text-secondary uppercase">
        {t('room.rooms')}
      </h2>
      <ul className="flex flex-col gap-1">
        {sorted.map((room) => {
          const mode = doorModes[room.roomId] ?? 'open';
          const Icon = DOOR_MODE_ICONS[mode];
          const inside = occupancy[room.roomId] ?? [];
          const isMine = room.roomId === myRoomId;
          const waitingHere = waitingFor?.roomId === room.roomId;
          const names = inside.map((id) => avatars[id]?.displayName ?? '').filter(Boolean);
          return (
            <li key={room.roomId} className="rounded-sm px-2 py-1.5 text-sm hover:bg-neutral-200">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {room.name}
                  {isMine && <span className="font-normal text-text-secondary"> ({t('office.you')})</span>}
                </span>
                {room.doorModeAdjustable && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-text-secondary">
                    <Icon aria-hidden="true" className="size-3.5" />
                    {t(`room.mode_${mode}`)}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-text-secondary">
                {names.length > 0 ? names.join(', ') : t('room.occupants', { count: 0 })}
              </p>
              {!isMine && (
                <div className="mt-1 flex gap-1">
                  {/* Also offered for closed rooms: whoever just left may return within the grace period. */}
                  <button
                    type="button"
                    aria-label={t('room.goTo', { room: room.name })}
                    onClick={() => {
                      onGoTo(room.roomId);
                    }}
                    className={LINK_BUTTON}
                  >
                    {t('room.goThere')}
                  </button>
                  {waitingHere ? (
                    <button
                      type="button"
                      onClick={() => void realtime.cancelKnock(waitingFor.knockId)}
                      className={LINK_BUTTON}
                    >
                      {t('room.cancelKnock')}
                    </button>
                  ) : (
                    mode === 'knock' &&
                    inside.length > 0 &&
                    !waitingFor && (
                      <button
                        type="button"
                        aria-label={t('room.knockOn', { room: room.name })}
                        onClick={() => void realtime.knockOnRoom(room.roomId)}
                        className={LINK_BUTTON}
                      >
                        {t('room.knock')}
                      </button>
                    )
                  )}
                </div>
              )}
              {waitingHere && <p className="mt-1 text-xs">{t('room.waiting', { room: room.name })}</p>}
            </li>
          );
        })}
      </ul>
      <KnockResult rooms={rooms} />
    </section>
  );
}

/** The answer to one's own knock, visible until the next knock. */
function KnockResult({ rooms }: { readonly rooms: readonly RoomInfo[] }) {
  const { t } = useTranslation();
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const result = useRoomStore((state) => state.lastKnockResult);
  if (result?.requester !== myPersonId) return null;
  const room = rooms.find((r) => r.roomId === result.roomId)?.name ?? '';
  return <p className="text-xs text-text-secondary">{t(`room.result_${result.outcome}`, { room })}</p>;
}
