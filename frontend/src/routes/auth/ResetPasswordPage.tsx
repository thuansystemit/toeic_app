import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { resetPassword } from '../../api/auth.api';
import { AuthShell } from '../../components/AuthShell';

export function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 410) setError(t('resetExpired'));
      else if (status === 400) setError(t('passwordHint'));
      else setError(t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={t('resetTitle')}
      subtitle={t('resetSubtitle')}
      footer={
        <Link to="/login" className="font-bold text-brand-600 hover:underline">
          ← {t('goLogin')}
        </Link>
      }
    >
      {!token ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {t('resetNoToken')}
        </p>
      ) : done ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {t('resetDone')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="label">
            {t('newPassword')}
            <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            <span className="text-xs font-medium text-slate-400">{t('passwordHint')}</span>
          </label>
          <label className="label">
            {t('confirmPassword')}
            <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
          </label>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t('loading', { ns: 'common' }) : t('resetButton')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
