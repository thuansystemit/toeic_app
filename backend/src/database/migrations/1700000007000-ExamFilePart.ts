import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-part upload (redesign): a teacher splits the source and uploads ONE
 * document per reading part (5, 6 or 7). Storing the target part lets the
 * extraction worker be told the part instead of guessing it, which eliminates
 * cross-part misclassification.
 */
export class ExamFilePart1700000007000 implements MigrationInterface {
  name = 'ExamFilePart1700000007000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "exam_files" ADD COLUMN "part" INT
         CHECK ("part" IS NULL OR "part" BETWEEN 1 AND 7)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "exam_files" DROP COLUMN IF EXISTS "part"`);
  }
}
