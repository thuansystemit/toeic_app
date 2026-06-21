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
  getQuestionSkills,
  listSkills,
  publishPart,
  publishTest,
  setQuestionSkills,
  setSampleTest,
  unpublishPart,
  unpublishTest,
  updateQuestion,
} from '../../api/tests.api';
import type {
  MediaStimulusInput,
  NewQuestionInput,
  PartSummary,
  QuestionSkillsMap,
  QuestionSkillTag,
  Skill,
  StimulusDto,
  TestDto,
} from '../../types/test';
import { fileUrl, uploadFile } from '../../api/files.api';
import { Icon } from '../../components/Icon';
import { TestPreview } from './TestPreview';

type Labels = 'A' | 'B' | 'C' | 'D';
const LABELS: Labels[] = ['A', 'B', 'C', 'D'];

export function TestEditorPage() {
  const { t } = useTranslation(['test', 'common']);
  const { testId } = useParams<{ testId: string }>();
  const [test, setTest] = useState<TestDto | null>(null);
  const [summaries, setSummaries] = useState<PartSummary[]>([]);
  const [openPart, setOpenPart] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  // Parts are collapsed by default (a full test has 7 parts, Part 7 alone has
  // 50+ questions); expand the ones you're working on.
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());

  const toggleExpand = (partId: string) =>
    setExpandedParts((prev) => {
      const next = new Set(prev);
      next.has(partId) ? next.delete(partId) : next.add(partId);
      return next;
    });
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [questionSkills, setQuestionSkillsState] = useState<QuestionSkillsMap>({});

  const load = async () => {
    if (!testId) return;
    setTest(await getAuthoringView(testId));
    setSummaries(await getPartSummaries(testId));
    setQuestionSkillsState(await getQuestionSkills(testId));
  };
  useEffect(() => {
    listSkills().then(setSkills).catch(() => undefined);
  }, []);

  const onTagSkills = async (partId: string, questionId: string, skillIds: string[]) => {
    if (!testId) return;
    await setQuestionSkills(testId, partId, questionId, skillIds);
    setQuestionSkillsState(await getQuestionSkills(testId));
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

  const onSetSample = async () => {
    if (!testId) return;
    await setSampleTest(testId);
    await load();
  };

  const onPublishPart = async (partId: string) => {
    if (!testId) return;
    setMsg(null);
    try {
      await publishPart(testId, partId);
      await load();
    } catch (e) {
      setMsg({ text: (e as AxiosError<{ message: string }>).response?.data?.message ?? 'Error', ok: false });
    }
  };

  const onUnpublishPart = async (partId: string) => {
    if (!testId) return;
    await unpublishPart(testId, partId);
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
          <button onClick={() => setPreviewing(true)} className="btn-soft btn-sm">
            <Icon name="reviewList" /> {t('preview')}
          </button>
          {test.status === 'draft' ? (
            <button onClick={onPublish} className="btn-primary btn-sm">
              {t('publish')}
            </button>
          ) : (
            <>
              {test.isSample ? (
                <span className="badge-green">{t('publicSample')}</span>
              ) : (
                <button onClick={onSetSample} className="btn-soft btn-sm">
                  {t('setSample')}
                </button>
              )}
              <button onClick={onUnpublish} className="btn-ghost btn-sm">
                {t('unpublish')}
              </button>
            </>
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

      <SkillCoverage questionSkills={questionSkills} />

      <div className="mt-5 grid gap-3">
        {test.parts
          ?.slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((part) => {
            const count = countFor(part.id);
            const partDraft = part.status === 'draft';
            const isExpanded = expandedParts.has(part.id);
            return (
              <div key={part.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 font-extrabold text-brand-700">
                    {part.partNumber}
                  </span>
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-3 text-left"
                    onClick={() => toggleExpand(part.id)}
                    aria-expanded={isExpanded}
                  >
                    <Icon
                      name="chevronDown"
                      className={`text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                    />
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-800">{t('part', { n: part.partNumber })}</span>
                      <span className="block text-xs font-semibold capitalize text-slate-400">
                        {part.section} · {t('questionsCount', { count })}
                      </span>
                    </span>
                  </button>
                  <span className={partDraft ? 'badge-slate' : 'badge-green'}>
                    {partDraft ? t('statusDraft') : t('statusPublished')}
                  </span>
                  {partDraft ? (
                    <>
                      <button
                        className="btn-soft btn-sm"
                        onClick={() => {
                          setEditing(null);
                          const opening = openPart !== part.id;
                          setOpenPart(opening ? part.id : null);
                          // Opening the add form must reveal the part body.
                          if (opening) setExpandedParts((prev) => new Set(prev).add(part.id));
                        }}
                      >
                        {openPart === part.id ? t('cancel', { ns: 'common' }) : `+ ${t('addQuestion')}`}
                      </button>
                      <button
                        className="btn-primary btn-sm"
                        disabled={count === 0}
                        title={count === 0 ? t('publishPartEmpty') : undefined}
                        onClick={() => onPublishPart(part.id)}
                      >
                        {t('publishPart')}
                      </button>
                    </>
                  ) : (
                    <button className="btn-ghost btn-sm" onClick={() => onUnpublishPart(part.id)}>
                      {t('unpublishPart')}
                    </button>
                  )}
                </div>

                {/* existing questions */}
                {isExpanded && (part.questions?.length ?? 0) > 0 && (
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
                                {correct ? (
                                  <div className="text-xs text-slate-400">
                                    {t('correctAnswerLabel')}: {correct.label}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs font-bold text-rose-600">
                                    <Icon name="wrong" /> {t('previewMissingAnswer')}
                                  </div>
                                )}
                              </div>
                              {partDraft && (
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
                            <SkillTags
                              catalog={skills}
                              tags={questionSkills[q.id] ?? []}
                              onChange={(ids) => onTagSkills(part.id, q.id, ids)}
                            />
                            {isEditing && (
                              <QuestionForm
                                partNumber={part.partNumber}
                                stimuli={q.stimuli}
                                initial={{
                                  questionText: q.questionText ?? '',
                                  explanationVi: q.explanationVi ?? '',
                                  passageText:
                                    q.stimuli?.find((s) => s.type === 'passage')?.passageText ?? '',
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
                                    passageText: input.passageText,
                                    choices: input.choices,
                                    media: input.media,
                                  })
                                }
                              />
                            )}
                          </li>
                        );
                      })}
                  </ul>
                )}

                {isExpanded && openPart === part.id && (
                  <QuestionForm
                    partNumber={part.partNumber}
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

      {previewing && <TestPreview test={test} onClose={() => setPreviewing(false)} />}
    </AppLayout>
  );
}

/** Skill tags for one question: chips + an add-picker (knowledge-graph Phase 1). */
function SkillTags({
  catalog,
  tags,
  onChange,
}: {
  catalog: Skill[];
  tags: QuestionSkillTag[];
  onChange: (skillIds: string[]) => Promise<void>;
}) {
  const { t } = useTranslation(['test']);
  const [busy, setBusy] = useState(false);
  const current = tags.map((s) => s.skillId);
  const available = catalog.filter((s) => !current.includes(s.id));

  const apply = async (ids: string[]) => {
    setBusy(true);
    try {
      await onChange(ids);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-slate-400">{t('skills')}:</span>
      {tags.length === 0 && (
        <span className="text-xs text-slate-300">{t('noSkills')}</span>
      )}
      {tags.map((s) => (
        <span
          key={s.skillId}
          title={s.name}
          className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700"
        >
          {s.code}
          <button
            type="button"
            disabled={busy}
            onClick={() => apply(current.filter((id) => id !== s.skillId))}
            className="text-brand-400 hover:text-rose-500"
            aria-label={`remove ${s.code}`}
          >
            ×
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <select
          value=""
          disabled={busy}
          onChange={(e) => e.target.value && apply([...current, e.target.value])}
          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500"
        >
          <option value="">+ {t('addSkill')}</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Skill-coverage summary across the whole test (verification at a glance). */
function SkillCoverage({ questionSkills }: { questionSkills: QuestionSkillsMap }) {
  const { t } = useTranslation(['test']);
  const counts = new Map<string, { name: string; n: number }>();
  for (const tags of Object.values(questionSkills)) {
    for (const s of tags) {
      const e = counts.get(s.code) ?? { name: s.name, n: 0 };
      e.n += 1;
      counts.set(s.code, e);
    }
  }
  const rows = [...counts.entries()].sort((a, b) => b[1].n - a[1].n);

  return (
    <div className="card mt-4 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">
        <Icon name="results" /> {t('skillCoverage')}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">{t('noSkillsTagged')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {rows.map(([code, { name, n }]) => (
            <span
              key={code}
              title={name}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600"
            >
              {code} <span className="text-brand-600">×{n}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface QuestionInitial {
  questionText: string;
  explanationVi: string;
  passageText: string;
  choices: Record<Labels, string>;
  correct: Labels;
}

function QuestionForm({
  onSubmit,
  onSaved,
  initial,
  partNumber,
  stimuli,
}: {
  onSubmit: (input: NewQuestionInput) => Promise<void>;
  onSaved: () => void;
  initial?: QuestionInitial;
  partNumber: number;
  stimuli?: StimulusDto[];
}) {
  const { t } = useTranslation(['test']);
  // Part 1 = photo + audio; Part 2 = audio; Parts 6/7 = passage.
  const allowImage = partNumber === 1;
  const allowAudio = partNumber === 1 || partNumber === 2;
  const allowPassage = partNumber === 6 || partNumber === 7;
  // Part 6 is text completion: start authors from a standard business-document
  // layout (4 blanks) instead of an empty box. Part 7 keeps the free passage.
  const isPart6 = partNumber === 6;
  const currentImage = stimuli?.find((s) => s.type === 'image');
  const currentAudio = stimuli?.find((s) => s.type === 'audio');
  const [questionText, setQuestionText] = useState(initial?.questionText ?? '');
  const [explanationVi, setExplanationVi] = useState(initial?.explanationVi ?? '');
  const [choices, setChoices] = useState<Record<Labels, string>>(
    initial?.choices ?? { A: '', B: '', C: '', D: '' },
  );
  const [correct, setCorrect] = useState<Labels>(initial?.correct ?? 'A');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  // Pre-fill the passage from the existing question when editing; otherwise seed
  // Part 6 with the standard template so new questions start from a layout.
  const [passageText, setPassageText] = useState(
    initial?.passageText || (isPart6 ? t('passage6Template') : ''),
  );
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
        // For passage parts send the value as-is (even empty) so editing — and
        // clearing — the passage persists; other parts never carry a passage.
        passageText: allowPassage ? passageText : undefined,
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
      {(allowImage || allowAudio || allowPassage) && (
        <div className="grid gap-3 rounded-2xl bg-amber-50 p-4 sm:grid-cols-2">
          {allowImage && (
            <label className="label">
              <span>
                <Icon name="image" /> {t('imageStimulus')}
              </span>
              {currentImage?.storageKey && (
                <a className="text-xs font-semibold text-brand-600 underline" href={fileUrl(currentImage.storageKey)} target="_blank" rel="noreferrer">
                  {currentImage.originalFilename ?? t('currentFile')}
                </a>
              )}
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="text-sm" />
            </label>
          )}
          {allowAudio && (
            <label className="label">
              <span>
                <Icon name="audio" /> {t('audioStimulus')}
              </span>
              {currentAudio?.storageKey && (
                <a className="text-xs font-semibold text-brand-600 underline" href={fileUrl(currentAudio.storageKey)} target="_blank" rel="noreferrer">
                  {currentAudio.originalFilename ?? t('currentFile')}
                </a>
              )}
              <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} className="text-sm" />
            </label>
          )}
          {allowPassage && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <textarea
                className="input font-mono text-sm"
                placeholder={t('passageOptional')}
                value={passageText}
                onChange={(e) => setPassageText(e.target.value)}
                rows={isPart6 ? 12 : 2}
              />
              {isPart6 && <p className="text-xs font-semibold text-slate-400">{t('passage6Hint')}</p>}
            </div>
          )}
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
