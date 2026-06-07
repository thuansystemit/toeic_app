import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 2 schema: tests, parts, stimuli, questions, choices, attempts,
 * attempt_answers, attempt_audio_plays, scores, score_conversion_table.
 * Mirrors docs/sdlc/03-architecture.md section 4.
 */
export class TestAttemptScoring1700000001000 implements MigrationInterface {
  name = 'TestAttemptScoring1700000001000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "tests" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" VARCHAR(200) NOT NULL,
        "description" VARCHAR(2000),
        "status" VARCHAR(20) NOT NULL DEFAULT 'draft'
          CHECK ("status" IN ('draft', 'published')),
        "time_limit_minutes" INT NOT NULL DEFAULT 120 CHECK ("time_limit_minutes" >= 1),
        "created_by" UUID NOT NULL REFERENCES "users"("id"),
        "version" INT NOT NULL DEFAULT 1,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX "idx_tests_status" ON "tests" ("status")`);
    await q.query(`CREATE INDEX "idx_tests_created_by" ON "tests" ("created_by")`);

    await q.query(`
      CREATE TABLE "parts" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "test_id" UUID NOT NULL REFERENCES "tests"("id") ON DELETE CASCADE,
        "part_number" INT NOT NULL CHECK ("part_number" BETWEEN 1 AND 7),
        "section" VARCHAR(10) NOT NULL CHECK ("section" IN ('listening', 'reading')),
        "target_question_count" INT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE ("test_id", "part_number")
      )`);
    await q.query(`CREATE INDEX "idx_parts_test_id" ON "parts" ("test_id")`);

    await q.query(`
      CREATE TABLE "stimuli" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "part_id" UUID NOT NULL REFERENCES "parts"("id") ON DELETE CASCADE,
        "type" VARCHAR(20) NOT NULL CHECK ("type" IN ('audio', 'image', 'passage')),
        "storage_key" VARCHAR(500),
        "passage_text" TEXT,
        "original_filename" VARCHAR(255),
        "mime_type" VARCHAR(50),
        "file_size_bytes" BIGINT,
        "sequence" INT NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX "idx_stimuli_part_id" ON "stimuli" ("part_id")`);

    await q.query(`
      CREATE TABLE "questions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "part_id" UUID NOT NULL REFERENCES "parts"("id") ON DELETE CASCADE,
        "stimulus_id" UUID REFERENCES "stimuli"("id") ON DELETE SET NULL,
        "sequence" INT NOT NULL,
        "question_text" TEXT,
        "explanation_vi" VARCHAR(5000),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX "idx_questions_part_id" ON "questions" ("part_id")`);
    await q.query(`CREATE INDEX "idx_questions_stimulus_id" ON "questions" ("stimulus_id")`);
    await q.query(
      `CREATE UNIQUE INDEX "uq_questions_part_sequence" ON "questions" ("part_id", "sequence")`,
    );

    await q.query(`
      CREATE TABLE "choices" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "question_id" UUID NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
        "label" CHAR(1) NOT NULL CHECK ("label" IN ('A', 'B', 'C', 'D')),
        "choice_text" TEXT NOT NULL,
        "is_correct" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE ("question_id", "label")
      )`);
    await q.query(`CREATE INDEX "idx_choices_question_id" ON "choices" ("question_id")`);

    await q.query(`
      CREATE TABLE "attempts" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id"),
        "test_id" UUID NOT NULL REFERENCES "tests"("id"),
        "part_id" UUID REFERENCES "parts"("id"),
        "mode" VARCHAR(10) NOT NULL CHECK ("mode" IN ('full', 'practice')),
        "status" VARCHAR(15) NOT NULL DEFAULT 'in-progress'
          CHECK ("status" IN ('in-progress', 'submitted', 'expired')),
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ,
        "submitted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE UNIQUE INDEX "uq_attempt_in_progress" ON "attempts" ("user_id", "test_id", "mode")
      WHERE "status" = 'in-progress' AND "mode" = 'full'`);
    await q.query(`CREATE INDEX "idx_attempts_user_id" ON "attempts" ("user_id")`);
    await q.query(`CREATE INDEX "idx_attempts_test_id" ON "attempts" ("test_id")`);
    await q.query(`CREATE INDEX "idx_attempts_status" ON "attempts" ("status")`);
    await q.query(`
      CREATE INDEX "idx_attempts_expires_at" ON "attempts" ("expires_at")
      WHERE "status" = 'in-progress' AND "mode" = 'full'`);

    await q.query(`
      CREATE TABLE "attempt_answers" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "attempt_id" UUID NOT NULL REFERENCES "attempts"("id") ON DELETE CASCADE,
        "question_id" UUID NOT NULL REFERENCES "questions"("id"),
        "selected_choice_id" UUID REFERENCES "choices"("id"),
        "is_correct" BOOLEAN,
        "answered_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE ("attempt_id", "question_id")
      )`);
    await q.query(
      `CREATE INDEX "idx_attempt_answers_attempt_id" ON "attempt_answers" ("attempt_id")`,
    );

    await q.query(`
      CREATE TABLE "attempt_audio_plays" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "attempt_id" UUID NOT NULL REFERENCES "attempts"("id") ON DELETE CASCADE,
        "stimulus_id" UUID NOT NULL REFERENCES "stimuli"("id"),
        "played_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE ("attempt_id", "stimulus_id")
      )`);
    await q.query(`CREATE INDEX "idx_aap_attempt_id" ON "attempt_audio_plays" ("attempt_id")`);

    await q.query(`
      CREATE TABLE "scores" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "attempt_id" UUID NOT NULL REFERENCES "attempts"("id") ON DELETE CASCADE,
        "section" VARCHAR(10) NOT NULL CHECK ("section" IN ('listening', 'reading', 'total')),
        "raw_score" INT NOT NULL,
        "scaled_score" INT,
        "scaled_unavailable" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE ("attempt_id", "section")
      )`);
    await q.query(`CREATE INDEX "idx_scores_attempt_id" ON "scores" ("attempt_id")`);

    await q.query(`
      CREATE TABLE "score_conversion_table" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "section" VARCHAR(10) NOT NULL CHECK ("section" IN ('listening', 'reading')),
        "raw_score" INT NOT NULL CHECK ("raw_score" BETWEEN 0 AND 100),
        "scaled_score" INT NOT NULL CHECK ("scaled_score" BETWEEN 5 AND 495),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE ("section", "raw_score")
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "score_conversion_table"`);
    await q.query(`DROP TABLE IF EXISTS "scores"`);
    await q.query(`DROP TABLE IF EXISTS "attempt_audio_plays"`);
    await q.query(`DROP TABLE IF EXISTS "attempt_answers"`);
    await q.query(`DROP TABLE IF EXISTS "attempts"`);
    await q.query(`DROP TABLE IF EXISTS "choices"`);
    await q.query(`DROP TABLE IF EXISTS "questions"`);
    await q.query(`DROP TABLE IF EXISTS "stimuli"`);
    await q.query(`DROP TABLE IF EXISTS "parts"`);
    await q.query(`DROP TABLE IF EXISTS "tests"`);
  }
}
