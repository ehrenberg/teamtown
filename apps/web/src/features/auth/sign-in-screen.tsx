import { Button } from '@teamtown/ui';
import { useTranslation } from 'react-i18next';
import logo from '../../../../../design/brand/logo-horizontal.svg';
import { useAuthClient } from '../../app/auth-context.tsx';

export function SignInScreen() {
  const { t } = useTranslation();
  const auth = useAuthClient();
  return (
    <main className="grid h-full place-items-center bg-[radial-gradient(ellipse_at_50%_40%,var(--color-surface-raised)_0%,var(--color-cream)_60%,var(--color-neutral-100)_100%)] p-6">
      <div className="flex max-w-sm flex-col items-center gap-6 rounded-lg border border-border-subtle bg-surface-raised p-10 text-center shadow-raised">
        <img src={logo} alt="TeamTown" className="h-12 w-auto" />
        <div>
          <h1 className="font-display text-2xl font-semibold">{t('auth.welcome')}</h1>
          <p className="mt-2 text-text-secondary">{t('auth.intro')}</p>
        </div>
        <Button onClick={() => void auth.signIn()} className="w-full">
          {t('auth.signIn')}
        </Button>
        <p className="text-sm text-text-secondary">{t('app.tagline')}</p>
      </div>
    </main>
  );
}
