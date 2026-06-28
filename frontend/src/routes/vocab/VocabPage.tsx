import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { AppLayout } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import {
  listVocabWords,
  lookupWord,
  submitAttempt,
  type AttemptResult,
  type VocabEntry,
  type VocabExercise,
  type VocabWordSummary,
} from '../../api/vocab.api';
import { WORD_GROUPS } from '../../data/toeicWordGroups';

/** A single cloze exercise with its own answer/feedback state. */
function ClozeExercise({ exercise }: { exercise: VocabExercise }) {
  const { t } = useTranslation(['vocab']);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const check = async (e: FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      setResult(await submitAttempt(exercise.id, answer.trim()));
    } catch {
      /* keep the form; a transient error just lets them retry */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={check} className="mt-2 rounded-xl bg-slate-50 p-3">
      <p className="mb-2 text-sm text-slate-500">
        <Icon name="explanation" className="mr-1 text-amber-500" />
        {t('exercise')}
      </p>
      <p className="font-medium text-slate-800">{exercise.prompt}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          className="input"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={t('answerPlaceholder')}
          disabled={submitting}
        />
        <button type="submit" className="btn-primary btn-sm" disabled={submitting || !answer.trim()}>
          {result ? t('tryAgain') : t('check')}
        </button>
      </div>
      {result && (
        <p className={`mt-2 text-sm font-semibold ${result.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
          <Icon name={result.correct ? 'correct' : 'wrong'} className="mr-1" />
          {result.correct ? t('correct') : t('incorrect')}
          {!result.correct && (
            <span className="ml-2 font-normal text-slate-500">
              {t('correctAnswer', { answer: result.correctAnswer })}
            </span>
          )}
        </p>
      )}
    </form>
  );
}

export function VocabPage() {
  const { t } = useTranslation(['vocab', 'common']);
  const { word: wordParam } = useParams<{ word?: string }>();
  const [term, setTerm] = useState(wordParam ?? '');
  const [entry, setEntry] = useState<VocabEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<VocabWordSummary[]>([]);
  const [filter, setFilter] = useState('');

  // Load the browse-all word index once.
  useEffect(() => {
    listVocabWords()
      .then(setWords)
      .catch(() => undefined);
  }, []);

  // Which words already have generated content (for styling + progress count).
  const generated = useMemo(
    () => new Set(words.map((w) => w.word)),
    [words],
  );

  // The TOEIC topic groups, filtered by the search box (empty groups hidden).
  const filteredGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return WORD_GROUPS.map((g) => ({
      category: g.category,
      words: q ? g.words.filter((w) => w.includes(q)) : g.words,
    })).filter((g) => g.words.length > 0);
  }, [filter]);

  const runLookup = useCallback(
    async (raw: string) => {
      const word = raw.trim();
      if (!word) return;
      if (!/^[A-Za-z][A-Za-z'-]*$/.test(word)) {
        setError(t('invalidWord'));
        return;
      }
      setLoading(true);
      setError(null);
      setEntry(null);
      try {
        setEntry(await lookupWord(word));
      } catch (err) {
        const status = (err as AxiosError).response?.status;
        setError(status === 404 ? t('notFound', { word }) : t('error'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Auto-load when arriving via /vocab/:word (e.g. clicking a word in the graph).
  useEffect(() => {
    if (wordParam) {
      setTerm(wordParam);
      void runLookup(wordParam);
    }
  }, [wordParam, runLookup]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (!loading) void runLookup(term);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
          <Icon name="vocab" className="text-brand-500" />
          {t('title')}
        </h1>
        <p className="mt-1 text-slate-500">{t('subtitle')}</p>
      </div>

      <form onSubmit={search} className="mb-6 flex max-w-xl items-stretch gap-2">
        <div className="relative flex-1">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className="input pl-10"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t('searchPlaceholder')}
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="btn-primary shrink-0 px-6"
          disabled={loading || !term.trim()}
        >
          {loading && <Icon name="spinner" />}
          {t('searchButton')}
        </button>
      </form>

      {loading && (
        <div className="card grid place-items-center gap-3 p-10 text-slate-400">
          <Icon name="spinner" className="text-2xl" />
          <span>{t('generating')}</span>
        </div>
      )}

      {error && !loading && (
        <div className="card border border-rose-100 bg-rose-50 p-5 text-rose-600">{error}</div>
      )}

      {!loading && !error && !entry && (
        <div className="card grid place-items-center gap-2 p-10 text-center text-slate-400">
          <Icon name="search" className="text-2xl" />
          <p className="font-semibold text-slate-500">{t('emptyTitle')}</p>
          <p className="text-sm">{t('emptyBody')}</p>
        </div>
      )}

      {!loading && entry && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-3xl font-extrabold text-slate-800">{entry.word}</h2>
            <span className="badge">{entry.pos}</span>
            {entry.cefr && <span className="chip">{entry.cefr}</span>}
          </div>

          {entry.senses.map((sense, si) => (
            <div key={si} className="card p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">{t('meaning')}</p>
              <p className="text-lg font-semibold text-slate-800">{sense.meaning}</p>
              {sense.meaningVi && <p className="text-sm text-slate-500">{sense.meaningVi}</p>}

              {sense.patterns.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-400">{t('patterns')}:</span>
                  {sense.patterns.map((p, pi) => (
                    <span key={pi} className="chip">
                      {p.display}
                      {p.skill && <span className="ml-1 text-brand-500">· {p.skill}</span>}
                    </span>
                  ))}
                </div>
              )}

              {sense.sentences.map((s, sj) => (
                <div key={sj} className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{t('example')}</p>
                  <p className="text-slate-700">{s.text}</p>
                  <ClozeExercise exercise={s.exercise} />
                </div>
              ))}
            </div>
          ))}

          {(entry.collocations.length > 0 || entry.wordFamily.length > 0) && (
            <div className="card p-5">
              {entry.collocations.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">{t('collocations')}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {entry.collocations.map((c, i) => (
                      <span key={i} className="chip">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {entry.wordFamily.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{t('wordFamily')}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {entry.wordFamily.map((w, i) => (
                      <span key={i} className="chip">{w}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Browse all words by TOEIC topic (3-column grid) */}
      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-extrabold text-slate-800">{t('allWords')}</h2>
          <span className="text-sm text-slate-400">{words.length}/600</span>
          <input
            className="input ml-auto h-9 max-w-xs py-1.5 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('filterWords')}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((g) => (
            <div key={g.category} className="card p-4">
              <h3 className="mb-2 text-sm font-bold text-slate-700">{g.category}</h3>
              <div className="flex flex-wrap gap-1.5">
                {g.words.map((w) =>
                  generated.has(w) ? (
                    // Built words jump to the graph and highlight their node.
                    <Link
                      key={w}
                      to={`/graph?focus=${encodeURIComponent(w)}`}
                      className="chip text-xs hover:bg-brand-50 hover:text-brand-700"
                    >
                      {w}
                    </Link>
                  ) : (
                    // Not generated yet — shown muted, not clickable.
                    <span key={w} className="chip text-xs text-slate-300">
                      {w}
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
        {filteredGroups.length === 0 && (
          <p className="text-sm text-slate-400">{t('noWordsMatch')}</p>
        )}
      </div>
    </AppLayout>
  );
}
