import { tileAt, type RoomMap } from '@teamtown/world-core';
import { useEffect, useState } from 'react';
import { serverClock } from '../../shared/server-clock.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';

const POLL_MS = 250;

/** The room one's own avatar is in. Polled, because walking changes rooms without any event. */
export function useMyRoom(roomMap: RoomMap | null): string | null {
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!roomMap) {
      setRoomId(null);
      return;
    }
    const update = () => {
      const { avatars, myPersonId } = usePresenceStore.getState();
      const avatar = myPersonId ? avatars[myPersonId] : undefined;
      const tile = avatar ? (avatar.movement ? tileAt(avatar.movement, serverClock.now()) : avatar.tile) : null;
      setRoomId(tile ? roomMap.roomAt(tile) : null);
    };
    update();
    const timer = setInterval(update, POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [roomMap]);

  return roomId;
}
