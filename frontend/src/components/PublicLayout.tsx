import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { LocaleSwitcher } from './LocaleSwitcher';

/** Header + shell for unauthenticated (guest) pages. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation(['public']);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/welcome" className="flex items-center gap-2 font-extrabold text-slate-800">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-500 text-lg text-white shadow-soft">
              <Icon name="brand" />
            </span>
            <span className="hidden sm:block">TOEIC</span>
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <Link to="/login" className="btn-ghost btn-sm">
              {t('signIn')}
            </Link>
            <Link to="/register" className="btn-primary btn-sm">
              {t('signUp')}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
