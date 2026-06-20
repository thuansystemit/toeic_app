import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicLayout } from '../../components/PublicLayout';
import { Icon } from '../../components/Icon';
import { getPublicTests, type PublicTestCard } from '../../api/public.api';

export function WelcomePage() {
  const { t } = useTranslation(['public']);
  const [tests, setTests] = useState<PublicTestCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicTests()
      .then(setTests)
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
  }, []);

  const sample = tests.find((x) => x.isSample) ?? tests[0];

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="rounded-3xl bg-gradient-to-br from-brand-50 to-white p-8 sm:p-12">
        <h1 className="max-w-2xl text-3xl font-extrabold text-slate-800 sm:text-4xl">
          {t('heroTitle')}
        </h1>
        <p className="mt-3 max-w-xl text-slate-500">{t('heroSubtitle')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {sample && (
            <Link to="/welcome/sample" className="btn-primary">
              <Icon name="rocket" /> {t('trySample')}
            </Link>
          )}
          <Link to="/register" className="btn-soft">
            {t('createAccount')}
          </Link>
        </div>
      </section>

      {/* Catalog */}
      <section className="mt-10">
        <h2 className="text-xl font-extrabold text-slate-800">{t('catalogTitle')}</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">{t('catalogSubtitle')}</p>

        {loading && <p className="text-slate-400">{t('loading', { ns: 'common' })}</p>}
        {!loading && tests.length === 0 && (
          <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-slate-400">
            {t('noTests')}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((tst) => {
            const isSample = tst.id === sample?.id;
            return (
              <div key={tst.id} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-800">{tst.title}</h3>
                  {isSample ? (
                    <span className="badge-green shrink-0">{t('freePreview')}</span>
                  ) : (
                    <span className="badge-slate shrink-0">
                      <Icon name="audioLocked" /> {t('locked')}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-400">
                  {t('testMeta', { parts: tst.partCount, questions: tst.questionCount })}
                </p>
                {isSample ? (
                  <Link to="/welcome/sample" className="btn-soft btn-sm mt-auto self-start">
                    {t('preview')}
                  </Link>
                ) : (
                  <Link to="/register" className="btn-primary btn-sm mt-auto self-start">
                    {t('registerToUnlock')}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </PublicLayout>
  );
}
