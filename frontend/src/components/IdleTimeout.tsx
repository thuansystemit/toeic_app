import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';

// How long the user can be idle before the warning dialog appears.
const IDLE_BEFORE_WARNING_MS = 15 * 60 * 1000; // 15 minutes
// How long the countdown dialog stays up before auto-logout.
const WARNING_DURATION_MS = 60 * 1000; // 1 minute

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
] as const;

/**
 * Logs the user out after a period of inactivity. Once the idle threshold is
 * reached it shows a 1-minute countdown dialog; if the user does not interact,
 * the session is cleared and they are sent to the login page.
 *
 * Mounted inside ProtectedRoute so it only runs for authenticated routes.
 */
export function IdleTimeout() {
  const { t } = useTranslation(['common']);
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clear = useAuthStore((s) => s.clear);

  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_DURATION_MS / 1000);

  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const countdownTimer = useRef<ReturnType<typeof setInterval>>();
  // Mirror of `warning` for use inside event handlers without re-subscribing.
  const warningRef = useRef(false);

  const doLogout = useCallback(async () => {
    clearTimeout(idleTimer.current);
    clearInterval(countdownTimer.current);
    warningRef.current = false;
    setWarning(false);
    try {
      await logout();
    } catch {
      // Ignore network errors — we log out locally regardless.
    } finally {
      clear();
      navigate('/login', { replace: true });
    }
  }, [clear, navigate]);

  const startCountdown = useCallback(() => {
    warningRef.current = true;
    setWarning(true);
    setSecondsLeft(WARNING_DURATION_MS / 1000);
    const deadline = Date.now() + WARNING_DURATION_MS;
    clearInterval(countdownTimer.current);
    countdownTimer.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(countdownTimer.current);
        void doLogout();
      }
    }, 250);
  }, [doLogout]);

  const armIdleTimer = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(startCountdown, IDLE_BEFORE_WARNING_MS);
  }, [startCountdown]);

  // Reset on user activity — but ignore background activity once the warning is
  // showing; dismissing it then requires an explicit choice.
  const onActivity = useCallback(() => {
    if (warningRef.current) return;
    armIdleTimer();
  }, [armIdleTimer]);

  const staySignedIn = useCallback(() => {
    clearInterval(countdownTimer.current);
    warningRef.current = false;
    setWarning(false);
    armIdleTimer();
  }, [armIdleTimer]);

  useEffect(() => {
    if (!isAuthenticated) return;
    armIdleTimer();
    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearTimeout(idleTimer.current);
      clearInterval(countdownTimer.current);
    };
  }, [isAuthenticated, armIdleTimer, onActivity]);

  if (!isAuthenticated || !warning) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-soft">
        <h2 id="idle-title" className="text-lg font-extrabold text-slate-800">
          {t('idleTitle')}
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {t('idleBody', { seconds: secondsLeft })}
        </p>
        <div className="mt-4 text-center text-3xl font-extrabold tabular-nums text-brand-600">
          {secondsLeft}
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={() => void doLogout()} className="btn-ghost flex-1 justify-center">
            {t('idleLogoutNow')}
          </button>
          <button onClick={staySignedIn} className="btn-primary flex-1 justify-center">
            {t('idleStay')}
          </button>
        </div>
      </div>
    </div>
  );
}
