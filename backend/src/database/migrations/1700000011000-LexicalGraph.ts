import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * English Learning Knowledge Graph — P1 lexical layer
 * (docs/adr-english-learning-kg.md §5, §11).
 *
 * A word-centric property graph in Postgres: a Word fans out to Senses,
 * Patterns, Sentences and Exercises, plus collocation / word-relation edges.
 * Patterns and Exercises link to the existing `skills` taxonomy (integration
 * keystone, §8), and `lex_attempts` is the raw history behind
 * `learner_skill_mastery` for vocabulary practice.
 *
 * Generated content carries provenance (`model`, `prompt_version`, `status`) so
 * it can be regenerated and curated — mirroring the staged-question review flow.
 */
export class LexicalGraph1700000011000 implements MigrationInterface {
  name = 'LexicalGraph1700000011000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "lex_words" (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "lemma"          VARCHAR(80)  NOT NULL,
        "pos"            VARCHAR(16)  NOT NULL,
        "cefr"           VARCHAR(4),
        "freq_rank"      INT,
        "status"         VARCHAR(12)  NOT NULL DEFAULT 'generated',
        "source"         VARCHAR(10)  NOT NULL DEFAULT 'llm',
        "model"          VARCHAR(100),
        "prompt_version" VARCHAR(40),
        "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
        UNIQUE ("lemma", "pos")
      )`);

    await q.query(`
      CREATE TABLE "lex_senses" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "word_id"    UUID NOT NULL REFERENCES "lex_words"("id") ON DELETE CASCADE,
        "gloss"      TEXT NOT NULL,
        "gloss_vi"   TEXT,
        "sort_order" INT  NOT NULL DEFAULT 0
      )`);
    await q.query(
      `CREATE INDEX "idx_lex_senses_word" ON "lex_senses" ("word_id")`,
    );

    await q.query(`
      CREATE TABLE "lex_patterns" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"         VARCHAR(120) NOT NULL,
        "template"     VARCHAR(120) NOT NULL UNIQUE,
        "pattern_type" VARCHAR(24)  NOT NULL DEFAULT 'colligation',
        "skill_id"     UUID REFERENCES "skills"("id")
      )`);

    await q.query(`
      CREATE TABLE "lex_word_patterns" (
        "word_id"    UUID NOT NULL REFERENCES "lex_words"("id")    ON DELETE CASCADE,
        "pattern_id" UUID NOT NULL REFERENCES "lex_patterns"("id") ON DELETE CASCADE,
        "display"    VARCHAR(120) NOT NULL,
        PRIMARY KEY ("word_id", "pattern_id")
      )`);

    await q.query(`
      CREATE TABLE "lex_sentences" (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sense_id"       UUID NOT NULL REFERENCES "lex_senses"("id")  ON DELETE CASCADE,
        "pattern_id"     UUID REFERENCES "lex_patterns"("id"),
        "text"           TEXT NOT NULL,
        "target_word_id" UUID NOT NULL REFERENCES "lex_words"("id") ON DELETE CASCADE,
        "target_start"   INT  NOT NULL,
        "target_len"     INT  NOT NULL,
        "cefr"           VARCHAR(4),
        "status"         VARCHAR(12) NOT NULL DEFAULT 'generated',
        "source"         VARCHAR(10) NOT NULL DEFAULT 'llm',
        "created_by"     UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(
      `CREATE INDEX "idx_lex_sentences_sense" ON "lex_sentences" ("sense_id")`,
    );

    await q.query(`
      CREATE TABLE "lex_exercises" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sentence_id" UUID NOT NULL REFERENCES "lex_sentences"("id") ON DELETE CASCADE,
        "kind"        VARCHAR(16) NOT NULL DEFAULT 'cloze',
        "prompt"      TEXT NOT NULL,
        "answer"      VARCHAR(80) NOT NULL,
        "distractors" JSONB,
        "skill_id"    UUID REFERENCES "skills"("id"),
        "status"      VARCHAR(12) NOT NULL DEFAULT 'generated',
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(
      `CREATE INDEX "idx_lex_exercises_sentence" ON "lex_exercises" ("sentence_id")`,
    );
    await q.query(
      `CREATE INDEX "idx_lex_exercises_skill" ON "lex_exercises" ("skill_id")`,
    );

    await q.query(`
      CREATE TABLE "lex_collocations" (
        "head_word_id" UUID NOT NULL REFERENCES "lex_words"("id") ON DELETE CASCADE,
        "collocate"    VARCHAR(80) NOT NULL,
        "relation"     VARCHAR(24) NOT NULL,
        "strength"     REAL,
        PRIMARY KEY ("head_word_id", "collocate", "relation")
      )`);

    await q.query(`
      CREATE TABLE "lex_word_relations" (
        "from_word_id" UUID NOT NULL REFERENCES "lex_words"("id") ON DELETE CASCADE,
        "to_lemma"     VARCHAR(80) NOT NULL,
        "relation"     VARCHAR(16) NOT NULL,
        PRIMARY KEY ("from_word_id", "to_lemma", "relation")
      )`);

    await q.query(`
      CREATE TABLE "lex_attempts" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"     UUID NOT NULL REFERENCES "users"("id")         ON DELETE CASCADE,
        "exercise_id" UUID NOT NULL REFERENCES "lex_exercises"("id") ON DELETE CASCADE,
        "answer"      VARCHAR(120) NOT NULL,
        "is_correct"  BOOLEAN NOT NULL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(
      `CREATE INDEX "idx_lex_attempts_user" ON "lex_attempts" ("user_id")`,
    );
    await q.query(
      `CREATE INDEX "idx_lex_attempts_exercise" ON "lex_attempts" ("exercise_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "lex_attempts"`);
    await q.query(`DROP TABLE IF EXISTS "lex_word_relations"`);
    await q.query(`DROP TABLE IF EXISTS "lex_collocations"`);
    await q.query(`DROP TABLE IF EXISTS "lex_exercises"`);
    await q.query(`DROP TABLE IF EXISTS "lex_sentences"`);
    await q.query(`DROP TABLE IF EXISTS "lex_word_patterns"`);
    await q.query(`DROP TABLE IF EXISTS "lex_patterns"`);
    await q.query(`DROP TABLE IF EXISTS "lex_senses"`);
    await q.query(`DROP TABLE IF EXISTS "lex_words"`);
  }
}
