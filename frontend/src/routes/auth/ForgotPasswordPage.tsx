import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/auth.api';
import { AuthShell } from '../../components/AuthShell';

export function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={t('forgotTitle')}
      subtitle={t('forgotSubtitle')}
      footer={
        <Link to="/login" className="font-bold text-brand-600 hover:underline">
          ← {t('goLogin')}
        </Link>
      }
    >
      {sent ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {t('forgotSent')}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="label">
            {t('email')}
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t('loading', { ns: 'common' }) : t('sendResetLink')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
