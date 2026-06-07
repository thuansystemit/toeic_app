import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 1 auth slice schema: users + refresh_tokens + password_reset_tokens.
 * Mirrors the DDL sketches in docs/sdlc/03-architecture.md (section 4).
 */
export class InitAuth1700000000000 implements MigrationInterface {
  name = 'InitAuth1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) NOT NULL,
        "password_hash" VARCHAR(255) NOT NULL,
        "display_name" VARCHAR(100) NOT NULL,
        "role" VARCHAR(20) NOT NULL DEFAULT 'learner'
          CHECK ("role" IN ('admin', 'teacher', 'learner')),
        "status" VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK ("status" IN ('active', 'deactivated')),
        "preferred_locale" VARCHAR(5) NOT NULL DEFAULT 'vi',
        "last_login_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    // REQ-008: case-insensitive uniqueness; DB constraint resolves registration races (NFR-003)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_email" ON "users" (LOWER("email"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" VARCHAR(255) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "revoked" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")`,
    );

    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" VARCHAR(255) NOT NULL UNIQUE,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_prt_token_hash" ON "password_reset_tokens" ("token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
