import { positionAt, WALK_SPEED_TILES_PER_SECOND, type FloorGrid } from '@teamtown/world-core';
import { useEffect } from 'react';
import type { RealtimeClient } from '../../realtime/realtime-client.ts';
import { serverClock } from '../../shared/server-clock.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { stepForKey } from './keyboard-steps.ts';

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * WASD / arrow keys walk one tile at a time. The step is predicted locally for instant feedback and
 * corrected by the server's authoritative path (docs/architecture/world-and-realtime.md §3).
 */
export function useKeyboardWalking(grid: FloorGrid | null, realtime: RealtimeClient): void {
  useEffect(() => {
    if (!grid) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const step = stepForKey(event.code);
      if (!step || isTyping(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();

      const { avatars, myPersonId, predictMovement } = usePresenceStore.getState();
      const me = myPersonId ? avatars[myPersonId] : undefined;
      if (!me) return;
      const now = serverClock.now();
      if (me.movement && !positionAt(me.movement, now).arrived) return; // finish the current step first

      const from = me.movement?.path.at(-1) ?? me.tile;
      const next = { x: from.x + step.x, y: from.y + step.y };
      if (!grid.canStep(from, next)) return;

      predictMovement(me.personId, {
        from,
        path: [next],
        startedAt: now,
        speedTilesPerSecond: WALK_SPEED_TILES_PER_SECOND,
      });
      void realtime.moveTo(next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [grid, realtime]);
}
