import { classNames } from './class-names.ts';

export type PresenceStatus = 'available' | 'busy' | 'focus' | 'away' | 'offline';

/**
 * Status is always shown by colour AND shape, so it stays readable for colour-blind people
 * (docs/design/brand-guide.md §4).
 */
const SHAPES: Readonly<Record<PresenceStatus, string>> = {
  available: 'bg-status-available',
  busy: 'bg-status-busy after:absolute after:inset-x-0.5 after:top-1/2 after:h-0.5 after:-translate-y-1/2 after:rounded-full after:bg-white',
  focus: 'bg-status-focus shadow-[inset_-3px_-2px_0_0_var(--color-ocean-100)]',
  away: 'bg-status-away after:absolute after:left-1/2 after:top-0.5 after:h-1 after:w-0.5 after:bg-white',
  offline: 'border-2 border-status-offline bg-transparent',
};

export interface StatusDotProps {
  readonly status: PresenceStatus;
  /** Translated, human-readable status, e.g. "Available". */
  readonly label: string;
  readonly className?: string;
}

export function StatusDot({ status, label, className }: StatusDotProps) {
  return (
    <span
      role="img"
      aria-label={label}
      data-status={status}
      className={classNames('relative inline-block size-2.5 shrink-0 rounded-full', SHAPES[status], className)}
    />
  );
}
