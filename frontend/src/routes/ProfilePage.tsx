import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { AppLayout } from '../components/AppLayout';
import { Icon } from '../components/Icon';
import {
  changePassword,
  getProfile,
  updateProfile,
  type Profile,
} from '../api/profile.api';
import { useAuthStore } from '../store/authStore';
import i18n from '../i18n/i18n';

export function ProfilePage() {
  const { t } = useTranslation(['profile', 'common']);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [locale, setLocale] = useState('vi');
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p);
      setDisplayName(p.displayName);
      setLocale(p.preferredLocale);
    });
  }, []);

  const saveInfo = async (e: FormEvent) => {
    e.preventDefault();
    setInfoMsg(null);
    setSavingInfo(true);
    try {
      const p = await updateProfile({ displayName, preferredLocale: locale });
      setProfile(p);
      updateUser({ displayName: p.displayName, preferredLocale: p.preferredLocale });
      // Apply the chosen UI language immediately.
      void i18n.changeLanguage(p.preferredLocale);
      localStorage.setItem('locale', p.preferredLocale);
      setInfoMsg({ text: t('saved'), ok: true });
    } catch (err) {
      setInfoMsg({ text: errMsg(err), ok: false });
    } finally {
      setSavingInfo(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: t('passwordMismatch'), ok: false });
      return;
    }
    setSavingPw(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwMsg({ text: t('passwordChanged'), ok: true });
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 401) setPwMsg({ text: t('wrongCurrent'), ok: false });
      else setPwMsg({ text: errMsg(err), ok: false });
    } finally {
      setSavingPw(false);
    }
  };

  if (!profile) return <AppLayout>{t('loading', { ns: 'common' })}</AppLayout>;

  const initials = profile.displayName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <AppLayout>
      <h1 className="text-2xl font-extrabold text-slate-800">{t('title')}</h1>
      <p className="mb-6 mt-1 text-slate-500">{t('subtitle')}</p>

      {/* identity header */}
      <div className="card mb-5 flex items-center gap-4 p-6">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-brand-100 text-2xl font-extrabold text-brand-700">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="truncate text-lg font-extrabold text-slate-800">{profile.displayName}</div>
          <div className="truncate text-sm text-slate-500">{profile.email}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="badge-slate capitalize">{profile.role}</span>
            <span className="text-xs text-slate-400">
              {t('memberSince')} {new Date(profile.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* edit details */}
        <form onSubmit={saveInfo} className="card flex flex-col gap-4 p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800">
            <Icon name="author" className="text-brand-500" /> {t('details')}
          </h2>
          <label className="label">
            {t('displayName')}
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={100} />
          </label>
          <label className="label">
            {t('email')}
            <input className="input bg-slate-50 text-slate-400" value={profile.email} disabled />
            <span className="text-xs font-medium text-slate-400">{t('emailLocked')}</span>
          </label>
          <label className="label">
            {t('language')}
            <select className="input" value={locale} onChange={(e) => setLocale(e.target.value)}>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
          {infoMsg && <Msg msg={infoMsg} />}
          <button type="submit" disabled={savingInfo} className="btn-primary self-start">
            {savingInfo ? t('loading', { ns: 'common' }) : t('saveChanges')}
          </button>
        </form>

        {/* change password */}
        <form onSubmit={savePassword} className="card flex flex-col gap-4 p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-800">
            <Icon name="timer" className="text-brand-500" /> {t('changePassword')}
          </h2>
          <label className="label">
            {t('currentPassword')}
            <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </label>
          <label className="label">
            {t('newPassword')}
            <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            <span className="text-xs font-medium text-slate-400">{t('passwordHint')}</span>
          </label>
          <label className="label">
            {t('confirmPassword')}
            <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
          </label>
          {pwMsg && <Msg msg={pwMsg} />}
          <button type="submit" disabled={savingPw} className="btn-primary self-start">
            {savingPw ? t('loading', { ns: 'common' }) : t('updatePassword')}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}

function Msg({ msg }: { msg: { text: string; ok: boolean } }) {
  return (
    <p
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
        msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
      }`}
    >
      {msg.text}
    </p>
  );
}

function errMsg(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
    (err as Error).message
  );
}
