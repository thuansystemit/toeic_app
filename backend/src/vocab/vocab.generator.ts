import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER, LlmProvider } from '../llm/llm.types';
import { GenItem, GeneratedWord } from './vocab.types';

/** Prompt version stamped onto generated rows for provenance / regeneration. */
export const VOCAB_PROMPT_VERSION = 'vocab-gen-v3';

/** Every word must end up with at least this many example sentences. */
export const MIN_SENTENCES = 10;

// Example-driven (few-shot) prompt: small models like qwen2.5:3b copy a concrete
// example far more reliably than they fill an abstract template. The worked
// example for "increase" shows the exact pattern/skill/sentence style we want.
const SYSTEM = `You are an English vocabulary teacher. For the requested word,
output ONLY a JSON object (no prose, no markdown).

Here is a complete EXAMPLE for the word "increase":
{
  "pos": "verb",
  "cefr": "B1",
  "senses": [
    {
      "meaning": "to become or make larger in amount or size",
      "meaningVi": "tăng",
      "items": [
        {
          "pattern": "increase + noun",
          "skill": "L-COLLOC",
          "sentence": "The company plans to increase production next year."
        }
      ]
    }
  ],
  "collocations": [ { "collocate": "production", "relation": "verb+noun" } ],
  "family": [ { "lemma": "increasingly", "relation": "adv_form" } ]
}

Rules:
- Produce the same structure for the REQUESTED word (not "increase").
- "pattern": the requested word followed by what typically comes after it —
  e.g. "improve + noun", "depend + on + noun", "interested + in + noun".
  Write the real word; NEVER output placeholders like "<word>" or "<noun>".
- "skill": choose exactly ONE code from the list below that the pattern tests,
  and copy it EXACTLY. Vocabulary items are usually L-VOCAB, L-COLLOC,
  L-WCHOICE, or G-WFORM. Use only a code from the list — never invent one.
- Every "sentence" MUST contain the requested word (an inflected form is fine)
  and be short and natural (TOEIC office register).
- Give 2-4 senses. Across all senses, provide AT LEAST 10 example sentences in
  total (each "item" is one sentence) — aim for 4-5 items per sense. Make the
  sentences varied (different contexts), not slight rewordings of each other.
- "meaningVi" is optional.

Allowed skill codes:
{skills}`;

// Top-up prompt: asks only for additional, distinct example sentences when the
// first pass produced fewer than the minimum.
const MORE_SYSTEM = `You are an English vocabulary teacher. Output ONLY a JSON
object: { "items": [ { "pattern": "<word> + …", "skill": "CODE", "sentence": "…" } ] }.
Give {need} MORE example sentences for the word "{word}". Rules:
- Set EACH sentence in this context: {context}. This keeps them distinct.
- Each "sentence" MUST contain "{word}" (an inflected form is fine), short and
  natural, and DIFFERENT from these already-used ones:
{existing}
- "pattern": the word followed by what typically comes after it (e.g.
  "{word} + noun"); never output placeholders.
- "skill": one code from this list, copied EXACTLY:
{skills}`;

/**
 * Builds the prompt, calls the LLM, and parses to the typed `GeneratedWord`.
 * Returns the raw structure only — semantic validation + cloze generation is the
 * guardrail's job (vocab.guardrail.ts).
 */
@Injectable()
export class VocabGenerator {
  private readonly logger = new Logger(VocabGenerator.name);

  constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider) {}

  get model(): string {
    return this.llm.model;
  }

  async generate(lemma: string, skillList: string): Promise<GeneratedWord> {
    const system = SYSTEM.replace('{skills}', skillList);
    const raw = await this.llm.generateJson(system, `Word: ${lemma}`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Some models wrap JSON in prose/fences; salvage the first object.
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('LLM did not return JSON');
      parsed = JSON.parse(m[0]);
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('LLM returned non-object JSON');
    }
    const obj = parsed as Partial<GeneratedWord>;
    if (!Array.isArray(obj.senses)) {
      throw new Error('LLM JSON missing "senses" array');
    }
    return {
      pos: typeof obj.pos === 'string' ? obj.pos : 'unknown',
      cefr: typeof obj.cefr === 'string' ? obj.cefr : null,
      senses: obj.senses,
      collocations: Array.isArray(obj.collocations) ? obj.collocations : [],
      family: Array.isArray(obj.family) ? obj.family : [],
    };
  }

  /**
   * Ask for `need` more distinct example sentences for a word — used to top up to
   * MIN_SENTENCES when the first pass came up short. Returns raw items (the
   * guardrail validates them).
   */
  async generateMore(
    lemma: string,
    skillList: string,
    existing: string[],
    need: number,
    context = 'a workplace situation',
  ): Promise<GenItem[]> {
    const system = MORE_SYSTEM.replace(/\{word\}/g, lemma)
      .replace('{need}', String(need))
      .replace('{context}', context)
      .replace('{existing}', existing.map((s) => `- ${s}`).join('\n') || '(none)')
      .replace('{skills}', skillList);
    const raw = await this.llm.generateJson(system, `Word: ${lemma}`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return [];
      parsed = JSON.parse(m[0]);
    }
    const items = (parsed as { items?: unknown })?.items;
    return Array.isArray(items) ? (items as GenItem[]) : [];
  }
}
