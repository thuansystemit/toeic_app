import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Widen the relation labels on the lexical-graph edge tables. The generator can
 * return relation descriptors longer than the original varchar(24)/(16) (e.g.
 * "verb + noun (object)"), and because collocations/word-relations are inserted
 * inside the word's persist transaction, an overflow there rolled back the whole
 * word. Code now also truncates these values defensively (vocab.service).
 */
export class LexRelationWiden1700000012000 implements MigrationInterface {
  name = 'LexRelationWiden1700000012000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "lex_collocations" ALTER COLUMN "relation" TYPE VARCHAR(40)`,
    );
    await q.query(
      `ALTER TABLE "lex_word_relations" ALTER COLUMN "relation" TYPE VARCHAR(40)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "lex_word_relations" ALTER COLUMN "relation" TYPE VARCHAR(16)`,
    );
    await q.query(
      `ALTER TABLE "lex_collocations" ALTER COLUMN "relation" TYPE VARCHAR(24)`,
    );
  }
}
