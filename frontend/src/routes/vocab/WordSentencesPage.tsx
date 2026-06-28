import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { getWordSentences } from '../../api/vocab.api';
import { getSentenceAudio, type Accent } from '../../api/tts.api';

const ACCENT_LANG: Record<Accent, string> = {
  us: 'en-US',
  uk: 'en-GB',
  au: 'en-AU',
};

/**
 * Lists a word's example sentences. Reached by clicking a word node in the graph,
 * which passes the sentences it already holds via router state — so the common
 * path makes NO API call. A refresh/deep-link falls back to the graph data (a DB
 * read, not an LLM lookup). "Practice this word" links to the full vocab page.
 */
export function WordSentencesPage() {
  const { t } = useTranslation(['vocab', 'common']);
  const { word = '' } = useParams<{ word: string }>();
  const location = useLocation();
  const passed = (location.state as { sentences?: string[] } | null)?.sentences ?? null;
  const [sentences, setSentences] = useState<string[] | null>(passed);
  const [loading, setLoading] = useState(passed === null);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [accent, setAccent] = useState<Accent>('us');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const browserTtsSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Stop any current playback (Azure audio element + browser voice).
  const stopAll = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    window.speechSynthesis?.cancel();
  };

  // Browser-voice fallback (used when Azure TTS isn't configured/reachable).
  const speakWithBrowser = (text: string) => {
    if (!browserTtsSupported) {
      setSpeaking(null);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = ACCENT_LANG[accent];
    u.rate = 0.95;
    u.onend = () => setSpeaking(null);
    u.onerror = () => setSpeaking(null);
    window.speechSynthesis.speak(u);
  };

  // Play a sentence: Azure Neural TTS audio, falling back to the browser voice.
  const speak = async (text: string, i: number) => {
    if (speaking === i) {
      stopAll();
      setSpeaking(null);
      return;
    }
    stopAll();
    setSpeaking(i);
    try {
      const blob = await getSentenceAudio(text, accent);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(null);
        stopAll();
      };
      audio.onerror = () => setSpeaking(null);
      await audio.play();
    } catch {
      speakWithBrowser(text); // Azure not configured / failed -> browser voice
    }
  };

  // Stop playback when leaving the page.
  useEffect(() => () => stopAll(), []);

  useEffect(() => {
    if (passed !== null) return; // already have the data from the graph click
    let active = true;
    getWordSentences(word)
      .then((r) => {
        if (active) setSentences(r.sentences);
      })
      .catch(() => active && setSentences([]))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [word, passed]);

  return (
    <AppLayout>
      <Link to="/graph" className="text-sm font-bold text-brand-600 hover:underline">
        ← {t('graphBack')}
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
          <Icon name="vocab" className="text-brand-500" />
          {word}
        </h1>
        <Link to={`/vocab/${encodeURIComponent(word)}`} className="btn-soft btn-sm">
          <Icon name="rocket" /> {t('practiceWord')}
        </Link>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-500">
          <Icon name="audio" className="text-brand-500" />
          {t('accent')}
          <select
            className="input h-8 w-auto py-0 text-sm"
            value={accent}
            onChange={(e) => {
              stopAll();
              setSpeaking(null);
              setAccent(e.target.value as Accent);
            }}
          >
            <option value="us">{t('accentUs')}</option>
            <option value="uk">{t('accentUk')}</option>
            <option value="au">{t('accentAu')}</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="card grid place-items-center p-10 text-slate-400">
          <Icon name="spinner" className="text-2xl" />
        </div>
      ) : sentences && sentences.length > 0 ? (
        <div className="card p-5">
          <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">
            {t('sentencesN', { count: sentences.length })}
          </p>
          <ol className="grid gap-1">
            {sentences.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                <span className="pt-0.5 font-bold text-brand-500">{i + 1}.</span>
                <span className="flex-1">{s}</span>
                <button
                  type="button"
                  onClick={() => speak(s, i)}
                  title={speaking === i ? t('stopSpeaking') : t('speakSentence')}
                  aria-label={speaking === i ? t('stopSpeaking') : t('speakSentence')}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${
                    speaking === i
                      ? 'bg-brand-500 text-white'
                      : 'text-slate-400 hover:bg-brand-50 hover:text-brand-600'
                  }`}
                >
                  <Icon name={speaking === i ? 'audioPlaying' : 'audio'} />
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="card grid place-items-center gap-2 p-10 text-center text-slate-400">
          <Icon name="empty" className="text-2xl" />
          <p>{t('noSentences')}</p>
        </div>
      )}
    </AppLayout>
  );
}
