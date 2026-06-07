import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PDF/DOCX exam-file management + LLM question extraction.
 *  - exam_files: uploaded source documents and their lifecycle status.
 *  - extraction_jobs: one extraction run per file; staged questions live in
 *    JSONB until a teacher reviews and commits them to the authoring tables.
 */
export class ExamFiles1700000004000 implements MigrationInterface {
  name = 'ExamFiles1700000004000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "exam_files" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "original_filename" VARCHAR(255) NOT NULL,
        "storage_key" VARCHAR(500) NOT NULL,
        "mime_type" VARCHAR(100) NOT NULL,
        "size_bytes" BIGINT NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'uploaded'
          CHECK ("status" IN ('uploaded','queued','extracting','extracted','failed','imported')),
        "uploaded_by" UUID NOT NULL REFERENCES "users"("id"),
        "test_id" UUID REFERENCES "tests"("id") ON DELETE SET NULL,
        "question_count" INT NOT NULL DEFAULT 0,
        "error" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX "idx_exam_files_uploaded_by" ON "exam_files" ("uploaded_by")`);
    await q.query(`CREATE INDEX "idx_exam_files_status" ON "exam_files" ("status")`);

    await q.query(`
      CREATE TABLE "extraction_jobs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "exam_file_id" UUID NOT NULL REFERENCES "exam_files"("id") ON DELETE CASCADE,
        "provider" VARCHAR(20) NOT NULL DEFAULT 'ollama',
        "model" VARCHAR(100),
        "status" VARCHAR(20) NOT NULL DEFAULT 'queued'
          CHECK ("status" IN ('queued','running','succeeded','failed')),
        "warnings" JSONB,
        "usage" JSONB,
        "staged_questions" JSONB,
        "error" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await q.query(
      `CREATE INDEX "idx_extraction_jobs_exam_file_id" ON "extraction_jobs" ("exam_file_id")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "extraction_jobs"`);
    await q.query(`DROP TABLE IF EXISTS "exam_files"`);
  }
}
