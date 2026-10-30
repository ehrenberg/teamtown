import { StatusDot, type PresenceStatus } from '@teamtown/ui';
import { useTranslation } from 'react-i18next';
import { usePresenceStore, type ConnectionStatus } from '../../stores/presence-store.ts';

const DOT: Readonly<Record<ConnectionStatus, PresenceStatus>> = {
  connecting: 'away',
  online: 'available',
  offline: 'offline',
};

export function ConnectionBadge() {
  const { t } = useTranslation();
  const connection = usePresenceStore((state) => state.connection);
  const label = t(`connection.${connection}`);
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised px-3 py-1.5 text-sm font-medium"
    >
      <StatusDot status={DOT[connection]} label={label} />
      <span>{label}</span>
    </div>
  );
}
