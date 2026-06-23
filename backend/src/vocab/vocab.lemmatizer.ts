/**
 * Minimal, dependency-free lemmatizer + inflection helper for P1.
 *
 * Deliberately lightweight: it normalizes an input word to a cache key and can
 * enumerate likely surface forms so the guardrail can locate the target word in
 * an example sentence. It is NOT a full morphological analyzer — §11.6 flags
 * this as replaceable by a real lemmatizer later.
 */

/** Normalize a raw user input to a lookup lemma (lowercase, trimmed, deduped). */
export function normalizeLemma(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** A best-effort base form for a single word (strips common inflections). */
export function toLemma(word: string): string {
  const w = normalizeLemma(word);
  if (w.length <= 3 || w.includes(' ')) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ied') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Candidate surface forms for a lemma, used to find it in a sentence. */
export function inflections(lemma: string): string[] {
  const base = normalizeLemma(lemma);
  const forms = new Set<string>([base]);
  const last = base.at(-1) ?? '';
  forms.add(base + 's');
  forms.add(base + 'es');
  forms.add(base + 'ed');
  forms.add(base + 'd');
  forms.add(base + 'ing');
  // drop trailing 'e' before -ing/-ed (improve -> improving/improved)
  if (last === 'e') {
    forms.add(base.slice(0, -1) + 'ing');
    forms.add(base.slice(0, -1) + 'ed');
  }
  // consonant doubling (plan -> planning/planned) — rough heuristic
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(base)) {
    forms.add(base + last + 'ing');
    forms.add(base + last + 'ed');
  }
  // y -> ies/ied (apply -> applies/applied)
  if (last === 'y') {
    forms.add(base.slice(0, -1) + 'ies');
    forms.add(base.slice(0, -1) + 'ied');
  }
  // longest first so the most specific form matches before its prefix
  return [...forms].sort((a, b) => b.length - a.length);
}
