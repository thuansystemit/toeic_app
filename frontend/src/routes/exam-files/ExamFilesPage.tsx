import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { listExamFiles, uploadExamFile } from '../../api/examFiles.api';
import type { ExamFile, ExamFileStatus } from '../../types/examFile';

const BUSY: ExamFileStatus[] = ['uploaded', 'queued', 'extracting'];

function StatusBadge({ status }: { status: ExamFileStatus }) {
  const { t } = useTranslation('examFiles');
  const map: Record<ExamFileStatus, string> = {
    uploaded: 'badge-slate',
    queued: 'badge',
    extracting: 'badge',
    extracted: 'badge-green',
    failed: 'badge bg-rose-100 text-rose-700',
    imported: 'badge-slate',
  };
  const spin = status === 'queued' || status === 'extracting';
  return (
    <span className={map[status]}>
      {spin && <Icon name="spinner" />} {t(`status_${status}`)}
    </span>
  );
}

export function ExamFilesPage() {
  const { t } = useTranslation(['examFiles', 'common']);
  const [files, setFiles] = useState<ExamFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [part, setPart] = useState(5); // reading parts 5-7; upload one part per file
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    const list = await listExamFiles();
    setFiles(list);
    return list;
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  // Poll while any file is still being processed.
  useEffect(() => {
    if (!files.some((f) => BUSY.includes(f.status))) return;
    const id = setInterval(() => {
      load().catch(() => undefined);
    }, 3000);
    return () => clearInterval(id);
  }, [files]);

  const onPick = () => inputRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await uploadExamFile(file, part);
      await load();
    } catch (e) {
      const ax = e as AxiosError<{ message: string }>;
      setError(ax.response?.data?.message ?? (e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <AppLayout>
      <h1 className="text-2xl font-extrabold text-slate-800">{t('title')}</h1>
      <p className="mb-6 mt-1 text-slate-500">{t('subtitle')}</p>

      {/* upload */}
      <div className="card mb-6 flex flex-col items-center gap-3 border-2 border-dashed border-brand-200 bg-brand-50/40 p-8 text-center">
        <Icon name="upload" className="text-3xl text-brand-400" />
        <p className="font-semibold text-slate-600">{t('uploadHint')}</p>
        <label className="label">
          {t('uploadPart')}
          <select
            className="input w-44"
            value={part}
            onChange={(e) => setPart(Number(e.target.value))}
          >
            <option value={5}>{t('partN', { n: 5 })} — {t('part5Hint')}</option>
            <option value={6}>{t('partN', { n: 6 })} — {t('part6Hint')}</option>
            <option value={7}>{t('partN', { n: 7 })} — {t('part7Hint')}</option>
          </select>
        </label>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf,.docx"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button className="btn-primary" disabled={uploading} onClick={onPick}>
          {uploading ? t('loading', { ns: 'common' }) : `${t('chooseFile')} (${t('partN', { n: part })})`}
        </button>
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      </div>

      {loading && <p className="text-slate-400">{t('loading', { ns: 'common' })}</p>}
      {!loading && files.length === 0 && (
        <div className="card grid place-items-center gap-2 p-12 text-center">
          <Icon name="filePdf" className="text-4xl text-slate-300" />
          <p className="font-semibold text-slate-500">{t('empty')}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase text-slate-400">
                <th className="px-5 py-3">{t('file')}</th>
                <th className="px-5 py-3">{t('status')}</th>
                <th className="px-5 py-3">{t('questions')}</th>
                <th className="px-5 py-3">{t('uploaded')}</th>
                <th className="px-5 py-3 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-b border-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name="filePdf" className="text-brand-500" />
                      <span className="font-semibold text-slate-700">{f.originalFilename}</span>
                    </div>
                    {f.status === 'failed' && f.error && (
                      <div className="mt-1 text-xs text-rose-500">{f.error}</div>
                    )}
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={f.status} /></td>
                  <td className="px-5 py-3 text-slate-600">{f.questionCount || '—'}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {new Date(f.createdAt).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {f.status === 'extracted' && (
                        <Link to={`/exam-files/${f.id}/review`} className="btn-soft btn-sm">
                          <Icon name="reviewList" /> {t('review')}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
