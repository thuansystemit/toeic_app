import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { login } from '../../api/auth.api';
import { useAuthStore } from '../../store/authStore';
import { AuthShell } from '../../components/AuthShell';
import { SocialAuth } from '../../components/SocialAuth';

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login({ email, password });
      setAuth(res.user, res.accessToken);
      navigate('/');
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      setError(status === 401 ? t('errorInvalidCredentials') : t('errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={t('loginTitle')}
      subtitle={t('loginSubtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link to="/register" className="font-bold text-brand-600 hover:underline">
            {t('goRegister')}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="label">
          {t('email')}
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="label">
          {t('password')}
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <Link to="/forgot-password" className="-mt-2 self-end text-xs font-bold text-brand-600 hover:underline">
          {t('forgotLink')}
        </Link>
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary mt-1 w-full">
          {submitting ? t('loading', { ns: 'common' }) : t('loginButton')}
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
