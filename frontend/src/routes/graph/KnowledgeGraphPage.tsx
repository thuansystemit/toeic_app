import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { AppLayout } from '../../components/AppLayout';
import { getKnowledgeGraph, type KnowledgeGraph } from '../../api/tests.api';
import { Icon } from '../../components/Icon';

// Skill nodes are coloured by taxonomy category; question nodes are neutral.
const CATEGORY_COLORS: Record<string, string> = {
  grammar: '#6366f1',
  lexical: '#10b981',
  discourse: '#f59e0b',
  comprehension: '#f43f5e',
  listening: '#64748b',
};
const QUESTION_COLOR = '#94a3b8';
const WORD_COLOR = '#0ea5e9'; // lexical-layer words (English Learning KG)
const DIM = '#e2e8f0';

export function KnowledgeGraphPage() {
  const { t } = useTranslation(['test', 'common']);
  const navigate = useNavigate();
  const [data, setData] = useState<KnowledgeGraph>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    getKnowledgeGraph()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const measure = () => setWidth(wrapRef.current?.clientWidth ?? 800);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Clone so the force layout mutates its own copy, not our state.
  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.links.map((l) => ({ ...l })),
    }),
    [data],
  );

  // Adjacency (from the original string-keyed links) for click-to-highlight.
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a)!.add(b);
    };
    for (const l of data.links) {
      add(l.source, l.target);
      add(l.target, l.source);
    }
    return m;
  }, [data]);

  const isActive = (id: string) =>
    !selected || id === selected || !!neighbors.get(selected)?.has(id);

  const counts = useMemo(() => {
    const skills = data.nodes.filter((n) => n.kind === 'skill').length;
    const questions = data.nodes.filter((n) => n.kind === 'question').length;
    const words = data.nodes.filter((n) => n.kind === 'word').length;
    return { skills, questions, words, links: data.links.length };
  }, [data]);

  return (
    <AppLayout>
      <h1 className="text-2xl font-extrabold text-slate-800">{t('graphTitle')}</h1>
      <p className="mb-4 mt-1 text-slate-500">{t('graphSubtitle')}</p>

      {/* legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
        {Object.entries(CATEGORY_COLORS)
          .filter(([k]) => k !== 'listening')
          .map(([cat, color]) => (
            <span key={cat} className="inline-flex items-center gap-1">
              <span className="h-3 w-3 rounded-full" style={{ background: color }} />
              {cat}
            </span>
          ))}
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-full" style={{ background: QUESTION_COLOR }} />
          {t('graphQuestion')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-full" style={{ background: WORD_COLOR }} />
          {t('graphWord')}
        </span>
        <span className="ml-auto text-slate-400">
          {counts.skills} {t('graphSkillsN')} · {counts.questions} {t('graphQuestionsN')} ·{' '}
          {counts.words} {t('graphWordsN')} · {counts.links} {t('graphLinksN')}
        </span>
      </div>

      <div ref={wrapRef} className="card overflow-hidden p-0" style={{ height: 600 }}>
        {loading ? (
          <div className="grid h-full place-items-center text-slate-400">
            <Icon name="spinner" />
          </div>
        ) : counts.questions === 0 && counts.words === 0 ? (
          <div className="grid h-full place-items-center gap-2 p-8 text-center">
            <Icon name="empty" className="text-4xl text-slate-300" />
            <p className="font-semibold text-slate-500">{t('graphEmpty')}</p>
          </div>
        ) : (
          <ForceGraph2D
            graphData={graphData}
            width={width}
            height={600}
            backgroundColor="#ffffff"
            cooldownTicks={120}
            nodeRelSize={5}
            nodeVal={(n: any) => (n.kind === 'skill' ? 4 : n.kind === 'word' ? 2 : 1)}
            linkColor={(l: any) => {
              const s = typeof l.source === 'object' ? l.source.id : l.source;
              const tg = typeof l.target === 'object' ? l.target.id : l.target;
              return isActive(s) && isActive(tg) ? '#cbd5e1' : '#f1f5f9';
            }}
            onNodeClick={(n: any) => {
              // Word nodes open a page listing the sentences we ALREADY have on
              // the node — passed via router state, so no extra lookup is made.
              // Skill/question nodes just highlight their neighborhood.
              if (n.kind === 'word') {
                navigate(`/word/${encodeURIComponent(n.label)}`, {
                  state: { sentences: n.sentences ?? [] },
                });
              } else {
                setSelected((cur) => (cur === n.id ? null : n.id));
              }
            }}
            onBackgroundClick={() => setSelected(null)}
            nodeCanvasObject={(n: any, ctx, scale) => {
              const active = isActive(n.id);
              const base =
                n.kind === 'skill'
                  ? CATEGORY_COLORS[n.category] ?? '#6366f1'
                  : n.kind === 'word'
                    ? WORD_COLOR
                    : QUESTION_COLOR;
              const r = n.kind === 'skill' ? 6 : n.kind === 'word' ? 4.5 : 3.5;
              ctx.beginPath();
              ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = active ? base : DIM;
              ctx.fill();
              // Label skills and words (both are meaningful); leave questions unlabelled.
              if ((n.kind === 'skill' || n.kind === 'word') && active) {
                const fontSize = Math.max(10 / scale, 3);
                ctx.font = `600 ${fontSize}px Inter, sans-serif`;
                ctx.fillStyle = n.kind === 'word' ? '#0369a1' : '#334155';
                ctx.fillText(n.label, n.x + r + 1.5, n.y + fontSize / 3);
              }
            }}
            nodeLabel={(n: any) => {
              if (n.kind === 'skill') return `${n.label}`;
              if (n.kind === 'word') {
                const list: string[] = n.sentences ?? [];
                const items = list
                  .map(
                    (s: string, i: number) =>
                      `<div style="margin-top:2px">${i + 1}. ${s}</div>`,
                  )
                  .join('');
                const body = items
                  ? `<div style="color:#ffffff;max-width:320px;font-weight:400;margin-top:3px">${items}</div>`
                  : '';
                const hint = `<div style="color:#7dd3fc;font-size:11px;font-weight:600;margin-top:3px">${t('graphWordOpen')}</div>`;
                return `<div style="font-weight:700;color:#ffffff">${n.label}</div>${body}${hint}`;
              }
              return `Part ${n.part}: ${n.label}`;
            }}
          />
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">{t('graphHint')}</p>
    </AppLayout>
  );
}
