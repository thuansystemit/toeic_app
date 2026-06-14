import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
const DIM = '#e2e8f0';

export function KnowledgeGraphPage() {
  const { t } = useTranslation(['test', 'common']);
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
    return { skills, questions, links: data.links.length };
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
        <span className="ml-auto text-slate-400">
          {counts.skills} {t('graphSkillsN')} · {counts.questions} {t('graphQuestionsN')} ·{' '}
          {counts.links} {t('graphLinksN')}
        </span>
      </div>

      <div ref={wrapRef} className="card overflow-hidden p-0" style={{ height: 600 }}>
        {loading ? (
          <div className="grid h-full place-items-center text-slate-400">
            <Icon name="spinner" />
          </div>
        ) : counts.questions === 0 ? (
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
            nodeVal={(n: any) => (n.kind === 'skill' ? 4 : 1)}
            linkColor={(l: any) => {
              const s = typeof l.source === 'object' ? l.source.id : l.source;
              const tg = typeof l.target === 'object' ? l.target.id : l.target;
              return isActive(s) && isActive(tg) ? '#cbd5e1' : '#f1f5f9';
            }}
            onNodeClick={(n: any) => setSelected((cur) => (cur === n.id ? null : n.id))}
            onBackgroundClick={() => setSelected(null)}
            nodeCanvasObject={(n: any, ctx, scale) => {
              const active = isActive(n.id);
              const base =
                n.kind === 'skill'
                  ? CATEGORY_COLORS[n.category] ?? '#6366f1'
                  : QUESTION_COLOR;
              const r = n.kind === 'skill' ? 6 : 3.5;
              ctx.beginPath();
              ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = active ? base : DIM;
              ctx.fill();
              if (n.kind === 'skill' && active) {
                const fontSize = Math.max(10 / scale, 3);
                ctx.font = `600 ${fontSize}px Inter, sans-serif`;
                ctx.fillStyle = '#334155';
                ctx.fillText(n.label, n.x + r + 1.5, n.y + fontSize / 3);
              }
            }}
            nodeLabel={(n: any) =>
              n.kind === 'skill' ? `${n.label}` : `Part ${n.part}: ${n.label}`
            }
          />
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">{t('graphHint')}</p>
    </AppLayout>
  );
}
