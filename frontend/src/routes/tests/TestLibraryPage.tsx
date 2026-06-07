import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import {
  listPublishedTests,
  getPublishedParts,
  type PublishedPart,
} from '../../api/tests.api';
import { startAttempt } from '../../api/attempts.api';
import type { TestDto } from '../../types/test';
import { Icon } from '../../components/Icon';

export function TestLibraryPage() {
  const { t } = useTranslation(['test', 'common']);
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [practiceFor, setPracticeFor] = useState<string | null>(null);
  const [parts, setParts] = useState<PublishedPart[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listPublishedTests().then(setTests).finally(() => setLoading(false));
  }, []);

  const startFull = async (testId: string) => {
    setBusy(true);
    try {
      const a = await startAttempt({ testId, mode: 'full' });
      navigate(`/exam/${a.id}`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openPractice = async (testId: string) => {
    if (practiceFor === testId) {
      setPracticeFor(null);
      return;
    }
    setPracticeFor(testId);
    setParts(await getPublishedParts(testId));
  };

  const startPractice = async (testId: string, partId: string) => {
    setBusy(true);
    try {
      const a = await startAttempt({ testId, mode: 'practice', partId });
      navigate(`/exam/${a.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <h1 className="text-2xl font-extrabold text-slate-800">{t('libraryTitle')}</h1>
      <p className="mb-6 mt-1 text-slate-500">{t('librarySubtitle')}</p>

      {loading && <p className="text-slate-400">{t('loading', { ns: 'common' })}</p>}
      {!loading && tests.length === 0 && (
        <div className="card grid place-items-center gap-2 p-12 text-center">
          <Icon name="empty" className="text-4xl text-slate-300" />
          <p className="font-semibold text-slate-500">{t('empty')}</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {tests.map((test) => (
          <div key={test.id} className="card flex flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800">{test.title}</h3>
                {test.description && (
                  <p className="mt-1 text-sm text-slate-500">{test.description}</p>
                )}
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-xl text-brand-600">
                <Icon name="headphones" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge">
                <Icon name="timer" /> {t('timeLimit', { minutes: test.timeLimitMinutes })}
              </span>
              <span className="badge-slate">200 {t('questions')}</span>
            </div>

            <div className="mt-5 flex gap-2">
              <button disabled={busy} onClick={() => startFull(test.id)} className="btn-primary flex-1">
                {t('startFull')}
              </button>
              <button disabled={busy} onClick={() => openPractice(test.id)} className="btn-ghost">
                {t('practice')}
              </button>
            </div>

            {practiceFor === test.id && (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4">
                <p className="mb-2 text-sm font-bold text-slate-600">{t('pickPart')}</p>
                <div className="flex flex-wrap gap-2">
                  {parts.filter((p) => p.count > 0).length === 0 && (
                    <span className="text-sm text-slate-400">{t('noPartsYet')}</span>
                  )}
                  {parts
                    .filter((p) => p.count > 0)
                    .map((p) => (
                      <button
                        key={p.partId}
                        className="chip"
                        disabled={busy}
                        onClick={() => startPractice(test.id, p.partId)}
                      >
                        {t('part', { n: p.partNumber })} · {p.count}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
