import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public "sample" test: a published test a teacher/admin marks as the single
 * preview guests can view without an account. Nullable/false for existing rows.
 */
export class TestSample1700000009000 implements MigrationInterface {
  name = 'TestSample1700000009000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "tests" ADD COLUMN "is_sample" BOOLEAN NOT NULL DEFAULT false`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "tests" DROP COLUMN IF EXISTS "is_sample"`);
  }
}
