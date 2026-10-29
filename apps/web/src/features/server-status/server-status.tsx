import { StatusDot } from '@teamtown/ui';
import { useTranslation } from 'react-i18next';
import { useServerHealth } from './use-server-health.ts';

export function ServerStatus() {
  const { t } = useTranslation();
  const health = useServerHealth();

  const { status, text } = health.isPending
    ? ({ status: 'away', text: t('server.checking') } as const)
    : health.isSuccess
      ? ({ status: 'available', text: t('server.online', { version: health.data.version }) } as const)
      : ({ status: 'offline', text: t('server.offline') } as const);

  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-raised px-3 py-1.5 text-sm font-medium"
    >
      <StatusDot status={status} label={t(`status.${status}`)} />
      <span>{text}</span>
    </div>
  );
}
