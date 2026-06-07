import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { loginWithFacebook, loginWithGoogle } from '../api/auth.api';
import type { AuthResponse } from '../types/user';
import { Icon } from './Icon';

/* eslint-disable @typescript-eslint/no-explicit-any */
const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const FACEBOOK_ID = import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined;

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.id = id;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export function SocialAuth({
  onAuthed,
}: {
  onAuthed: (res: AuthResponse) => void;
}) {
  const { t } = useTranslation(['auth']);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const anyEnabled = !!GOOGLE_ID || !!FACEBOOK_ID;

  const fail = (e: unknown) => {
    const msg =
      (e as AxiosError<{ message?: string }>).response?.data?.message ??
      (e as Error).message;
    setError(msg);
  };

  // Google Identity Services — renders Google's official button.
  useEffect(() => {
    if (!GOOGLE_ID) return;
    let cancelled = false;
    loadScript('https://accounts.google.com/gsi/client', 'gsi-script')
      .then(() => {
        if (cancelled) return;
        const g = (window as any).google;
        if (!g?.accounts?.id) return;
        g.accounts.id.initialize({
          client_id: GOOGLE_ID,
          callback: async (resp: { credential: string }) => {
            try {
              setBusy(true);
              onAuthed(await loginWithGoogle(resp.credential));
            } catch (e) {
              fail(e);
            } finally {
              setBusy(false);
            }
          },
        });
        if (googleBtnRef.current) {
          g.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            width: 320,
          });
        }
      })
      .catch(() => setError(t('socialLoadError')));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const facebookLogin = async () => {
    if (!FACEBOOK_ID) return;
    setError(null);
    try {
      await loadScript('https://connect.facebook.net/en_US/sdk.js', 'fb-script');
      const FB = (window as any).FB;
      FB.init({ appId: FACEBOOK_ID, cookie: true, xfbml: false, version: 'v19.0' });
      FB.login(
        async (response: any) => {
          const token = response?.authResponse?.accessToken;
          if (!token) return;
          try {
            setBusy(true);
            onAuthed(await loginWithFacebook(token));
          } catch (e) {
            fail(e);
          } finally {
            setBusy(false);
          }
        },
        { scope: 'email,public_profile' },
      );
    } catch {
      setError(t('socialLoadError'));
    }
  };

  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center gap-3 text-xs font-bold uppercase text-slate-300">
        <span className="h-px flex-1 bg-slate-200" />
        {t('orContinue')}
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {error && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        {/* Google */}
        {GOOGLE_ID ? (
          <div ref={googleBtnRef} className={busy ? 'pointer-events-none opacity-60' : ''} />
        ) : (
          <button disabled className="btn-ghost w-full justify-center" title={t('socialNotConfigured')}>
            <Icon name="google" /> {t('continueGoogle')}
          </button>
        )}

        {/* Facebook */}
        <button
          onClick={facebookLogin}
          disabled={!FACEBOOK_ID || busy}
          title={FACEBOOK_ID ? undefined : t('socialNotConfigured')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#166fe0] disabled:opacity-50"
        >
          <Icon name="facebook" />
          {t('continueFacebook')}
        </button>

        {!anyEnabled && (
          <p className="mt-1 text-center text-xs text-slate-400">{t('socialNotConfigured')}</p>
        )}
      </div>
    </div>
  );
}
