import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { MasteryService } from '../mastery/mastery.service';
import {
  MIN_SENTENCES,
  VocabGenerator,
  VOCAB_PROMPT_VERSION,
} from './vocab.generator';
import { validateGenerated, validateItem } from './vocab.guardrail';
import { normalizeLemma, toLemma } from './vocab.lemmatizer';
import { ValidItem, ValidWord, VocabResponse } from './vocab.types';

/** Function/grammar words skipped when building vocab nodes from answers — TOEIC
 *  Part 5 also tests grammar, so these answers aren't useful vocabulary. */
const STOP_WORDS = new Set([
  // articles / determiners
  'the', 'this', 'that', 'these', 'those', 'some', 'any', 'each', 'every',
  'all', 'both', 'either', 'neither', 'such', 'much', 'many', 'few', 'several',
  'another', 'other', 'most', 'more',
  // pronouns
  'you', 'she', 'her', 'his', 'him', 'its', 'our', 'their', 'they', 'them',
  'your', 'yours', 'hers', 'ours', 'theirs', 'who', 'whom', 'whose', 'which',
  'what', 'whoever', 'whatever', 'one', 'ones', 'someone', 'anyone', 'everyone',
  // prepositions
  'for', 'from', 'with', 'into', 'onto', 'upon', 'about', 'above', 'below',
  'under', 'over', 'before', 'after', 'during', 'until', 'since', 'between',
  'among', 'through', 'against', 'without', 'within', 'prior', 'toward',
  'towards', 'across', 'behind', 'beyond', 'near', 'off',
  // conjunctions
  'and', 'but', 'nor', 'yet', 'because', 'although', 'though', 'while',
  'whereas', 'unless', 'whether', 'however', 'therefore', 'moreover',
  // aux / modal
  'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'will', 'would',
  'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'does', 'did',
  // common adverbs / misc
  'not', 'also', 'too', 'very', 'just', 'still', 'even', 'only', 'then', 'than',
  'when', 'where', 'why', 'how', 'here', 'there', 'always', 'never', 'often',
  'usually', 'soon', 'already', 'yet',
]);

/** Grade feedback returned after a learner answers an exercise. */
export interface AttemptResult {
  correct: boolean;
  correctAnswer: string;
  meaning: string | null;
  pattern: string | null;
}

/**
 * English Learning Knowledge Graph — word lookup with generate-and-cache, plus
 * server-side exercise grading (docs/adr-english-learning-kg.md §6, §8, §11).
 * Persistence/traversal is raw SQL over the `lex_*` tables (same style as
 * MasteryService); generation is guardrail-validated before it is cached.
 */
@Injectable()
export class VocabService {
  private readonly logger = new Logger(VocabService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly generator: VocabGenerator,
    private readonly mastery: MasteryService,
  ) {}

  /** Look up a word: serve from the graph, or generate-validate-cache on a miss. */
  async lookup(input: string): Promise<VocabResponse> {
    const lemma = toLemma(input);
    let wordId = await this.findWordId(lemma);
    if (!wordId) {
      wordId = await this.generateAndPersist(lemma);
    }
    return this.assemble(wordId);
  }

  /**
   * Seed the graph from a list of raw answer strings (e.g. extracted question
   * answers): keep only single-word entries, dedupe, and generate-and-cache each
   * in the BACKGROUND so it becomes a word node with its sentences — exactly like
   * a user lookup. Returns the distinct words that will be processed.
   */
  prewarm(rawAnswers: string[]): string[] {
    const words = Array.from(
      new Set(
        rawAnswers
          .map((a) => (a ?? '').trim().toLowerCase())
          // single word, letters only, and long enough to be a content word
          .filter((a) => /^[a-z][a-z'-]{2,}$/.test(a))
          // skip grammar/function answers (Part 5 also tests grammar) — they
          // aren't useful vocabulary nodes. Surface form is kept as-is (no
          // lemmatizing) so inflected answers like "composed" stay real words.
          .filter((a) => !STOP_WORDS.has(a)),
      ),
    );
    // Fire-and-forget; sequential so we don't hammer the LLM host.
    void this.prewarmSequential(words);
    return words;
  }

  private async prewarmSequential(words: string[]): Promise<void> {
    let made = 0;
    for (const lemma of words) {
      try {
        if (await this.findWordId(lemma)) continue; // already cached
        await this.generateAndPersist(lemma);
        made++;
      } catch (e) {
        this.logger.warn(`prewarm "${lemma}" failed: ${(e as Error).message}`);
      }
    }
    this.logger.log(
      `prewarm done: ${made} generated, ${words.length - made} already cached/failed`,
    );
  }

  private async findWordId(lemma: string): Promise<string | null> {
    const rows: { id: string }[] = await this.db.query(
      `SELECT id FROM lex_words WHERE lemma = $1 ORDER BY created_at ASC LIMIT 1`,
      [lemma],
    );
    return rows[0]?.id ?? null;
  }

  // --- generation + caching ---

  private async loadSkills(): Promise<{ map: Map<string, string>; list: string }> {
    const rows: { id: string; code: string; name: string }[] = await this.db.query(
      `SELECT id, code, name FROM skills ORDER BY code`,
    );
    const map = new Map(rows.map((r) => [r.code, r.id]));
    const list = rows.map((r) => `${r.code} — ${r.name}`).join('\n');
    return { map, list };
  }

  private async generateAndPersist(lemma: string): Promise<string> {
    const { map, list } = await this.loadSkills();
    const gen = await this.generator.generate(lemma, list);
    const valid = validateGenerated(lemma, gen, map);
    if (valid.senses.length === 0) {
      throw new NotFoundException(
        `Could not generate usable content for "${lemma}"`,
      );
    }
    // Top up to at least MIN_SENTENCES example sentences (small models often
    // return fewer than asked in one shot).
    await this.ensureMinSentences(lemma, valid, list, map);
    if (valid.flagged.length) {
      this.logger.warn(`vocab "${lemma}" guardrail: ${valid.flagged.join('; ')}`);
    }

    const qr = this.db.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const wordId = await this.persist(qr, valid);
      await qr.commitTransaction();
      return wordId;
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  /**
   * Ensure a word ends up with at least MIN_SENTENCES distinct example sentences,
   * topping up via extra LLM calls. Each new sentence is guardrail-validated and
   * de-duplicated; appended to the first sense. Best-effort: capped rounds, and
   * stops early if a round yields nothing new (so a stubborn model can't loop).
   */
  private async ensureMinSentences(
    lemma: string,
    valid: ValidWord,
    skillList: string,
    skillMap: Map<string, string>,
  ): Promise<void> {
    // Distinct contexts per round push a small model to produce genuinely
    // different sentences instead of rewording the same one.
    const CONTEXTS = [
      'a workplace email',
      'a phone conversation',
      'a team meeting',
      'a customer-service exchange',
      'a travel or daily-life situation',
      'a news or announcement',
    ];
    const MAX_ROUNDS = 6;
    const existing = valid.senses.flatMap((s) => s.items.map((i) => i.sentenceText));
    const seen = new Set(existing.map((t) => t.toLowerCase()));
    let count = existing.length;
    let emptyStreak = 0; // consecutive rounds that produced nothing new

    for (let round = 0; count < MIN_SENTENCES && round < MAX_ROUNDS; round++) {
      let raw;
      try {
        raw = await this.generator.generateMore(
          lemma,
          skillList,
          existing,
          MIN_SENTENCES - count + 3, // ask for extra to absorb drops/duplicates
          CONTEXTS[round % CONTEXTS.length],
        );
      } catch (e) {
        this.logger.warn(`vocab "${lemma}" top-up failed: ${(e as Error).message}`);
        break;
      }
      const fresh: ValidItem[] = [];
      for (const it of raw) {
        const v = validateItem(lemma, valid.pos, it, skillMap, valid.flagged, 'top-up');
        if (!v) continue;
        const key = v.sentenceText.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        existing.push(v.sentenceText);
        fresh.push(v);
      }
      if (fresh.length === 0) {
        // Give the model one more chance before giving up (it sometimes repeats
        // for a round, then produces new sentences).
        if (++emptyStreak >= 2) break;
        continue;
      }
      emptyStreak = 0;
      valid.senses[0].items.push(...fresh);
      count += fresh.length;
    }

    if (count < MIN_SENTENCES) {
      this.logger.warn(
        `vocab "${lemma}": only ${count}/${MIN_SENTENCES} sentences after top-up`,
      );
    }
  }

  private async persist(qr: QueryRunner, w: ValidWord): Promise<string> {
    const [{ id: wordId }]: { id: string }[] = await qr.query(
      `INSERT INTO lex_words (lemma, pos, cefr, status, source, model, prompt_version)
       VALUES ($1, $2, $3, 'generated', 'llm', $4, $5)
       ON CONFLICT (lemma, pos) DO UPDATE SET model = EXCLUDED.model
       RETURNING id`,
      // Truncate column-bound fields defensively (cefr/pos are already
      // normalized by the guardrail; this guards any remaining overflow).
      [w.lemma.slice(0, 80), w.pos.slice(0, 16), w.cefr, this.generator.model, VOCAB_PROMPT_VERSION],
    );

    for (const sense of w.senses) {
      const [{ id: senseId }]: { id: string }[] = await qr.query(
        `INSERT INTO lex_senses (word_id, gloss, gloss_vi, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [wordId, sense.gloss, sense.glossVi, sense.sortOrder],
      );

      for (const item of sense.items) {
        const [{ id: patternId }]: { id: string }[] = await qr.query(
          `INSERT INTO lex_patterns (name, template, pattern_type, skill_id)
           VALUES ($1, $2, 'colligation', $3)
           ON CONFLICT (template)
             DO UPDATE SET skill_id = COALESCE(lex_patterns.skill_id, EXCLUDED.skill_id)
           RETURNING id`,
          [item.patternName.slice(0, 120), item.patternTemplate.slice(0, 120), item.skillId],
        );
        await qr.query(
          `INSERT INTO lex_word_patterns (word_id, pattern_id, display)
           VALUES ($1, $2, $3) ON CONFLICT (word_id, pattern_id) DO NOTHING`,
          [wordId, patternId, item.patternDisplay.slice(0, 120)],
        );
        const [{ id: sentenceId }]: { id: string }[] = await qr.query(
          `INSERT INTO lex_sentences
             (sense_id, pattern_id, text, target_word_id, target_start, target_len, source)
           VALUES ($1, $2, $3, $4, $5, $6, 'llm') RETURNING id`,
          [senseId, patternId, item.sentenceText, wordId, item.targetStart, item.targetLen],
        );
        await qr.query(
          `INSERT INTO lex_exercises (sentence_id, kind, prompt, answer, skill_id)
           VALUES ($1, 'cloze', $2, $3, $4)`,
          [sentenceId, item.exercisePrompt, item.exerciseAnswer.slice(0, 80), item.skillId],
        );
      }
    }

    // Truncate to the column limits — a long LLM relation/collocate must never
    // overflow and abort the whole word's transaction (secondary data).
    for (const c of w.collocations) {
      await qr.query(
        `INSERT INTO lex_collocations (head_word_id, collocate, relation)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [wordId, c.collocate.slice(0, 80), (c.relation || 'related').slice(0, 40)],
      );
    }
    for (const f of w.family) {
      await qr.query(
        `INSERT INTO lex_word_relations (from_word_id, to_lemma, relation)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [
          wordId,
          normalizeLemma(f.lemma).slice(0, 80),
          (f.relation || 'related').slice(0, 40),
        ],
      );
    }
    return wordId;
  }

  // --- assembly (graph -> API response) ---

  private async assemble(wordId: string): Promise<VocabResponse> {
    const [word]: { lemma: string; pos: string; cefr: string | null }[] =
      await this.db.query(
        `SELECT lemma, pos, cefr FROM lex_words WHERE id = $1`,
        [wordId],
      );
    if (!word) throw new NotFoundException('Word not found');

    const rows: {
      sense_id: string;
      gloss: string;
      gloss_vi: string | null;
      sort_order: number;
      display: string | null;
      pattern_skill: string | null;
      sentence: string | null;
      exercise_id: string | null;
      prompt: string | null;
      exercise_skill: string | null;
    }[] = await this.db.query(
      `SELECT sn.id            AS sense_id,
              sn.gloss         AS gloss,
              sn.gloss_vi      AS gloss_vi,
              sn.sort_order    AS sort_order,
              wp.display       AS display,
              skp.code         AS pattern_skill,
              se.text          AS sentence,
              ex.id            AS exercise_id,
              ex.prompt        AS prompt,
              ske.code         AS exercise_skill
       FROM lex_senses sn
       LEFT JOIN lex_sentences se ON se.sense_id = sn.id
       LEFT JOIN lex_patterns  p  ON p.id = se.pattern_id
       LEFT JOIN lex_word_patterns wp ON wp.pattern_id = se.pattern_id AND wp.word_id = $1
       LEFT JOIN skills skp ON skp.id = p.skill_id
       LEFT JOIN lex_exercises ex ON ex.sentence_id = se.id
       LEFT JOIN skills ske ON ske.id = ex.skill_id
       WHERE sn.word_id = $1
       ORDER BY sn.sort_order ASC, se.id ASC`,
      [wordId],
    );

    // Group rows by sense.
    const senseMap = new Map<string, VocabResponse['senses'][number] & { _patterns: Set<string> }>();
    const order: string[] = [];
    for (const r of rows) {
      let s = senseMap.get(r.sense_id);
      if (!s) {
        s = {
          meaning: r.gloss,
          meaningVi: r.gloss_vi,
          patterns: [],
          sentences: [],
          _patterns: new Set<string>(),
        };
        senseMap.set(r.sense_id, s);
        order.push(r.sense_id);
      }
      if (r.display && !s._patterns.has(r.display)) {
        s._patterns.add(r.display);
        s.patterns.push({ display: r.display, skill: r.pattern_skill });
      }
      if (r.sentence && r.exercise_id) {
        s.sentences.push({
          text: r.sentence,
          exercise: { id: r.exercise_id, prompt: r.prompt!, skill: r.exercise_skill },
        });
      }
    }

    const [collocations, family] = await Promise.all([
      this.db.query(
        `SELECT collocate FROM lex_collocations WHERE head_word_id = $1`,
        [wordId],
      ),
      this.db.query(
        `SELECT to_lemma FROM lex_word_relations WHERE from_word_id = $1`,
        [wordId],
      ),
    ]);

    return {
      word: word.lemma,
      pos: word.pos,
      cefr: word.cefr,
      senses: order.map((id) => {
        const { _patterns, ...rest } = senseMap.get(id)!;
        void _patterns;
        return rest;
      }),
      collocations: (collocations as { collocate: string }[]).map((c) => c.collocate),
      wordFamily: (family as { to_lemma: string }[]).map((f) => f.to_lemma),
    };
  }

  // --- answer the exercise (§12.1) ---

  async attempt(
    userId: string,
    exerciseId: string,
    answer: string,
  ): Promise<AttemptResult> {
    const [ex]: {
      answer: string;
      skill_id: string | null;
      meaning: string | null;
      pattern: string | null;
    }[] = await this.db.query(
      `SELECT ex.answer        AS answer,
              ex.skill_id      AS skill_id,
              sn.gloss         AS meaning,
              wp.display       AS pattern
       FROM lex_exercises ex
       JOIN lex_sentences se ON se.id = ex.sentence_id
       JOIN lex_senses    sn ON sn.id = se.sense_id
       LEFT JOIN lex_word_patterns wp
              ON wp.pattern_id = se.pattern_id AND wp.word_id = se.target_word_id
       WHERE ex.id = $1`,
      [exerciseId],
    );
    if (!ex) throw new NotFoundException('Exercise not found');

    const correct = normalizeLemma(answer) === normalizeLemma(ex.answer);
    await this.db.query(
      `INSERT INTO lex_attempts (user_id, exercise_id, answer, is_correct)
       VALUES ($1, $2, $3, $4)`,
      [userId, exerciseId, answer.slice(0, 120), correct],
    );
    // Feed the same per-skill mastery model as TOEIC questions (§8).
    if (ex.skill_id) {
      await this.mastery.recomputeForVocab(userId, ex.skill_id);
    }
    return {
      correct,
      correctAnswer: ex.answer,
      meaning: ex.meaning,
      pattern: ex.pattern,
    };
  }
}
