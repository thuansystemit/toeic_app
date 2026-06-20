import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PublicLayout } from '../../components/PublicLayout';
import { Icon } from '../../components/Icon';
import { getSampleTest } from '../../api/public.api';
import type { TestDto } from '../../types/test';

export function SamplePreviewPage() {
  const { t } = useTranslation(['public']);
  const [test, setTest] = useState<TestDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSampleTest()
      .then(setTest)
      .catch(() => setTest(null))
      .finally(() => setLoading(false));
  }, []);

  const parts = (test?.parts ?? [])
    .filter((p) => (p.questions?.length ?? 0) > 0)
    .sort((a, b) => a.partNumber - b.partNumber);

  return (
    <PublicLayout>
      <Link to="/welcome" className="text-sm font-semibold text-brand-600 hover:underline">
        ← {t('backToBrowse')}
      </Link>

      {/* Register banner */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-5 py-4">
        <p className="text-sm font-semibold text-amber-800">{t('previewBanner')}</p>
        <Link to="/register" className="btn-primary btn-sm">
          {t('registerToUnlock')}
        </Link>
      </div>

      {loading && <p className="mt-6 text-slate-400">{t('loading', { ns: 'common' })}</p>}
      {!loading && !test && (
        <p className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-center text-slate-400">
          {t('noSample')}
        </p>
      )}

      {test && (
        <>
          <h1 className="mt-6 text-2xl font-extrabold text-slate-800">{test.title}</h1>
          {test.description && <p className="mt-1 text-slate-500">{test.description}</p>}

          {parts.map((part) => (
            <section key={part.id} className="mt-6">
              <h2 className="mb-3 text-lg font-bold text-slate-700">
                {t('partLabel', { n: part.partNumber })}
              </h2>
              <div className="flex flex-col gap-3">
                {part.questions!
                  .slice()
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((q) => {
                    const passage = q.stimuli?.find((s) => s.type === 'passage')?.passageText;
                    return (
                      <div key={q.id} className="card p-5">
                        {passage && (
                          <pre className="mb-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-sm text-slate-600">
                            {passage}
                          </pre>
                        )}
                        <div className="font-semibold text-slate-800">
                          {q.questionText || '—'}
                        </div>
                        <ul className="mt-3 flex flex-col gap-1">
                          {q.choices.map((c) => (
                            <li
                              key={c.label}
                              className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${
                                c.isCorrect
                                  ? 'bg-emerald-50 font-semibold text-emerald-700'
                                  : 'text-slate-600'
                              }`}
                            >
                              <span className="font-extrabold">{c.label}.</span>
                              <span>{c.choiceText}</span>
                              {c.isCorrect && <Icon name="correct" className="ml-auto text-emerald-500" />}
                            </li>
                          ))}
                        </ul>
                        {q.explanationVi && (
                          <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-slate-600">
                            <Icon name="explanation" className="mr-1 text-brand-500" />
                            {q.explanationVi}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}

          <div className="mt-8 rounded-2xl bg-brand-50 p-6 text-center">
            <p className="font-semibold text-slate-700">{t('ctaTitle')}</p>
            <Link to="/register" className="btn-primary mt-3">
              {t('createAccount')}
            </Link>
          </div>
        </>
      )}
    </PublicLayout>
  );
}
