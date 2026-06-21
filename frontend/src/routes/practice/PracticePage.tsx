import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import {
  getRecommendations,
  getSkillMastery,
  type PracticeRecommendation,
  type SkillMastery,
} from '../../api/practice.api';
import { startAttempt } from '../../api/attempts.api';

// Skill nodes are coloured by taxonomy category (mirrors the knowledge graph).
const CATEGORY_COLORS: Record<string, string> = {
  grammar: '#6366f1',
  lexical: '#10b981',
  discourse: '#f59e0b',
  comprehension: '#f43f5e',
  listening: '#64748b',
};

/** Mastery band → bar colour (red → amber → green). */
function masteryColor(score: number): string {
  if (score < 0.4) return '#f43f5e';
  if (score < 0.7) return '#f59e0b';
  return '#10b981';
}

export function PracticePage() {
  const { t } = useTranslation(['practice', 'common']);
  const navigate = useNavigate();
  const [recs, setRecs] = useState<PracticeRecommendation[]>([]);
  const [skills, setSkills] = useState<SkillMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getRecommendations(), getSkillMastery()])
      .then(([r, s]) => {
        setRecs(r);
        setSkills(s);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const practise = async (rec: PracticeRecommendation) => {
    if (starting) return;
    setStarting(rec.partId);
    try {
      const a = await startAttempt({
        testId: rec.testId,
        mode: 'practice',
        partId: rec.partId,
      });
      navigate(`/exam/${a.id}`);
    } catch {
      setStarting(null);
    }
  };

  return (
    <AppLayout>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
        <Icon name="practice" /> {t('title')}
      </h1>
      <p className="mb-6 mt-1 text-slate-500">{t('subtitle')}</p>

      {loading ? (
        <div className="grid place-items-center py-16 text-slate-400">
          <Icon name="spinner" />
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-5">
          {/* recommendations */}
          <section className="lg:col-span-3">
            <h2 className="text-lg font-extrabold text-slate-800">{t('recTitle')}</h2>
            <p className="mb-3 mt-0.5 text-sm text-slate-500">{t('recSubtitle')}</p>
            {recs.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-400">
                {t('recEmpty')}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recs.map((r) => (
                  <li
                    key={r.skillId}
                    className="card flex items-center justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: CATEGORY_COLORS[r.category] ?? '#64748b' }}
                        />
                        <span className="truncate font-extrabold text-slate-800">
                          {r.name}
                        </span>
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-500">
                          {Math.round(r.score * 100)}%
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {r.testTitle} · {t('part', { n: r.partNumber })} ·{' '}
                        {t('unseenN', { count: r.unseen })}
                      </p>
                    </div>
                    <button
                      onClick={() => practise(r)}
                      disabled={starting === r.partId}
                      className="btn-primary btn-sm shrink-0"
                    >
                      {starting === r.partId ? (
                        <Icon name="spinner" />
                      ) : (
                        <>
                          <Icon name="play" /> {t('practiceCta')}
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* mastery summary */}
          <section className="lg:col-span-2">
            <h2 className="text-lg font-extrabold text-slate-800">{t('masteryTitle')}</h2>
            <p className="mb-3 mt-0.5 text-sm text-slate-500">{t('masterySubtitle')}</p>
            {skills.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-400">
                {t('masteryEmpty')}
              </p>
            ) : (
              <ul className="card flex flex-col gap-3 p-4">
                {skills.map((s) => (
                  <li key={s.skillId}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-semibold text-slate-700">
                        {s.name}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-slate-400">
                        {t('attemptsN', { correct: s.correct, attempts: s.attempts })}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(s.score * 100)}%`,
                          background: masteryColor(s.score),
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppLayout>
  );
}
