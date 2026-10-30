import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { roomCallOf, useRoomStore } from '../../stores/room-store.ts';

/** Polite announcements for knocks, door changes and room calls (the visual cues are the tray, list and signs). */
export function RoomAnnouncer({
  myRoomId,
  roomNames,
}: {
  readonly myRoomId: string | null;
  readonly roomNames: ReadonlyMap<string, string>;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const myPersonId = usePresenceStore((state) => state.myPersonId);
  const knocks = useRoomStore((state) => state.knocks);
  const result = useRoomStore((state) => state.lastKnockResult);
  const myDoorMode = useRoomStore((state) => (myRoomId ? state.doorModes[myRoomId] : undefined));
  const myRoomCall = useRoomStore((state) => roomCallOf(state.roomCalls, myPersonId));
  const announced = useRef({ knocks: new Set<string>(), result, myDoorMode, myRoomId, myRoomCall });

  const nameOf = (personId: string) => usePresenceStore.getState().avatars[personId]?.displayName ?? '';
  const room = (roomId: string | null | undefined) => (roomId ? (roomNames.get(roomId) ?? '') : '');

  useEffect(() => {
    const fresh = Object.values(knocks).find(
      (knock) => knock.requester !== myPersonId && !announced.current.knocks.has(knock.knockId),
    );
    for (const knock of Object.values(knocks)) announced.current.knocks.add(knock.knockId);
    if (fresh) setMessage(t('room.knockingAt', { name: nameOf(fresh.requester), room: room(fresh.roomId) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce on store changes only
  }, [knocks]);

  useEffect(() => {
    if (!result || result === announced.current.result) return;
    announced.current.result = result;
    setMessage(
      result.requester === myPersonId
        ? t(`room.result_${result.outcome}`)
        : t(`room.answered_${result.outcome}`, { name: nameOf(result.requester) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce on store changes only
  }, [result]);

  useEffect(() => {
    const before = announced.current;
    if (myRoomId === before.myRoomId && myDoorMode && myDoorMode !== before.myDoorMode) {
      setMessage(t('room.doorModeNow', { room: room(myRoomId), mode: t(`room.mode_${myDoorMode}`) }));
    }
    before.myRoomId = myRoomId;
    before.myDoorMode = myDoorMode;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce on store changes only
  }, [myRoomId, myDoorMode]);

  useEffect(() => {
    const before = announced.current.myRoomCall;
    announced.current.myRoomCall = myRoomCall;
    if (myRoomCall && myRoomCall !== before) setMessage(t('room.inRoomCall', { room: room(myRoomCall) }));
    else if (!myRoomCall && before) setMessage(t('room.leftRoomCall', { room: room(before) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce on store changes only
  }, [myRoomCall]);

  return (
    <p aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
