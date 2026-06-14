import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { createTest, deleteTest, listMyTests } from '../../api/tests.api';
import type { TestDto } from '../../types/test';
import { Icon } from '../../components/Icon';

export function AuthoringListPage() {
  const { t } = useTranslation(['test', 'common']);
  const [tests, setTests] = useState<TestDto[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(120);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => listMyTests().then(setTests);
  useEffect(() => {
    void load();
  }, []);

  const onDelete = async (test: TestDto) => {
    if (!confirm(t('deleteTestConfirm', { title: test.title }))) return;
    setDeletingId(test.id);
    try {
      await deleteTest(test.id);
      await load();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? t('deleteTestFailed');
      alert(message);
    } finally {
      setDeletingId(null);
    }
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createTest({ title, description: description || undefined, timeLimitMinutes: timeLimit });
      setTitle('');
      setDescription('');
      await load();
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppLayout>
      <h1 className="text-2xl font-extrabold text-slate-800">{t('authoringTitle')}</h1>
      <p className="mb-6 mt-1 text-slate-500">{t('authoringSubtitle')}</p>

      <form onSubmit={onCreate} className="card mb-6 flex flex-wrap items-end gap-3 p-5">
        <label className="label flex-1">
          {t('newTitle')}
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>
        <label className="label flex-[2]">
          {t('newDescription')}
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </label>
        <label className="label w-28">
          {t('newTimeLimit')}
          <input className="input" type="number" min={1} value={timeLimit} onChange={(e) => setTimeLimit(parseInt(e.target.value, 10) || 1)} />
        </label>
        <button disabled={creating} type="submit" className="btn-primary">
          + {t('createTest')}
        </button>
      </form>

      {tests.length === 0 ? (
        <div className="card grid place-items-center gap-2 p-12 text-center">
          <Icon name="author" className="text-4xl text-brand-400" />
          <p className="font-semibold text-slate-500">{t('noTestsYet')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tests.map((test) => (
            <div
              key={test.id}
              className="card flex items-center justify-between p-4 transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <Link to={`/authoring/${test.id}`} className="flex flex-1 items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl text-brand-600">
                  <Icon name="tests" />
                </span>
                <div>
                  <div className="font-bold text-slate-800">{test.title}</div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Icon name="timer" /> {test.timeLimitMinutes} min
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <span className={test.status === 'published' ? 'badge-green' : 'badge-slate'}>
                  {test.status === 'published' ? t('statusPublished') : t('statusDraft')}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(test)}
                  disabled={deletingId === test.id}
                  aria-label={t('delete')}
                  title={t('delete')}
                  className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Icon name={deletingId === test.id ? 'spinner' : 'trash'} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
