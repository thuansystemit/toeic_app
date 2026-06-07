import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { fileUrl } from '../api/files.api';
import { recordAudioPlay } from '../api/attempts.api';
import type { AttemptStimulus } from '../types/attempt';
import { Icon } from './Icon';

type Mode = 'full' | 'practice' | 'review';

/**
 * US-008 audio playback rules:
 *  - full   : strict — auto-play once (when in view), NO controls, NO replay.
 *             Server records the single play; a reload keeps it locked.
 *  - practice/review : native controls, replay allowed.
 */
export function AudioPlayer({
  stimulus,
  attemptId,
  mode,
}: {
  stimulus: AttemptStimulus;
  attemptId: string;
  mode: Mode;
}) {
  const { t } = useTranslation(['exam']);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const recordedRef = useRef(false);
  const triedRef = useRef(false);

  const [done, setDone] = useState(stimulus.played);
  const [blocked, setBlocked] = useState(false);
  const [playing, setPlaying] = useState(false);

  const src = stimulus.storageKey ? fileUrl(stimulus.storageKey) : '';

  // Full mode: attempt auto-play once the question scrolls into view.
  useEffect(() => {
    if (mode !== 'full' || done) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !triedRef.current) {
            triedRef.current = true;
            audioRef.current?.play().catch(() => setBlocked(true));
            io.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, [mode, done]);

  const handlePlay = async () => {
    setPlaying(true);
    if (mode !== 'full' || recordedRef.current) return;
    recordedRef.current = true;
    try {
      await recordAudioPlay(attemptId, stimulus.id);
      setBlocked(false);
    } catch (err) {
      // 409 -> already played (e.g. another tab). Stop and lock.
      if ((err as AxiosError).response?.status === 409) {
        audioRef.current?.pause();
        setDone(true);
      }
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    if (mode === 'full') setDone(true); // lock — no replay
  };

  if (!src) return null;

  // practice / review: native controls, replay allowed.
  if (mode !== 'full') {
    return (
      <audio
        controls
        src={src}
        preload="none"
        autoPlay={mode === 'practice'}
        className="w-full"
      />
    );
  }

  // full mode, already played -> locked.
  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500">
        <Icon name="audioLocked" />
        {t('audioPlayed')}
      </div>
    );
  }

  // full mode, not yet played.
  return (
    <div
      ref={wrapRef}
      className="flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700"
    >
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onPlay={handlePlay}
        onPlaying={() => setPlaying(true)}
        onEnded={handleEnded}
      />
      {blocked ? (
        <button
          type="button"
          onClick={() => audioRef.current?.play().catch(() => undefined)}
          className="btn-primary btn-sm"
        >
          <Icon name="play" /> {t('playAudio')}
        </button>
      ) : (
        <span className="flex items-center gap-2">
          <Icon name={playing ? 'audioPlaying' : 'spinner'} />
          {playing ? t('audioPlaying') : t('audioLoading')}
        </span>
      )}
      <span className="ml-auto text-xs font-medium text-brand-500">{t('playsOnce')}</span>
    </div>
  );
}
