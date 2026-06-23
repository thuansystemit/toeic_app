import { StagedQuestion } from './entities/extraction-job.entity';

/**
 * Server-side guardrail for extracted questions (defense-in-depth — the worker
 * is trusted but its output originates from an LLM and can be malformed).
 *
 * Policy: FLAG, never drop. Every question is kept and persisted to staging, but
 * any that violate a TOEIC invariant get a human-readable note appended to their
 * `issues[]`. The review screen surfaces these, and the import DTO is the hard
 * gate that blocks a still-broken question from reaching the questions table.
 *
 * Structural shape (types, required fields) is already enforced by the callback
 * DTO + global ValidationPipe; this layer checks domain rules only.
 */

const REQUIRED_LABELS = ['A', 'B', 'C', 'D'] as const;

/** Domain checks for one question. Returns the issues found (empty = clean). */
function inspect(q: StagedQuestion): string[] {
  const issues: string[] = [];

  if (!q.questionText || q.questionText.trim() === '') {
    issues.push('empty question text');
  }

  const choices = q.choices ?? [];
  if (choices.length !== 4) {
    issues.push(`expected 4 choices, got ${choices.length}`);
  }

  const labels = choices.map((c) => c.label);
  const missing = REQUIRED_LABELS.filter((l) => !labels.includes(l));
  if (missing.length > 0) {
    issues.push(`missing choice label(s): ${missing.join(', ')}`);
  }
  if (new Set(labels).size !== labels.length) {
    issues.push('duplicate choice labels');
  }

  const blank = choices.filter((c) => !c.text || c.text.trim() === '');
  if (blank.length > 0) {
    issues.push(
      `empty choice text: ${blank.map((c) => c.label).join(', ')}`,
    );
  }

  const correct = choices.filter((c) => c.isCorrect).length;
  if (correct === 0) {
    issues.push('no correct answer marked');
  } else if (correct > 1) {
    issues.push(`multiple correct answers marked (${correct})`);
  }

  return issues;
}

export interface GuardrailResult {
  /** Every input question, kept, with guardrail issues merged into `issues[]`. */
  questions: StagedQuestion[];
  /** Summary lines to append to the job's warnings for the reviewer. */
  warnings: string[];
  /** Count of questions that failed at least one domain check. */
  flaggedCount: number;
}

/**
 * Run the guardrail over the worker's questions before they are saved to the
 * staging table. Merges newly-found issues with any the worker already attached
 * (deduped) and returns a flag count + summary warnings.
 */
export function applyExtractionGuardrail(
  input: StagedQuestion[],
): GuardrailResult {
  const warnings: string[] = [];
  let flaggedCount = 0;

  const questions = input.map((q, i) => {
    const found = inspect(q);
    if (found.length === 0) return q;

    flaggedCount += 1;
    const merged = Array.from(new Set([...(q.issues ?? []), ...found]));
    // Question numbers are 1-based for humans; fall back to the source number.
    const ref = q.number != null ? `#${q.number}` : `index ${i}`;
    warnings.push(`Guardrail ${ref}: ${found.join('; ')}`);
    return { ...q, issues: merged };
  });

  if (flaggedCount > 0) {
    warnings.unshift(
      `Guardrail flagged ${flaggedCount} of ${input.length} question(s) for review.`,
    );
  }

  return { questions, warnings, flaggedCount };
}
