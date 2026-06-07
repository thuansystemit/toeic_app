import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getAttempt,
  saveAnswer,
  submitAttempt,
  type AnswerFeedback,
} from '../../api/attempts.api';
import type { AttemptQuestion, AttemptView } from '../../types/attempt';
import { StimulusDisplay } from '../../components/StimulusDisplay';
import { Icon } from '../../components/Icon';

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = sec.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

interface FlatQ {
  q: AttemptQuestion;
  number: number;
  partNumber: number;
  section: string;
}

export function ExamRunnerPage() {
  const { t } = useTranslation(['exam', 'common']);
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, AnswerFeedback>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const flat = useMemo<FlatQ[]>(() => {
    if (!attempt) return [];
    let n = 0;
    const out: FlatQ[] = [];
    for (const p of attempt.parts) {
      for (const q of p.questions) {
        n += 1;
        out.push({ q, number: n, partNumber: p.partNumber, section: p.section });
      }
    }
    return out;
  }, [attempt]);

  useEffect(() => {
    if (!attemptId) return;
    getAttempt(attemptId).then((a) => {
      if (a.status !== 'in-progress') {
        navigate(`/results/${a.id}`, { replace: true });
        return;
      }
      setAttempt(a);
      setRemaining(a.timeRemainingSeconds);
      const initial: Record<string, string> = {};
      a.parts.flatMap((p) => p.questions).forEach((q) => {
        if (q.selectedChoiceId) initial[q.id] = q.selectedChoiceId;
      });
      setSelected(initial);
    });
  }, [attemptId, navigate]);

  const doSubmit = useCallback(
    async (auto: boolean) => {
      if (!attemptId || submittedRef.current) return;
      if (!auto) {
        const unanswered = flat.filter((f) => !selected[f.q.id]).length;
        const message =
          unanswered > 0
            ? t('submitWarnUnanswered', { count: unanswered })
            : t('submitConfirm');
        if (!confirm(message)) return;
      }
      submittedRef.current = true;
      setSubmitting(true);
      try {
        await submitAttempt(attemptId);
      } finally {
        navigate(`/results/${attemptId}`, { replace: true });
      }
    },
    [attemptId, navigate, t, flat, selected],
  );

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      void doSubmit(true);
      return;
    }
    const id = setInterval(() => setRemaining((p) => (p === null ? null : p - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining, doSubmit]);

  const choose = async (question: AttemptQuestion, choiceId: string) => {
    if (selected[question.id] === choiceId) return;
    setSelected((prev) => ({ ...prev, [question.id]: choiceId }));
    try {
      const res = await saveAnswer(attempt!.id, question.id, choiceId);
      // US-004: practice mode returns instant feedback.
      if (res.feedback) {
        setFeedback((prev) => ({ ...prev, [question.id]: res.feedback! }));
      }
    } catch {
      if (attemptId) {
        const fresh = await getAttempt(attemptId);
        if (fresh.status !== 'in-progress') navigate(`/results/${fresh.id}`, { replace: true });
      }
    }
  };

  const jump = (number: number) => {
    document.getElementById(`q-${number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!attempt) {
    return <div className="grid min-h-screen place-items-center text-slate-400">{t('loading', { ns: 'common' })}</div>;
  }

  const answeredCount = flat.filter((f) => selected[f.q.id]).length;
  const total = flat.length;
  const low = remaining !== null && remaining < 300;

  return (
    <div className="min-h-screen">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate font-extrabold text-slate-800">{attempt.testTitle}</p>
            <span className="badge mt-0.5">
              <Icon name={attempt.mode === 'full' ? 'full' : 'practice'} />
              {attempt.mode === 'full' ? t('fullMode') : t('practiceMode')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {attempt.mode === 'full' && remaining !== null && (
              <span
                className={`rounded-xl px-3 py-2 text-sm font-extrabold tabular-nums ${
                  low ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Icon name="timer" /> {formatTime(remaining)}
              </span>
            )}
            <button disabled={submitting} onClick={() => doSubmit(false)} className="btn-primary">
              {t('submit')}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-5 py-6">
        {/* questions */}
        <div className="min-w-0 flex-1">
          {attempt.parts.map((part) => (
            <section key={part.partId} className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="badge">Part {part.partNumber}</span>
                <span className="text-sm font-bold capitalize text-slate-400">{part.section}</span>
              </div>
              {part.questions.map((q) => {
                const fq = flat.find((f) => f.q.id === q.id)!;
                return (
                  <div key={q.id} id={`q-${fq.number}`} className="card mb-4 scroll-mt-24 p-5">
                    <StimulusDisplay
                      stimuli={q.stimuli}
                      attemptId={attempt.id}
                      mode={attempt.mode}
                    />
                    <p className="mb-3 font-bold text-slate-800">
                      <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-lg bg-brand-100 text-xs text-brand-700">
                        {fq.number}
                      </span>
                      {q.questionText}
                    </p>
                    <div className="grid gap-2">
                      {q.choices.map((c) => {
                        const isSel = selected[q.id] === c.id;
                        const fb = feedback[q.id];
                        // Practice instant feedback colors (US-004).
                        const isCorrectChoice = fb && fb.correctChoiceId === c.id;
                        const isWrongPick = fb && isSel && !fb.isCorrect;
                        let cls =
                          'border-slate-100 bg-white hover:border-brand-200';
                        let badge = 'bg-slate-100 text-slate-500';
                        if (isCorrectChoice) {
                          cls = 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-800';
                          badge = 'bg-emerald-500 text-white';
                        } else if (isWrongPick) {
                          cls = 'border-rose-300 bg-rose-50 font-semibold text-rose-800';
                          badge = 'bg-rose-500 text-white';
                        } else if (isSel) {
                          cls = 'border-brand-400 bg-brand-50 font-semibold text-brand-800';
                          badge = 'bg-brand-500 text-white';
                        }
                        return (
                          <button
                            key={c.id}
                            onClick={() => choose(q, c.id)}
                            className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm transition ${cls}`}
                          >
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${badge}`}>
                              {c.label}
                            </span>
                            {c.choiceText}
                          </button>
                        );
                      })}
                    </div>
                    {feedback[q.id] && (
                      <div
                        className={`mt-3 rounded-2xl p-3 text-sm ${
                          feedback[q.id].isCorrect
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        <span className="font-extrabold">
                          <Icon name={feedback[q.id].isCorrect ? 'correct' : 'wrong'} />{' '}
                          {feedback[q.id].isCorrect ? t('feedbackCorrect') : t('feedbackWrong')}
                        </span>
                        {feedback[q.id].explanationVi && (
                          <div className="mt-1 text-slate-600">
                            <Icon name="explanation" className="text-amber-500" />{' '}
                            {feedback[q.id].explanationVi}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        {/* navigator */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="card sticky top-24 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-700">{t('navigator')}</span>
              <span className="text-xs font-bold text-brand-600">
                {answeredCount}/{total}
              </span>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-400 transition-all"
                style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }}
              />
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {flat.map((f) => {
                const done = !!selected[f.q.id];
                return (
                  <button
                    key={f.q.id}
                    onClick={() => jump(f.number)}
                    className={`grid h-8 place-items-center rounded-lg text-xs font-bold transition ${
                      done
                        ? 'bg-brand-500 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-brand-100'
                    }`}
                  >
                    {f.number}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded bg-brand-500" /> {t('done')}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded bg-slate-200" /> {t('todo')}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
