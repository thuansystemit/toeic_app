import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { getKnowledgeGraph } from '../../api/tests.api';

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

  useEffect(() => {
    if (passed !== null) return; // already have the data from the graph click
    let active = true;
    getKnowledgeGraph()
      .then((g) => {
        const node = g.nodes.find((n) => n.kind === 'word' && n.label === word);
        if (active) setSentences(node?.sentences ?? []);
      })
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
          <ol className="grid gap-2">
            {sentences.map((s, i) => (
              <li key={i} className="flex gap-2 text-slate-700">
                <span className="font-bold text-brand-500">{i + 1}.</span>
                <span>{s}</span>
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
