import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { getAttempt } from '../../api/attempts.api';
import type { AttemptView } from '../../types/attempt';
import { StimulusDisplay } from '../../components/StimulusDisplay';
import { Icon } from '../../components/Icon';

export function AttemptReviewPage() {
  const { t } = useTranslation(['review', 'exam', 'common']);
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [wrongOnly, setWrongOnly] = useState(false);

  useEffect(() => {
    if (attemptId) getAttempt(attemptId).then(setAttempt);
  }, [attemptId]);

  if (!attempt) return <AppLayout>{t('loading', { ns: 'common' })}</AppLayout>;

  const label = (s: string) =>
    s === 'listening' ? t('listening') : s === 'reading' ? t('reading') : t('total');

  return (
    <AppLayout>
      <Link to="/results" className="text-sm font-bold text-brand-600 hover:underline">
        ← {t('myResults')}
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-slate-800">{t('resultTitle')}</h1>
      <p className="text-slate-500">{attempt.testTitle}</p>

      {attempt.status === 'expired' && (
        <p className="mt-3 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-800">
          <Icon name="expired" /> {t('expired', { ns: 'exam' })}
        </p>
      )}

      {/* scores */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {attempt.scores
          ?.slice()
          .sort((a) => (a.section === 'total' ? 1 : -1))
          .map((s) => (
            <div
              key={s.section}
              className={`card p-5 text-center ${
                s.section === 'total' ? 'bg-gradient-to-br from-brand-500 to-amber-400 text-white' : ''
              }`}
            >
              <div className={`text-xs font-bold uppercase ${s.section === 'total' ? 'text-white/80' : 'text-slate-400'}`}>
                {label(s.section)}
              </div>
              <div className="mt-1 text-4xl font-extrabold">{s.scaledScore ?? '—'}</div>
              <div className={`mt-1 text-xs font-semibold ${s.section === 'total' ? 'text-white/80' : 'text-slate-400'}`}>
                {t('raw')} {s.rawScore}
                {s.scaledUnavailable ? ` · ${t('approximate')}` : ''}
              </div>
            </div>
          ))}
      </div>

      {/* review */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-800">{t('reviewAnswers')}</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-500">
          <input type="checkbox" checked={wrongOnly} onChange={(e) => setWrongOnly(e.target.checked)} className="accent-brand-500" />
          {t('wrongOnly')}
        </label>
      </div>

      {attempt.parts.map((part) => {
        const qs = part.questions.filter((q) => (wrongOnly ? !q.isCorrect : true));
        if (qs.length === 0) return null;
        return (
          <section key={part.partId} className="mb-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="badge">Part {part.partNumber}</span>
              <span className="text-sm font-bold capitalize text-slate-400">{part.section}</span>
            </div>
            {qs.map((q) => {
              const correct = q.choices.find((c) => c.isCorrect);
              const chosen = q.choices.find((c) => c.id === q.selectedChoiceId);
              return (
                <div
                  key={q.id}
                  className={`card mb-3 border-l-4 p-5 ${q.isCorrect ? 'border-l-emerald-400' : 'border-l-rose-400'}`}
                >
                  <StimulusDisplay stimuli={q.stimuli} attemptId={attempt.id} mode="review" />
                  <p className="font-bold text-slate-800">
                    <Icon
                      name={q.isCorrect ? 'correct' : 'wrong'}
                      className={`mr-1.5 ${q.isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}
                    />
                    {q.questionText}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {t('yourAnswer')}:{' '}
                    <span className={`font-bold ${q.isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {chosen ? `${chosen.label}. ${chosen.choiceText}` : t('notAnswered')}
                    </span>
                  </p>
                  {!q.isCorrect && correct && (
                    <p className="mt-1 text-sm text-slate-500">
                      {t('correctAnswer')}:{' '}
                      <span className="font-bold text-emerald-600">
                        {correct.label}. {correct.choiceText}
                      </span>
                    </p>
                  )}
                  {q.explanationVi && (
                    <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-slate-700">
                      <span className="font-extrabold text-amber-700">
                        <Icon name="explanation" /> {t('explanation')}:{' '}
                      </span>
                      {q.explanationVi}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </AppLayout>
  );
}
