import { Button } from '@teamtown/ui';
import { buildFloorGrid, tileAt, type TileCoord } from '@teamtown/world-core';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import logoMark from '../../../../../design/brand/logo-mark.svg';
import { useFloorPlan, useFloors, useMe } from '../../api/queries.ts';
import { useAuthClient } from '../../app/auth-context.tsx';
import { useCallAudio } from '../../media/use-call-audio.ts';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import { serverClock } from '../../shared/server-clock.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { Phone } from 'lucide-react';
import { useCallStore } from '../../stores/call-store.ts';
import { CallAnnouncer, CallPanel, CallSomeoneDialog, IncomingCallDialog } from './calls.tsx';
import { useMediaStore } from '../../stores/media-store.ts';
import { CameraToggle, ScreenShareAnnouncer, ScreenShareToggle, VideoGrid } from './video.tsx';
import { ConnectionBadge } from './connection-badge.tsx';
import { ConversationAnnouncer } from './conversation-announcer.tsx';
import { ConversationLockToggle, MicrophoneToggle } from './conversation-controls.tsx';
import { FloorSwitcher } from './floor-switcher.tsx';
import { PeopleList } from './people-list.tsx';
import { RoomAnnouncer } from './room-announcer.tsx';
import { DoorModeControl, DoorNotice, KnockTray } from './room-controls.tsx';
import { entryTarget, floorRooms } from './rooms.ts';
import { RoomsList } from './rooms-list.tsx';
import { talkToTarget } from './talk-to.ts';
import { useKeyboardWalking } from './use-keyboard-walking.ts';
import { useMyRoom } from './use-my-room.ts';

// Three.js is large; the UI shell renders first and the world loads in a separate chunk.
const WorldScene = lazy(() => import('../../world/world-scene.tsx').then((module) => ({ default: module.WorldScene })));

/** Current tiles of everyone on the floor (where walking avatars are closest to right now). */
function currentTiles(): { readonly me: TileCoord | null; readonly tileOf: (personId: string) => TileCoord | null } {
  const { avatars, myPersonId } = usePresenceStore.getState();
  const now = serverClock.now();
  const tileOf = (id: string) => {
    const avatar = avatars[id];
    if (!avatar) return null;
    return avatar.movement ? tileAt(avatar.movement, now) : avatar.tile;
  };
  return { me: myPersonId ? tileOf(myPersonId) : null, tileOf };
}

function othersTiles(tileOf: (personId: string) => TileCoord | null): TileCoord[] {
  const { avatars, myPersonId } = usePresenceStore.getState();
  return Object.keys(avatars)
    .filter((id) => id !== myPersonId)
    .map(tileOf)
    .filter((tile) => tile !== null);
}

export function OfficePage() {
  const { t } = useTranslation();
  const auth = useAuthClient();
  const realtime = useRealtime();
  const me = useMe();
  const floors = useFloors();
  const connection = usePresenceStore((state) => state.connection);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [closedDoorRoomId, setClosedDoorRoomId] = useState<string | null>(null);
  const [callDialogOpen, setCallDialogOpen] = useState(false);

  const floorId = selectedFloorId ?? floors.data?.floors[0]?.floorId ?? null;
  const plan = useFloorPlan(floorId);
  const grid = useMemo(() => {
    if (!plan.data) return null;
    const built = buildFloorGrid(plan.data);
    return built.ok ? built.value : null;
  }, [plan.data]);
  const rooms = useMemo(() => (plan.data ? floorRooms(plan.data) : null), [plan.data]);
  const roomNames = useMemo(() => new Map(rooms?.rooms.map((room) => [room.roomId, room.name])), [rooms]);
  const myRoomId = useMyRoom(rooms?.roomMap ?? null);
  const myRoom = rooms?.rooms.find((room) => room.roomId === myRoomId) ?? null;
  const closedDoorRoom = rooms?.rooms.find((room) => room.roomId === closedDoorRoomId) ?? null;
  const doorModeLabels = useMemo(
    () => ({ open: t('room.mode_open'), knock: t('room.mode_knock'), locked: t('room.mode_locked') }),
    [t],
  );

  const requestFullScreen = useCallback(() => {
    useMediaStore.getState().requestFullScreen();
  }, []);
  const videoLabelOf = useCallback((name: string) => t('video.of', { name }), [t]);

  useEffect(() => {
    if (floorId && connection === 'online') void realtime.joinFloor(floorId);
  }, [floorId, connection, realtime]);

  useKeyboardWalking(grid, realtime);
  useCallAudio(realtime);
  const walkTo = useCallback(
    (tile: TileCoord) => {
      void realtime.moveTo(tile).then((result) => {
        setClosedDoorRoomId(!result.ok && result.code === 'door-closed' ? (rooms?.roomMap.roomAt(tile) ?? null) : null);
      });
    },
    [realtime, rooms],
  );
  const talkTo = useCallback(
    (personId: string) => {
      const { me, tileOf } = currentTiles();
      const them = tileOf(personId);
      if (!grid || !me || !them) return;
      const target = talkToTarget(grid, me, them, othersTiles(tileOf));
      if (target) walkTo(target);
    },
    [grid, walkTo],
  );
  const call = useCallback(
    (personId: string) => {
      void realtime.startCall(personId).then((result) => {
        if (!result.ok) {
          useCallStore.getState().notify({ personId, outcome: result.code === 'busy' ? 'busy' : 'cancelled' });
        }
      });
    },
    [realtime],
  );
  const goToRoom = useCallback(
    (roomId: string) => {
      const { me, tileOf } = currentTiles();
      if (!grid || !rooms || !me) return;
      const target = entryTarget(grid, rooms.roomMap, roomId, me, othersTiles(tileOf));
      if (target) walkTo(target);
    },
    [grid, rooms, walkTo],
  );

  return (
    <div className="grid h-full grid-cols-[260px_1fr] grid-rows-[56px_1fr]">
      <header className="col-span-2 flex items-center gap-4 border-b border-border-subtle bg-surface-raised px-4">
        <div className="flex items-center gap-2.5 font-display text-xl font-semibold">
          <img src={logoMark} alt="" className="size-8" />
          <span>
            Team<span className="text-terracotta-500">Town</span>
          </span>
        </div>
        {floors.data && (
          <FloorSwitcher floors={floors.data.floors} currentFloorId={floorId} onSelect={setSelectedFloorId} />
        )}
        <div className="ml-auto flex items-center gap-3">
          {myRoom?.doorModeAdjustable && <DoorModeControl room={myRoom} />}
          <Button
            variant="ghost"
            onClick={() => {
              setCallDialogOpen(true);
            }}
          >
            <Phone aria-hidden="true" className="size-4" />
            {t('call.callSomeone')}
          </Button>
          <ConversationLockToggle />
          <MicrophoneToggle />
          <CameraToggle />
          <ScreenShareToggle />
          <ConnectionBadge />
          {me.data && (
            <span
              title={me.data.displayName}
              className="grid size-8 place-items-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: me.data.avatarColor }}
            >
              {me.data.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <Button variant="ghost" onClick={() => void auth.signOut()}>
            {t('auth.signOut')}
          </Button>
        </div>
      </header>

      <aside className="overflow-y-auto border-r border-border-subtle bg-surface-sunken p-4">
        <CallPanel
          onAddSomeone={() => {
            setCallDialogOpen(true);
          }}
        />
        <ScreenShareAnnouncer />
        <KnockTray roomId={myRoomId} roomName={myRoom?.name ?? ''} />
        <PeopleList onTalkTo={talkTo} onCall={call} />
        {rooms && <RoomsList rooms={rooms.rooms} roomMap={rooms.roomMap} myRoomId={myRoomId} onGoTo={goToRoom} />}
        <ConversationAnnouncer />
        <RoomAnnouncer myRoomId={myRoomId} roomNames={roomNames} />
        <CallAnnouncer />
        <p className="mt-6 text-xs text-text-secondary">{t('office.walkHint')}</p>
      </aside>

      <main className="relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,var(--color-surface-raised)_0%,var(--color-cream)_55%,var(--color-neutral-100)_100%)]">
        {plan.isError || floors.isError ? (
          <p role="alert" className="p-8 text-text-secondary">
            {t('office.loadError')}
          </p>
        ) : plan.data ? (
          <Suspense fallback={<p className="p-8 text-text-secondary">{t('office.loading')}</p>}>
            <WorldScene
              plan={plan.data}
              label={t('app.worldLabel')}
              onTileSelected={walkTo}
              doorModeLabels={doorModeLabels}
              videoLabelOf={videoLabelOf}
              onWallScreenSelected={requestFullScreen}
            />
          </Suspense>
        ) : (
          <p className="p-8 text-text-secondary">{t('office.loading')}</p>
        )}
        <VideoGrid />
        {closedDoorRoom && (
          <DoorNotice
            room={closedDoorRoom}
            onDismiss={() => {
              setClosedDoorRoomId(null);
            }}
          />
        )}
      </main>
      <CallSomeoneDialog open={callDialogOpen} onOpenChange={setCallDialogOpen} />
      <IncomingCallDialog />
    </div>
  );
}
