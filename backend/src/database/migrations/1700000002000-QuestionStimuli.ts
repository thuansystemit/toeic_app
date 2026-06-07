import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Allow a question to own multiple stimuli (e.g. TOEIC Part 1 = image + audio
 * on the same question). Previously a question referenced a single stimulus via
 * questions.stimulus_id; now stimuli.question_id gives a one-to-many link.
 */
export class QuestionStimuli1700000002000 implements MigrationInterface {
  name = 'QuestionStimuli1700000002000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "stimuli"
      ADD COLUMN "question_id" UUID REFERENCES "questions"("id") ON DELETE CASCADE
    `);
    await q.query(
      `CREATE INDEX "idx_stimuli_question_id" ON "stimuli" ("question_id")`,
    );
    // Backfill: link existing single-stimulus questions to their stimulus.
    await q.query(`
      UPDATE "stimuli" s
      SET "question_id" = qz."id"
      FROM "questions" qz
      WHERE qz."stimulus_id" = s."id" AND s."question_id" IS NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_stimuli_question_id"`);
    await q.query(`ALTER TABLE "stimuli" DROP COLUMN IF EXISTS "question_id"`);
  }
}
