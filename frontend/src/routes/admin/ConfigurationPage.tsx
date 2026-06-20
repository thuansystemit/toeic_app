import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '../../components/AppLayout';
import { getAppConfig, type AppConfig } from '../../api/admin.api';

export function ConfigurationPage() {
  const { t } = useTranslation(['config', 'common']);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAppConfig()
      .then(setConfig)
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <AppLayout>
      <h1 className="text-2xl font-extrabold text-slate-800">{t('title')}</h1>
      <p className="mb-6 mt-1 text-slate-500">{t('subtitle')}</p>

      {loading && <p className="text-slate-500">{t('loading', { ns: 'common' })}</p>}
      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>
      )}

      {config && !config.present && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
          {t('noFile', { path: config.path })}
        </p>
      )}

      {config && config.present && (
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <span className="text-xs font-semibold text-slate-400">
              {t('source')}: <code className="text-slate-500">{config.path}</code>
            </span>
            <span className="badge-slate">{t('readOnly')}</span>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <th className="px-5 py-2 font-semibold">{t('key')}</th>
                <th className="px-5 py-2 font-semibold">{t('value')}</th>
              </tr>
            </thead>
            <tbody>
              {config.entries.map((e) => (
                <tr key={e.key} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2 font-mono font-semibold text-slate-700">{e.key}</td>
                  <td className="px-5 py-2 font-mono text-slate-600">
                    {e.value ? (
                      <span>{e.value}</span>
                    ) : (
                      <span className="text-slate-300">{t('empty')}</span>
                    )}
                    {e.secret && (
                      <span className="ml-2 align-middle badge-slate text-[10px]">{t('secret')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">{t('editHint')}</p>
    </AppLayout>
  );
}
