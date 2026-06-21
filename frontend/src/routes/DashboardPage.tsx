import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuthStore } from '../store/authStore';
import { listMyAttempts } from '../api/attempts.api';
import type { AttemptSummary } from '../types/attempt';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/icons';

function greetingKey(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

export function DashboardPage() {
  const { t } = useTranslation(['dashboard', 'common', 'review']);
  const user = useAuthStore((s) => s.user);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);

  useEffect(() => {
    listMyAttempts().then(setAttempts).catch(() => undefined);
  }, []);

  const inProgress = attempts.find((a) => a.status === 'in-progress');
  const done = attempts.filter((a) => a.status !== 'in-progress');
  const recent = done
    .slice()
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
    .slice(0, 5);
  const best = done.reduce<number>(
    (m, a) => Math.max(m, a.total?.scaledScore ?? 0),
    0,
  );
  const pct = Math.round((best / 990) * 100);

  return (
    <AppLayout>
      {/* hero */}
      <div className="card overflow-hidden">
        <div className="relative bg-gradient-to-br from-brand-500 to-amber-400 px-7 py-8 text-white">
          <p className="text-sm font-bold uppercase tracking-wide text-white/80">
            {t(`greeting_${greetingKey()}`)}
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold">
            {user?.displayName}
            <Icon name="greeting" className="text-2xl text-white/90" />
          </h1>
          <p className="mt-2 max-w-lg text-white/90">{t('encourage')}</p>
        </div>
        <div className="grid gap-4 px-7 py-6 sm:grid-cols-3">
          <Stat label={t('attemptsTaken')} value={String(done.length)} icon="tests" />
          <Stat
            label={t('bestScore')}
            value={best > 0 ? String(best) : '—'}
            icon="trophy"
          />
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
              <span>{t('progressTo990')}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-400 to-amber-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* resume in-progress attempt */}
      {inProgress && (
        <Link
          to={`/exam/${inProgress.id}`}
          className="mt-7 flex items-center justify-between gap-3 rounded-2xl bg-amber-50 px-5 py-4 transition hover:bg-amber-100"
        >
          <span className="flex items-center gap-3 font-semibold text-amber-800">
            <Icon name="timer" /> {t('resumeTitle')}
          </span>
          <span className="text-sm font-bold text-amber-700">{t('resumeCta')} →</span>
        </Link>
      )}

      {/* quick actions */}
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <ActionCard to="/tests" icon="headphones" title={t('actTakeTitle')} body={t('actTakeBody')} />
        <ActionCard to="/practice" icon="practice" title={t('actPracticeTitle')} body={t('actPracticeBody')} />
        <ActionCard to="/results" icon="results" title={t('actResultsTitle')} body={t('actResultsBody')} />
      </div>

      {/* recent results */}
      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-800">{t('recentTitle')}</h2>
          {recent.length > 0 && (
            <Link to="/results" className="text-sm font-bold text-brand-600 hover:underline">
              {t('viewAll')}
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-slate-400">
            {t('noAttempts')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/results/${a.id}`}
                  className="card flex items-center justify-between gap-3 p-4 transition hover:shadow-soft"
                >
                  <span className="text-sm font-semibold text-slate-600">
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '—'}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-lg font-extrabold text-slate-800">
                      {a.total?.scaledScore ?? '—'}
                    </span>
                    <span className="text-xs font-bold text-slate-400">/ 990</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl text-brand-600">
        <Icon name={icon} />
      </span>
      <div>
        <div className="text-2xl font-extrabold text-slate-800">{value}</div>
        <div className="text-xs font-bold text-slate-400">{label}</div>
      </div>
    </div>
  );
}

function ActionCard({ to, icon, title, body }: { to: string; icon: IconName; title: string; body: string }) {
  return (
    <Link to={to} className="card group p-6 transition hover:-translate-y-1 hover:shadow-soft">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-2xl text-brand-600 transition group-hover:scale-110">
        <Icon name={icon} />
      </span>
      <h3 className="mt-4 text-lg font-extrabold text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
      <span className="mt-3 inline-block text-sm font-bold text-brand-600">→</span>
    </Link>
  );
}
