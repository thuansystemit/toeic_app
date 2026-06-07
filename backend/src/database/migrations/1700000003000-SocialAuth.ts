import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Social login support: password becomes optional (social accounts have none),
 * plus provider + provider_id columns for Google/Facebook accounts.
 */
export class SocialAuth1700000003000 implements MigrationInterface {
  name = 'SocialAuth1700000003000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`);
    await q.query(`
      ALTER TABLE "users"
      ADD COLUMN "provider" VARCHAR(20) NOT NULL DEFAULT 'local'
        CHECK ("provider" IN ('local', 'google', 'facebook'))
    `);
    await q.query(`ALTER TABLE "users" ADD COLUMN "provider_id" VARCHAR(255)`);
    await q.query(
      `CREATE INDEX "idx_users_provider" ON "users" ("provider", "provider_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_users_provider"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "provider_id"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "provider"`);
    // Note: not restoring NOT NULL on password_hash (social rows may be null).
  }
}
