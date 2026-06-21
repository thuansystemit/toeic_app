import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Knowledge-graph Phase 1 (docs/adr-knowledge-graph.md §B): derived per-learner
 * skill mastery, recomputed from attempts. Postgres-only — no graph DB. Powers
 * weak-skill practice recommendations (§B.2) and the learner's skill summary.
 *
 * `score` is a 0..1 recency-weighted rolling accuracy; `attempts`/`correct` are
 * the raw counts behind it. A row exists per (learner, skill) the learner has
 * answered at least one tagged question for.
 */
export class LearnerSkillMastery1700000010000 implements MigrationInterface {
  name = 'LearnerSkillMastery1700000010000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "learner_skill_mastery" (
        "user_id"    UUID NOT NULL REFERENCES "users"("id")  ON DELETE CASCADE,
        "skill_id"   UUID NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
        "score"      REAL NOT NULL DEFAULT 0,
        "attempts"   INT  NOT NULL DEFAULT 0,
        "correct"    INT  NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id", "skill_id")
      )`);
    await q.query(
      `CREATE INDEX "idx_learner_skill_mastery_user" ON "learner_skill_mastery" ("user_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "learner_skill_mastery"`);
  }
}
