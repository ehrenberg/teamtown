import { Button } from '@teamtown/ui';
import { buildFloorGrid } from '@teamtown/world-core';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import logoMark from '../../../../../design/brand/logo-mark.svg';
import { useFloorPlan, useFloors, useMe } from '../../api/queries.ts';
import { useAuthClient } from '../../app/auth-context.tsx';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { ConnectionBadge } from './connection-badge.tsx';
import { FloorSwitcher } from './floor-switcher.tsx';
import { PeopleList } from './people-list.tsx';
import { useKeyboardWalking } from './use-keyboard-walking.ts';

// Three.js is large; the UI shell renders first and the world loads in a separate chunk.
const WorldScene = lazy(() => import('../../world/world-scene.tsx').then((module) => ({ default: module.WorldScene })));

export function OfficePage() {
  const { t } = useTranslation();
  const auth = useAuthClient();
  const realtime = useRealtime();
  const me = useMe();
  const floors = useFloors();
  const connection = usePresenceStore((state) => state.connection);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);

  const floorId = selectedFloorId ?? floors.data?.floors[0]?.floorId ?? null;
  const plan = useFloorPlan(floorId);
  const grid = useMemo(() => {
    if (!plan.data) return null;
    const built = buildFloorGrid(plan.data);
    return built.ok ? built.value : null;
  }, [plan.data]);

  useEffect(() => {
    if (floorId && connection === 'online') void realtime.joinFloor(floorId);
  }, [floorId, connection, realtime]);

  useKeyboardWalking(grid, realtime);
  const walkTo = useCallback((tile: { x: number; y: number }) => void realtime.moveTo(tile), [realtime]);

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
        <PeopleList />
        <p className="mt-6 text-xs text-text-secondary">{t('office.walkHint')}</p>
      </aside>

      <main className="relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,var(--color-surface-raised)_0%,var(--color-cream)_55%,var(--color-neutral-100)_100%)]">
        {plan.isError || floors.isError ? (
          <p role="alert" className="p-8 text-text-secondary">
            {t('office.loadError')}
          </p>
        ) : plan.data ? (
          <Suspense fallback={<p className="p-8 text-text-secondary">{t('office.loading')}</p>}>
            <WorldScene plan={plan.data} label={t('app.worldLabel')} onTileSelected={walkTo} />
          </Suspense>
        ) : (
          <p className="p-8 text-text-secondary">{t('office.loading')}</p>
        )}
      </main>
    </div>
  );
}
