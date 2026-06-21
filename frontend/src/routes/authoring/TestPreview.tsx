import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fileUrl } from '../../api/files.api';
import { Icon } from '../../components/Icon';
import type { QuestionDto, StimulusDto, TestDto } from '../../types/test';

/**
 * Read-only author preview of a test before publishing. Renders the test the
 * way a learner sees it (parts → stimuli → questions → choices) but reveals the
 * correct answer and Vietnamese explanation to the author. No attempt is
 * created and audio is freely replayable (no exam play-once rule).
 */
export function TestPreview({ test, onClose }: { test: TestDto; onClose: () => void }) {
  const { t } = useTranslation(['test', 'common']);

  // Close on Escape for a modal-like feel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parts = (test.parts ?? []).slice().sort((a, b) => a.partNumber - b.partNumber);

  return (
    <div
      className="fixed inset-0 z-50 flex bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="mx-auto flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold text-slate-800">{test.title}</h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-600">
              <Icon name="explanation" /> {t('previewNote')}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm shrink-0">
            {t('done', { ns: 'common' })}
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {parts.map((part) => {
            const qs = (part.questions ?? []).slice().sort((a, b) => a.sequence - b.sequence);
            const missing = qs.filter((q) => !q.choices.some((c) => c.isCorrect)).length;
            return (
              <section key={part.id} className="mb-8 last:mb-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 font-extrabold text-brand-700">
                    {part.partNumber}
                  </span>
                  <h3 className="font-bold text-slate-800">{t('part', { n: part.partNumber })}</h3>
                  <span className="text-xs font-semibold capitalize text-slate-400">
                    {part.section} · {t('questionsCount', { count: qs.length })}
                  </span>
                  <span className={part.status === 'published' ? 'badge-green' : 'badge-slate'}>
                    {part.status === 'published' ? t('statusPublished') : t('statusDraft')}
                  </span>
                  {missing > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">
                      <Icon name="wrong" /> {t('previewMissingCount', { count: missing })}
                    </span>
                  )}
                </div>
                {qs.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('previewEmptyPart')}</p>
                ) : (
                  <ol className="flex flex-col gap-5">
                    {qs.map((q, i) => (
                      <PreviewQuestion key={q.id} q={q} index={i + 1} />
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PreviewStimulus({ s }: { s: StimulusDto }) {
  if (s.type === 'image' && s.storageKey) {
    return (
      <img
        src={fileUrl(s.storageKey)}
        alt="question stimulus"
        className="max-h-80 w-full rounded-2xl border border-slate-100 object-contain"
      />
    );
  }
  if (s.type === 'audio' && s.storageKey) {
    // Plain controls — the author may replay freely (no exam play-once rule).
    return <audio controls src={fileUrl(s.storageKey)} className="w-full" />;
  }
  if (s.type === 'passage' && s.passageText) {
    return (
      <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        {s.passageText}
      </div>
    );
  }
  return null;
}

function PreviewQuestion({ q, index }: { q: QuestionDto; index: number }) {
  const { t } = useTranslation(['test']);
  const stimuli = (q.stimuli ?? []).filter(Boolean);
  const choices = q.choices.slice().sort((a, b) => a.label.localeCompare(b.label));
  const hasCorrect = choices.some((c) => c.isCorrect);

  return (
    <li
      className={`rounded-2xl border p-4 ${
        hasCorrect ? 'border-slate-100' : 'border-rose-200 bg-rose-50/40'
      }`}
    >
      {stimuli.length > 0 && (
        <div className="mb-3 flex flex-col gap-3">
          {stimuli.map((s) => (
            <PreviewStimulus key={s.id} s={s} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        <span className="text-sm font-extrabold text-slate-400">{index}.</span>
        <p className="flex-1 text-sm font-semibold text-slate-800">
          {q.questionText || <span className="text-slate-300">—</span>}
        </p>
        {!hasCorrect && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">
            <Icon name="wrong" /> {t('previewMissingAnswer')}
          </span>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {choices.map((c) => (
          <li
            key={c.id}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
              c.isCorrect
                ? 'border-emerald-200 bg-emerald-50 font-semibold text-emerald-800'
                : 'border-slate-100 text-slate-600'
            }`}
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold ${
                c.isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {c.label}
            </span>
            <span className="min-w-0 flex-1">{c.choiceText || '—'}</span>
            {c.isCorrect && <Icon name="correct" className="text-emerald-500" />}
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        <span className="font-bold">{t('explanationVi')}: </span>
        {q.explanationVi || <span className="text-amber-500">{t('previewNoExplanation')}</span>}
      </div>
    </li>
  );
}
