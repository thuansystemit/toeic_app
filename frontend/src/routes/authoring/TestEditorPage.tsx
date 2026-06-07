import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { AppLayout } from '../../components/AppLayout';
import {
  addQuestion,
  deleteQuestion,
  getAuthoringView,
  getPartSummaries,
  publishTest,
  unpublishTest,
  updateQuestion,
} from '../../api/tests.api';
import type { MediaStimulusInput, NewQuestionInput, PartSummary, TestDto } from '../../types/test';
import { uploadFile } from '../../api/files.api';
import { Icon } from '../../components/Icon';

type Labels = 'A' | 'B' | 'C' | 'D';
const LABELS: Labels[] = ['A', 'B', 'C', 'D'];

export function TestEditorPage() {
  const { t } = useTranslation(['test', 'common']);
  const { testId } = useParams<{ testId: string }>();
  const [test, setTest] = useState<TestDto | null>(null);
  const [summaries, setSummaries] = useState<PartSummary[]>([]);
  const [openPart, setOpenPart] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = async () => {
    if (!testId) return;
    setTest(await getAuthoringView(testId));
    setSummaries(await getPartSummaries(testId));
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const onPublish = async () => {
    if (!testId) return;
    setMsg(null);
    try {
      await publishTest(testId);
      setMsg({ text: t('publishOk'), ok: true });
      await load();
    } catch (e) {
      setMsg({ text: (e as AxiosError<{ message: string }>).response?.data?.message ?? 'Error', ok: false });
    }
  };

  const onUnpublish = async () => {
    if (!testId) return;
    await unpublishTest(testId);
    await load();
  };

  if (!test) return <AppLayout>{t('loading', { ns: 'common' })}</AppLayout>;

  const countFor = (partId: string) => summaries.find((s) => s.partId === partId)?.count ?? 0;

  return (
    <AppLayout>
      <Link to="/authoring" className="text-sm font-bold text-brand-600 hover:underline">
        ← {t('authoringTitle')}
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-800">{test.title}</h1>
        <div className="flex items-center gap-2">
          <span className={test.status === 'published' ? 'badge-green' : 'badge-slate'}>
            {test.status === 'published' ? t('statusPublished') : t('statusDraft')}
          </span>
          {test.status === 'draft' ? (
            <button onClick={onPublish} className="btn-primary btn-sm">
              {t('publish')}
            </button>
          ) : (
            <button onClick={onUnpublish} className="btn-ghost btn-sm">
              {t('unpublish')}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <p
          className={`mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ${
            msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {test.parts
          ?.slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((part) => {
            const count = countFor(part.id);
            return (
              <div key={part.id} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 font-extrabold text-brand-700">
                    {part.partNumber}
                  </span>
                  <div className="flex-1">
                    <div className="font-bold text-slate-800">{t('part', { n: part.partNumber })}</div>
                    <div className="text-xs font-semibold capitalize text-slate-400">
                      {part.section} · {t('questionsCount', { count })}
                    </div>
                  </div>
                  {test.status === 'draft' && (
                    <button
                      className="btn-soft btn-sm"
                      onClick={() => {
                        setEditing(null);
                        setOpenPart(openPart === part.id ? null : part.id);
                      }}
                    >
                      {openPart === part.id ? t('cancel', { ns: 'common' }) : `+ ${t('addQuestion')}`}
                    </button>
                  )}
                </div>

                {/* existing questions */}
                {(part.questions?.length ?? 0) > 0 && (
                  <ul className="mt-4 flex flex-col gap-2">
                    {part.questions!
                      .slice()
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((q, idx) => {
                        const correct = q.choices.find((c) => c.isCorrect);
                        const isEditing = editing === q.id;
                        return (
                          <li key={q.id} className="rounded-2xl border border-slate-100 p-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-extrabold text-slate-400">
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-slate-700">
                                  {q.questionText || <span className="text-slate-400">—</span>}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {t('correctAnswerLabel')}: {correct?.label ?? '?'}
                                </div>
                              </div>
                              {test.status === 'draft' && (
                                <div className="flex gap-1">
                                  <button
                                    className="btn-ghost btn-sm"
                                    onClick={() => {
                                      setOpenPart(null);
                                      setEditing(isEditing ? null : q.id);
                                    }}
                                  >
                                    {isEditing ? t('cancel', { ns: 'common' }) : t('edit')}
                                  </button>
                                  <button
                                    className="btn-ghost btn-sm text-rose-600"
                                    onClick={async () => {
                                      if (!confirm(t('deleteConfirm'))) return;
                                      await deleteQuestion(test.id, part.id, q.id);
                                      await load();
                                    }}
                                  >
                                    {t('delete')}
                                  </button>
                                </div>
                              )}
                            </div>
                            {isEditing && (
                              <QuestionForm
                                initial={{
                                  questionText: q.questionText ?? '',
                                  explanationVi: q.explanationVi ?? '',
                                  choices: {
                                    A: q.choices.find((c) => c.label === 'A')?.choiceText ?? '',
                                    B: q.choices.find((c) => c.label === 'B')?.choiceText ?? '',
                                    C: q.choices.find((c) => c.label === 'C')?.choiceText ?? '',
                                    D: q.choices.find((c) => c.label === 'D')?.choiceText ?? '',
                                  },
                                  correct: (correct?.label as Labels) ?? 'A',
                                }}
                                onSaved={async () => {
                                  setEditing(null);
                                  await load();
                                }}
                                onSubmit={(input) =>
                                  updateQuestion(test.id, part.id, q.id, {
                                    questionText: input.questionText,
                                    explanationVi: input.explanationVi,
                                    choices: input.choices,
                                  })
                                }
                              />
                            )}
                          </li>
                        );
                      })}
                  </ul>
                )}

                {openPart === part.id && (
                  <QuestionForm
                    onSaved={async () => {
                      setOpenPart(null);
                      await load();
                    }}
                    onSubmit={(input) => addQuestion(test.id, part.id, input)}
                  />
                )}
              </div>
            );
          })}
      </div>
    </AppLayout>
  );
}

interface QuestionInitial {
  questionText: string;
  explanationVi: string;
  choices: Record<Labels, string>;
  correct: Labels;
}

function QuestionForm({
  onSubmit,
  onSaved,
  initial,
}: {
  onSubmit: (input: NewQuestionInput) => Promise<void>;
  onSaved: () => void;
  initial?: QuestionInitial;
}) {
  const { t } = useTranslation(['test']);
  const isEdit = !!initial;
  const [questionText, setQuestionText] = useState(initial?.questionText ?? '');
  const [explanationVi, setExplanationVi] = useState(initial?.explanationVi ?? '');
  const [choices, setChoices] = useState<Record<Labels, string>>(
    initial?.choices ?? { A: '', B: '', C: '', D: '' },
  );
  const [correct, setCorrect] = useState<Labels>(initial?.correct ?? 'A');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [passageText, setPassageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const media: MediaStimulusInput[] = [];
      if (imageFile) {
        const up = await uploadFile(imageFile, 'image');
        media.push({ type: 'image', storageKey: up.storageKey, originalFilename: up.originalFilename, mimeType: up.mimeType });
      }
      if (audioFile) {
        const up = await uploadFile(audioFile, 'audio');
        media.push({ type: 'audio', storageKey: up.storageKey, originalFilename: up.originalFilename, mimeType: up.mimeType });
      }
      await onSubmit({
        questionText,
        explanationVi: explanationVi || undefined,
        passageText: passageText || undefined,
        media: media.length ? media : undefined,
        choices: LABELS.map((label) => ({ label, choiceText: choices[label], isCorrect: label === correct })),
      });
      onSaved();
    } catch (e) {
      const ax = e as AxiosError<{ message: string }>;
      setError(ax.response?.data?.message ?? (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-dashed border-slate-200 pt-4">
      {!isEdit && (
        <div className="grid gap-3 rounded-2xl bg-amber-50 p-4 sm:grid-cols-2">
          <label className="label">
            <span>
              <Icon name="image" /> {t('imageStimulus')}
            </span>
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </label>
          <label className="label">
            <span>
              <Icon name="audio" /> {t('audioStimulus')}
            </span>
            <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </label>
          <textarea
            className="input sm:col-span-2"
            placeholder={t('passageOptional')}
            value={passageText}
            onChange={(e) => setPassageText(e.target.value)}
            rows={2}
          />
        </div>
      )}

      <label className="label">
        {t('questionText')}
        <input className="input" value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
      </label>

      <div className="grid gap-2">
        {LABELS.map((label) => (
          <div key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrect(label)}
              title={t('correct')}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold transition ${
                correct === label ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
            <input
              className="input"
              placeholder={t('choice', { label })}
              value={choices[label]}
              onChange={(e) => setChoices((prev) => ({ ...prev, [label]: e.target.value }))}
            />
          </div>
        ))}
        <p className="flex items-center gap-1 text-xs font-semibold text-slate-400">
          <Icon name="correct" className="text-emerald-500" /> {t('markCorrectHint')}
        </p>
      </div>

      <label className="label">
        {t('explanationVi')}
        <textarea className="input" value={explanationVi} onChange={(e) => setExplanationVi(e.target.value)} rows={2} />
      </label>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
      <button disabled={saving} onClick={submit} className="btn-primary self-start">
        {saving ? t('loading', { ns: 'common' }) : t('saveQuestion')}
      </button>
    </div>
  );
}
