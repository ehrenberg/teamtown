import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import logoMark from '../../../../design/brand/logo-mark.svg';
import { ServerStatus } from '../features/server-status/server-status.tsx';

// Three.js is large; the UI shell renders first and the world loads in a separate chunk.
const WorldCanvas = lazy(() => import('../world/world-canvas.tsx').then((module) => ({ default: module.WorldCanvas })));

export function App() {
  const { t } = useTranslation();

  return (
    <div className="grid h-full grid-rows-[56px_1fr]">
      <header className="flex items-center gap-4 border-b border-border-subtle bg-surface-raised px-4">
        <div className="flex items-center gap-2.5 font-display text-xl font-semibold">
          <img src={logoMark} alt="" className="size-8" />
          <span>
            Team<span className="text-terracotta-500">Town</span>
          </span>
        </div>
        <p className="border-l border-border-subtle pl-4 text-sm text-text-secondary">{t('app.tagline')}</p>
        <div className="ml-auto">
          <ServerStatus />
        </div>
      </header>
      <main className="relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#fffdf8_0%,var(--color-cream)_55%,#f1e8da_100%)]">
        <Suspense fallback={null}>
          <WorldCanvas label={t('app.worldLabel')} />
        </Suspense>
      </main>
    </div>
  );
}
