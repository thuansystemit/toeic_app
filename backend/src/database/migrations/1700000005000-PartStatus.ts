import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-part publishing (REQ: teachers publish each part independently).
 *  - parts.status: 'draft' | 'published'. A learner may practice a part only
 *    when both its test and the part itself are published.
 *  - Backfill: parts of an already-published test are marked published so the
 *    existing learner experience is preserved.
 */
export class PartStatus1700000005000 implements MigrationInterface {
  name = 'PartStatus1700000005000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "parts"
      ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK ("status" IN ('draft','published'))
    `);
    await q.query(`
      UPDATE "parts" SET "status" = 'published'
      WHERE "test_id" IN (SELECT "id" FROM "tests" WHERE "status" = 'published')
    `);
    await q.query(`CREATE INDEX "idx_parts_status" ON "parts" ("status")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_parts_status"`);
    await q.query(`ALTER TABLE "parts" DROP COLUMN IF EXISTS "status"`);
  }
}
