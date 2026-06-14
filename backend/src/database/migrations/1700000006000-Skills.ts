import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Knowledge-graph Phase 1 (docs/adr-knowledge-graph.md): the skill taxonomy and
 * the keystone Question->Skill tags, in Postgres (no graph DB yet).
 *  - skills: curated TOEIC taxonomy (Reading scope for MVP).
 *  - question_skills: which skills a question tests; source 'human' (teacher
 *    tagging in the editor) or 'llm' (future auto-tagging at import).
 */
export class Skills1700000006000 implements MigrationInterface {
  name = 'Skills1700000006000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "skills" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "code"       VARCHAR(20)  UNIQUE NOT NULL,
        "name"       VARCHAR(120) NOT NULL,
        "section"    VARCHAR(10)  NOT NULL CHECK ("section" IN ('reading','listening')),
        "category"   VARCHAR(20)  NOT NULL,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE "question_skills" (
        "question_id" UUID NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
        "skill_id"    UUID NOT NULL REFERENCES "skills"("id")    ON DELETE CASCADE,
        "source"      VARCHAR(10) NOT NULL DEFAULT 'human' CHECK ("source" IN ('llm','human')),
        "confidence"  REAL,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY ("question_id", "skill_id")
      )`);
    await q.query(
      `CREATE INDEX "idx_question_skills_skill" ON "question_skills" ("skill_id")`,
    );

    // Seed the Reading taxonomy (ADR Appendix A).
    const skills: [string, string, string][] = [
      // grammar
      ['G-TENSE', 'Verb tense & aspect', 'grammar'],
      ['G-SVA', 'Subject–verb agreement', 'grammar'],
      ['G-PREP', 'Prepositions', 'grammar'],
      ['G-CONJ', 'Conjunctions & transitions', 'grammar'],
      ['G-PRON', 'Pronouns & reference', 'grammar'],
      ['G-RELCL', 'Relative clauses', 'grammar'],
      ['G-COMP', 'Comparatives & superlatives', 'grammar'],
      ['G-WFORM', 'Word form (part of speech)', 'grammar'],
      ['G-VERBAL', 'Gerunds & infinitives', 'grammar'],
      ['G-COND', 'Conditionals', 'grammar'],
      ['G-VOICE', 'Active / passive voice', 'grammar'],
      ['G-DET', 'Articles & determiners', 'grammar'],
      ['G-MODAL', 'Modal verbs', 'grammar'],
      // lexical
      ['L-VOCAB', 'Vocabulary in context', 'lexical'],
      ['L-COLLOC', 'Collocations', 'lexical'],
      ['L-WCHOICE', 'Word choice / usage', 'lexical'],
      // discourse
      ['D-INSERT', 'Sentence insertion', 'discourse'],
      ['D-COHESION', 'Cohesion / transition selection', 'discourse'],
      // comprehension
      ['R-GIST', 'Main idea / gist', 'comprehension'],
      ['R-DETAIL', 'Specific detail', 'comprehension'],
      ['R-INFER', 'Inference', 'comprehension'],
      ['R-VIC', 'Vocabulary in context (passage)', 'comprehension'],
      ['R-PURPOSE', 'Purpose / tone / audience', 'comprehension'],
      ['R-NOTTRUE', 'NOT / true (exception)', 'comprehension'],
      ['R-XREF', 'Cross-reference (multi-passage)', 'comprehension'],
      ['R-INTENT', 'Implied meaning (message intent)', 'comprehension'],
    ];
    const values = skills
      .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, 'reading', $${i * 3 + 3})`)
      .join(', ');
    const params = skills.flat();
    await q.query(
      `INSERT INTO "skills" ("code", "name", "section", "category") VALUES ${values}`,
      params,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "question_skills"`);
    await q.query(`DROP TABLE IF EXISTS "skills"`);
  }
}
