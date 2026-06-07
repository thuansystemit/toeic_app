import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { register } from '../../api/auth.api';
import { useAuthStore } from '../../store/authStore';
import { AuthShell } from '../../components/AuthShell';
import { SocialAuth } from '../../components/SocialAuth';

export function RegisterPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await register({ email, password, displayName });
      setAuth(res.user, res.accessToken);
      navigate('/');
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 409) setError(t('errorEmailTaken'));
      else if (status === 400 || status === 422) setError(t('passwordHint'));
      else setError(t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={t('registerTitle')}
      subtitle={t('registerSubtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link to="/login" className="font-bold text-brand-600 hover:underline">
            {t('goLogin')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="label">
          {t('displayName')}
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={100} />
        </label>
        <label className="label">
          {t('email')}
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="label">
          {t('password')}
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <span className="text-xs font-medium text-slate-400">{t('passwordHint')}</span>
        </label>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary mt-1 w-full">
          {submitting ? t('loading', { ns: 'common' }) : t('registerButton')}
        </button>
      </form>
      <SocialAuth
        onAuthed={(res) => {
          setAuth(res.user, res.accessToken);
          navigate('/');
        }}
      />
    </AuthShell>
  );
}
