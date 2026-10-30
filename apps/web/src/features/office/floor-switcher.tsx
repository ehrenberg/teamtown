import type { FloorSummary } from '@teamtown/contracts';
import { useTranslation } from 'react-i18next';

export function FloorSwitcher({
  floors,
  currentFloorId,
  onSelect,
}: {
  readonly floors: readonly FloorSummary[];
  readonly currentFloorId: string | null;
  readonly onSelect: (floorId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t('office.floors')}
      className="flex rounded-md border border-border-subtle bg-surface-sunken p-0.5"
    >
      {floors.map((floor) => {
        const active = floor.floorId === currentFloorId;
        return (
          <button
            key={floor.floorId}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onSelect(floor.floorId);
            }}
            className={
              active
                ? 'rounded-sm bg-surface-inverse px-3 py-1.5 text-sm font-semibold text-text-inverse'
                : 'rounded-sm px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary'
            }
          >
            {t('office.level', { context: floor.level === 0 ? 'zero' : 'other', level: floor.level })}
            <span className="sr-only"> ({floor.name})</span>
          </button>
        );
      })}
    </div>
  );
}
