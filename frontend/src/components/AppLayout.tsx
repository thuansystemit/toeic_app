import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Icon } from './Icon';

export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clear } = useAuthStore();
  const isAuthor = user?.role === 'teacher' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const onLogout = async () => {
    try {
      await logout();
    } finally {
      clear();
      navigate('/login');
    }
  };

  const links = [
    { to: '/tests', label: t('navTests') },
    { to: '/results', label: t('navResults') },
    ...(isAuthor
      ? [
          { to: '/authoring', label: t('navAuthoring') },
          { to: '/exam-files', label: t('navImport') },
        ]
      : []),
    ...(isAdmin ? [{ to: '/admin/users', label: t('navAdmin') }] : []),
  ];

  const initials = (user?.displayName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 font-extrabold text-slate-800">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-500 text-lg text-white shadow-soft">
                <Icon name="brand" />
              </span>
              <span className="hidden sm:block">TOEIC</span>
            </Link>
            <nav className="ml-4 hidden items-center gap-1 md:flex">
              {links.map((l) => {
                const active = location.pathname.startsWith(l.to);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`nav-link ${active ? 'bg-brand-50 text-brand-600' : ''}`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <Link
              to="/profile"
              title={t('navProfile')}
              className="hidden h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-extrabold text-brand-700 transition hover:bg-brand-200 sm:grid"
            >
              {initials}
            </Link>
            <button onClick={onLogout} className="btn-ghost btn-sm">
              {t('logout')}
            </button>
          </div>
        </div>
        {/* mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {links.map((l) => {
            const active = location.pathname.startsWith(l.to);
            return (
              <Link key={l.to} to={l.to} className={`nav-link whitespace-nowrap ${active ? 'bg-brand-50 text-brand-600' : ''}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
