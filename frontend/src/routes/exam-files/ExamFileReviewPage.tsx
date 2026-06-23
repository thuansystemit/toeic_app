import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import {
  importExamFile,
  reviewExamFile,
  saveExamFileReview,
} from '../../api/examFiles.api';
import { listMyTests, listSkills } from '../../api/tests.api';
import type { StagedChoice, StagedQuestion } from '../../types/examFile';
import type { Skill, TestDto } from '../../types/test';

type Labels = 'A' | 'B' | 'C' | 'D';
const LABELS: Labels[] = ['A', 'B', 'C', 'D'];
const PARTS = [5, 6, 7];

/** Every question must carry exactly 4 choice slots A–D so a partially-extracted
 * question is always editable to a valid (importable) state. */
function normalizeChoices(choices: StagedChoice[]): StagedChoice[] {
  return LABELS.map(
    (label) =>
      choices.find((c) => c.label === label) ?? { label, text: '', isCorrect: false },
  );
}

function blankQuestion(part: number): StagedQuestion {
  return {
    part,
    questionText: '',
    choices: LABELS.map((label) => ({ label, text: '', isCorrect: false })),
    skills: [],
    passageText: null,
    groupId: null,
    explanationVi: null,
  };
}

/** A question is importable when its stem is set and all 4 choices are filled
 * (the backend rejects anything that isn't exactly 4 distinct A–D choices). */
function isComplete(q: StagedQuestion): boolean {
  return (
    q.questionText.trim() !== '' &&
    q.choices.length === 4 &&
    q.choices.every((c) => c.text.trim() !== '')
  );
}

export function ExamFileReviewPage() {
  const { t } = useTranslation(['examFiles', 'common', 'test']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<StagedQuestion[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<TestDto[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [testId, setTestId] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([reviewExamFile(id), listMyTests(), listSkills()])
      .then(([r, tests, skillList]) => {
        setQuestions(
          r.questions.map((q) => ({
            ...q,
            skills: q.skills ?? [],
            choices: normalizeChoices(q.choices),
          })),
        );
        setWarnings(r.warnings);
        setSkills(skillList);
        const draftTests = tests.filter((tt) => tt.status === 'draft');
        setDrafts(draftTests);
        if (draftTests[0]) setTestId(draftTests[0].id);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const patch = (i: number, fn: (q: StagedQuestion) => StagedQuestion) => {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? fn(q) : q)));
    setDirty(true);
  };

  const setCorrect = (i: number, label: Labels) =>
    patch(i, (q) => ({ ...q, choices: q.choices.map((c) => ({ ...c, isCorrect: c.label === label })) }));

  const setChoiceText = (i: number, label: Labels, text: string) =>
    patch(i, (q) => ({ ...q, choices: q.choices.map((c) => (c.label === label ? { ...c, text } : c)) }));

  const setPart = (i: number, part: number) => patch(i, (q) => ({ ...q, part }));

  const addSkill = (i: number, code: string) =>
    patch(i, (q) => ({ ...q, skills: [...(q.skills ?? []), code] }));

  const removeSkill = (i: number, code: string) =>
    patch(i, (q) => ({ ...q, skills: (q.skills ?? []).filter((s) => s !== code) }));

  const removeQuestion = (i: number) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, blankQuestion(prev[prev.length - 1]?.part ?? 5)]);
    setDirty(true);
  };

  const invalidCount = useMemo(
    () => questions.filter((q) => !isComplete(q)).length,
    [questions],
  );

  const doSave = async () => {
    if (!id) return;
    setMsg(null);
    setSaving(true);
    try {
      const res = await saveExamFileReview(id, questions);
      setWarnings(res.warnings);
      setDirty(false);
      setMsg({ text: t('savedChanges', { count: res.saved }), ok: true });
    } catch (e) {
      const ax = e as AxiosError<{ message: string }>;
      setMsg({ text: ax.response?.data?.message ?? (e as Error).message, ok: false });
    } finally {
      setSaving(false);
    }
  };

  const doImport = async () => {
    if (!id || !testId) return;
    setMsg(null);
    setImporting(true);
    try {
      const res = await importExamFile(id, testId, questions);
      setMsg({ text: t('importDone', { count: res.imported }), ok: true });
      setTimeout(() => navigate(`/authoring/${testId}`), 1200);
    } catch (e) {
      const ax = e as AxiosError<{ message: string }>;
      setMsg({ text: ax.response?.data?.message ?? (e as Error).message, ok: false });
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <AppLayout>{t('loading', { ns: 'common' })}</AppLayout>;

  return (
    <AppLayout>
      <Link to="/exam-files" className="text-sm font-bold text-brand-600 hover:underline">
        ← {t('title')}
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold text-slate-800">{t('reviewTitle')}</h1>
      <p className="text-slate-500">{t('reviewSubtitle', { count: questions.length })}</p>

      {warnings.length > 0 && (
        <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>{t('warnings')}:</strong> {warnings.join(', ')}
        </div>
      )}

      {/* import bar */}
      <div className="card sticky top-20 z-10 mt-5 flex flex-wrap items-center gap-3 p-4">
        <label className="text-sm font-bold text-slate-600">{t('targetTest')}</label>
        <select className="input max-w-xs" value={testId} onChange={(e) => setTestId(e.target.value)}>
          {drafts.length === 0 && <option value="">{t('noDraftTests')}</option>}
          {drafts.map((d) => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
        <button className="btn-ghost btn-sm" onClick={addQuestion}>
          + {t('addQuestion')}
        </button>
        {dirty && (
          <span className="text-xs font-semibold text-amber-600">
            {t('unsavedChanges')}
          </span>
        )}
        <button
          className="btn-soft ml-auto"
          disabled={saving || !dirty}
          onClick={doSave}
        >
          <Icon name={saving ? 'spinner' : 'save'} /> {t('saveChanges')}
        </button>
        <button
          className="btn-primary"
          disabled={importing || !testId || questions.length === 0 || invalidCount > 0}
          onClick={doImport}
        >
          <Icon name="extract" /> {t('importN', { count: questions.length })}
        </button>
      </div>
      {invalidCount > 0 && (
        <p className="mt-2 text-sm font-semibold text-rose-600">
          {t('fixChoices')} ({invalidCount})
        </p>
      )}
      {msg && (
        <p className={`mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
          {msg.text}
        </p>
      )}

      {/* questions */}
      <div className="mt-5 grid gap-4">
        {questions.map((q, i) => {
          const noCorrect = !q.choices.some((c) => c.isCorrect);
          const incomplete = !isComplete(q);
          const available = skills.filter((s) => !(q.skills ?? []).includes(s.code));
          return (
            <div key={i} className={`card p-5 ${incomplete ? 'ring-1 ring-rose-200' : ''}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <label className="text-xs font-bold text-slate-500">{t('partLabel')}</label>
                <select
                  className="input h-8 w-auto py-0 text-sm"
                  value={q.part}
                  onChange={(e) => setPart(i, Number(e.target.value))}
                >
                  {PARTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {q.groupId && <span className="badge-slate">{q.groupId}</span>}
                {noCorrect && <span className="badge bg-rose-100 text-rose-700">{t('noCorrectAnswer')}</span>}
                <button className="ml-auto btn-ghost btn-sm text-rose-600" onClick={() => removeQuestion(i)}>
                  <Icon name="trash" /> {t('remove')}
                </button>
              </div>

              {/* skill tags */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500">{t('skillsLabel')}:</span>
                {(q.skills ?? []).map((code) => (
                  <span key={code} className="badge bg-brand-50 text-brand-700">
                    {code}
                    <button
                      type="button"
                      className="ml-1 text-brand-400 hover:text-brand-700"
                      onClick={() => removeSkill(i, code)}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <select
                  className="input h-8 w-auto max-w-[16rem] py-0 text-xs"
                  value=""
                  onChange={(e) => e.target.value && addSkill(i, e.target.value)}
                >
                  <option value="">{t('addSkill')}</option>
                  {available.map((s) => (
                    <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>

              {q.passageText != null && (
                <textarea
                  className="input mb-2 bg-slate-50 text-xs"
                  rows={2}
                  value={q.passageText}
                  onChange={(e) => patch(i, (qq) => ({ ...qq, passageText: e.target.value }))}
                />
              )}
              <input
                className="input mb-2 font-semibold"
                value={q.questionText}
                onChange={(e) => patch(i, (qq) => ({ ...qq, questionText: e.target.value }))}
              />
              <div className="grid gap-2">
                {LABELS.map((label) => {
                  const choice = q.choices.find((c) => c.label === label)!;
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorrect(i, label)}
                        title={t('markCorrect', { ns: 'test' })}
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold transition ${
                          choice.isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                      <input
                        className="input"
                        value={choice.text}
                        onChange={(e) => setChoiceText(i, label, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
              <textarea
                className="input mt-2 text-sm"
                rows={1}
                placeholder={t('explanationVi', { ns: 'test' })}
                value={q.explanationVi ?? ''}
                onChange={(e) => patch(i, (qq) => ({ ...qq, explanationVi: e.target.value }))}
              />
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
