import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { listMyAttempts } from '../../api/attempts.api';
import type { AttemptSummary } from '../../types/attempt';
import { Icon } from '../../components/Icon';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    submitted: 'badge-green',
    expired: 'badge',
    'in-progress': 'badge-slate',
  };
  return <span className={map[status] ?? 'badge-slate'}>{status}</span>;
}

export function MyResultsPage() {
  const { t } = useTranslation(['review', 'common']);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyAttempts().then(setAttempts).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <h1 className="text-2xl font-extrabold text-slate-800">{t('myResults')}</h1>
      <p className="mb-6 mt-1 text-slate-500">{t('resultsSubtitle')}</p>

      {loading && <p className="text-slate-400">{t('loading', { ns: 'common' })}</p>}
      {!loading && attempts.length === 0 && (
        <div className="card grid place-items-center gap-2 p-12 text-center">
          <Icon name="rocket" className="text-4xl text-brand-400" />
          <p className="font-semibold text-slate-500">{t('noAttempts')}</p>
          <Link to="/tests" className="btn-primary mt-2">
            {t('startOne')}
          </Link>
        </div>
      )}

      <div className="grid gap-3">
        {attempts.map((a) => (
          <div key={a.id} className="card flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl text-brand-600">
                <Icon name={a.mode === 'full' ? 'full' : 'practice'} />
              </span>
              <div>
                <div className="font-bold capitalize text-slate-800">
                  {a.mode === 'full' ? t('fullTest') : t('practice')}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(a.startedAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {a.total && (
                <div className="text-right">
                  <div className="text-xl font-extrabold text-brand-600">
                    {a.total.scaledScore ?? '—'}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400">
                    {t('raw')} {a.total.rawScore}
                  </div>
                </div>
              )}
              <StatusBadge status={a.status} />
              {a.status === 'in-progress' ? (
                <Link to={`/exam/${a.id}`} className="btn-soft btn-sm">
                  {t('resume')}
                </Link>
              ) : (
                <Link to={`/results/${a.id}`} className="btn-ghost btn-sm">
                  {t('view')}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
