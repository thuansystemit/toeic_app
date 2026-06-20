import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Optional human-friendly title for an imported document. Nullable so existing
 * rows stay empty; teachers can set/edit it after import on the Import page.
 */
export class ExamFileTitle1700000008000 implements MigrationInterface {
  name = 'ExamFileTitle1700000008000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "exam_files" ADD COLUMN "title" VARCHAR(255)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "exam_files" DROP COLUMN IF EXISTS "title"`);
  }
}
