import { inflections, normalizeLemma } from './vocab.lemmatizer';
import { GenItem, GeneratedWord, ValidItem, ValidSense, ValidWord } from './vocab.types';

/** The cloze blank used in exercise prompts. */
const BLANK = '______';

/**
 * Locate the target word's surface form in a sentence (word-boundary, case
 * insensitive). Returns the earliest match across the lemma's inflections, or
 * null if the sentence does not actually contain the word.
 */
export function findTargetSpan(
  sentence: string,
  lemma: string,
): { start: number; len: number } | null {
  let best: { start: number; len: number } | null = null;
  for (const form of inflections(lemma)) {
    const re = new RegExp(`\\b${escapeRegExp(form)}\\b`, 'i');
    const m = re.exec(sentence);
    if (m && (best === null || m.index < best.start)) {
      best = { start: m.index, len: m[0].length };
    }
  }
  return best;
}

/** Build a cloze prompt by masking [start, len]. Verifiable by construction. */
export function buildCloze(
  sentence: string,
  start: number,
  len: number,
): { prompt: string; answer: string } {
  const answer = sentence.slice(start, start + len);
  const prompt = sentence.slice(0, start) + BLANK + sentence.slice(start + len);
  return { prompt, answer };
}

/** Generalize "improve + noun" → "verb + noun" so patterns are reusable. */
function templateFor(display: string, lemma: string, pos: string): string {
  const re = new RegExp(`\\b${escapeRegExp(lemma)}\\b`, 'i');
  return display.replace(re, pos).trim();
}

/**
 * Validate one generated item into a persistable form, or return null if it
 * can't be made correct. Builds the cloze mechanically and hard-filters the
 * skill code. Shared by the full-word validation and the sentence top-up pass.
 */
export function validateItem(
  lemma: string,
  pos: string,
  it: GenItem,
  skillMap: Map<string, string>,
  flagged: string[],
  ctx: string,
): ValidItem | null {
  const text = (it.sentence || '').trim();
  if (!text) {
    flagged.push(`${ctx}: empty sentence, dropped`);
    return null;
  }
  const span = findTargetSpan(text, lemma);
  if (!span) {
    flagged.push(`${ctx}: sentence omits "${lemma}", dropped`);
    return null;
  }
  const { prompt, answer } = buildCloze(text, span.start, span.len);
  if (prompt.replace(BLANK, answer) !== text) {
    flagged.push(`${ctx}: cloze mismatch, dropped`);
    return null;
  }
  const code = (it.skill || '').trim().toUpperCase();
  const skillId = code && skillMap.has(code) ? skillMap.get(code)! : null;
  if (code && !skillId) flagged.push(`unknown skill code "${code}" dropped`);

  const display = (it.pattern || '').trim() || `${lemma} (pattern)`;
  const template = templateFor(display, lemma, pos);
  return {
    patternDisplay: display,
    patternName: template,
    patternTemplate: template,
    skillId,
    sentenceText: text,
    targetStart: span.start,
    targetLen: span.len,
    exercisePrompt: prompt,
    exerciseAnswer: answer,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate LLM-generated content before it is cached (docs §7). Policy mirrors
 * the extraction guardrail: drop items that can't be made correct, keep the
 * rest, and record why. Exercises are built mechanically (never trusted from the
 * model), and skill codes are hard-filtered against the taxonomy.
 *
 * @param skillMap code -> skill_id, loaded from the `skills` table.
 */
export function validateGenerated(
  lemma: string,
  gen: GeneratedWord,
  skillMap: Map<string, string>,
): ValidWord {
  const flagged: string[] = [];
  const pos = (gen.pos || 'unknown').trim().toLowerCase();
  const senses: ValidSense[] = [];

  gen.senses?.forEach((s, si) => {
    const gloss = (s.meaning || '').trim();
    if (!gloss) {
      flagged.push(`sense ${si}: empty meaning, dropped`);
      return;
    }
    const items: ValidItem[] = [];
    s.items?.forEach((it, ii) => {
      const item = validateItem(
        lemma,
        pos,
        it,
        skillMap,
        flagged,
        `sense ${si} item ${ii}`,
      );
      if (item) items.push(item);
    });
    if (items.length === 0) {
      flagged.push(`sense ${si}: no valid example, dropped`);
      return;
    }
    senses.push({
      gloss,
      glossVi: (s.meaningVi || '').trim() || null,
      sortOrder: senses.length,
      items,
    });
  });

  return {
    lemma: normalizeLemma(lemma),
    pos,
    cefr: (gen.cefr || '').trim() || null,
    senses,
    collocations: (gen.collocations ?? [])
      .filter((c) => c?.collocate)
      .map((c) => ({ collocate: c.collocate.trim(), relation: c.relation || 'related' })),
    family: (gen.family ?? [])
      .filter((f) => f?.lemma)
      .map((f) => ({ lemma: f.lemma.trim(), relation: f.relation || 'related' })),
    flagged,
  };
}
