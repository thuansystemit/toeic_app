import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chatbot (AI study assistant) — conversations + messages.
 * See docs/feature-chatbot-analysis.md. P1: streaming chat persisted per user.
 */
export class Chat1700000013000 implements MigrationInterface {
  name = 'Chat1700000013000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "chat_conversations" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title"      VARCHAR(200),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(
      `CREATE INDEX "idx_chat_conv_user" ON "chat_conversations" ("user_id", "updated_at" DESC)`,
    );

    await q.query(`
      CREATE TABLE "chat_messages" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversation_id" UUID NOT NULL REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
        "role"            VARCHAR(16) NOT NULL CHECK ("role" IN ('system','user','assistant')),
        "content"         TEXT NOT NULL,
        "model"           VARCHAR(100),
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(
      `CREATE INDEX "idx_chat_msg_conv" ON "chat_messages" ("conversation_id", "created_at" ASC)`,
    );
    await q.query(
      `CREATE INDEX "idx_chat_msg_user_day" ON "chat_messages" ("created_at")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "chat_messages"`);
    await q.query(`DROP TABLE IF EXISTS "chat_conversations"`);
  }
}
