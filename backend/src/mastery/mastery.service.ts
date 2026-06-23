import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LearnerSkillMastery } from './entities/learner-skill-mastery.entity';

/** A skill the learner has practised, with their current mastery. */
export interface SkillMasteryView {
  skillId: string;
  code: string;
  name: string;
  category: string;
  score: number; // 0..1
  attempts: number;
  correct: number;
}

/** A weak skill plus the best practiceable part to drill it. */
export interface PracticeRecommendation {
  skillId: string;
  code: string;
  name: string;
  category: string;
  score: number;
  unseen: number; // unanswered tagged questions available in the suggested part
  testId: string;
  testTitle: string;
  partId: string;
  partNumber: number;
  section: string;
}

/**
 * Per-learner skill mastery (ADR knowledge-graph Phase 1, §B). Recomputes a
 * recency-weighted rolling accuracy from attempts and turns the weakest skills
 * into deep links back into the existing per-part practice flow. Postgres-only.
 */
@Injectable()
export class MasteryService {
  /** Daily decay for the recency weight: w = DECAY ^ age_in_days (§B.3). */
  private static readonly DECAY = 0.97;
  /** A skill counts as "weak" below this mastery. */
  private static readonly WEAK_THRESHOLD = 0.6;

  constructor(
    @InjectRepository(LearnerSkillMastery)
    private readonly mastery: Repository<LearnerSkillMastery>,
  ) {}

  /**
   * Recompute mastery for every skill touched by a just-finalized attempt.
   * Driven by the questions the learner answered; each affected skill is
   * recomputed from the learner's full graded history for that skill.
   */
  async recomputeForAttempt(userId: string, questionIds: string[]): Promise<void> {
    if (questionIds.length === 0) return;

    // Which skills do the answered questions test? (nothing to do if untagged)
    const skillRows: { skill_id: string }[] = await this.mastery.manager.query(
      `SELECT DISTINCT skill_id FROM question_skills WHERE question_id = ANY($1)`,
      [questionIds],
    );
    await this.recomputeSkills(userId, skillRows.map((r) => r.skill_id));
  }

  /**
   * Recompute mastery for the skill a just-answered vocabulary exercise tests
   * (English Learning KG §8). Vocab and question practice share one mastery row.
   */
  async recomputeForVocab(userId: string, skillId: string): Promise<void> {
    await this.recomputeSkills(userId, [skillId]);
  }

  /**
   * Recompute each given skill from the learner's whole graded history —
   * **unioning** TOEIC question attempts and vocabulary exercise attempts so the
   * two practice surfaces feed one recency-weighted score. When a learner has no
   * vocab attempts the vocab branch contributes nothing, so question-only
   * behaviour is unchanged.
   */
  private async recomputeSkills(userId: string, skillIds: string[]): Promise<void> {
    if (skillIds.length === 0) return;

    const agg: {
      skill_id: string;
      attempts: string;
      correct: string;
      score: number | null;
    }[] = await this.mastery.manager.query(
      `
      WITH graded AS (
        SELECT qs.skill_id,
               aa.is_correct,
               POWER($2::float8,
                     EXTRACT(EPOCH FROM (now() - COALESCE(aa.answered_at, a.submitted_at, now())))
                     / 86400.0) AS w
        FROM attempt_answers aa
        JOIN attempts a       ON a.id = aa.attempt_id
        JOIN question_skills qs ON qs.question_id = aa.question_id
        WHERE a.user_id = $1
          AND a.status IN ('submitted', 'expired')
          AND aa.is_correct IS NOT NULL
          AND qs.skill_id = ANY($3)
        UNION ALL
        SELECT ex.skill_id,
               la.is_correct,
               POWER($2::float8,
                     EXTRACT(EPOCH FROM (now() - la.created_at)) / 86400.0) AS w
        FROM lex_attempts la
        JOIN lex_exercises ex ON ex.id = la.exercise_id
        WHERE la.user_id = $1
          AND ex.skill_id IS NOT NULL
          AND ex.skill_id = ANY($3)
      )
      SELECT skill_id,
             COUNT(*)                                   AS attempts,
             COUNT(*) FILTER (WHERE is_correct)         AS correct,
             SUM(w * (CASE WHEN is_correct THEN 1 ELSE 0 END)) / NULLIF(SUM(w), 0) AS score
      FROM graded
      GROUP BY skill_id
      `,
      [userId, MasteryService.DECAY, skillIds],
    );

    for (const row of agg) {
      await this.mastery.upsert(
        {
          userId,
          skillId: row.skill_id,
          attempts: Number(row.attempts),
          correct: Number(row.correct),
          score: row.score ?? 0,
        },
        ['userId', 'skillId'],
      );
    }
  }

  /** The learner's mastery across every skill they've practised (weakest first). */
  async getSummary(userId: string): Promise<SkillMasteryView[]> {
    const rows: SkillMasteryView[] = await this.mastery.manager.query(
      `
      SELECT m.skill_id  AS "skillId",
             s.code       AS code,
             s.name       AS name,
             s.category   AS category,
             m.score      AS score,
             m.attempts   AS attempts,
             m.correct    AS correct
      FROM learner_skill_mastery m
      JOIN skills s ON s.id = m.skill_id
      WHERE m.user_id = $1
      ORDER BY m.score ASC, s.code ASC
      `,
      [userId],
    );
    // node-postgres returns numerics as strings; normalise for the API.
    return rows.map((r) => ({
      ...r,
      score: Number(r.score),
      attempts: Number(r.attempts),
      correct: Number(r.correct),
    }));
  }

  /**
   * Weak-skill practice (§B.2): the learner's weakest skills, each paired with
   * the published part that has the most unseen questions testing that skill.
   * Returns one recommendation per weak skill that still has unseen material.
   */
  async getRecommendations(
    userId: string,
    limit = 6,
  ): Promise<PracticeRecommendation[]> {
    const rows: (Omit<PracticeRecommendation, 'score' | 'unseen' | 'partNumber'> & {
      score: number | string;
      unseen: number | string;
      partNumber: number | string;
    })[] = await this.mastery.manager.query(
      `
      WITH weak AS (
        SELECT skill_id, score
        FROM learner_skill_mastery
        WHERE user_id = $1 AND score < $2
        ORDER BY score ASC
        LIMIT $3
      ),
      -- unseen tagged questions per (weak skill, practiceable part)
      candidates AS (
        SELECT w.skill_id, w.score,
               p.id AS part_id, p.part_number, p.section,
               t.id AS test_id, t.title,
               COUNT(DISTINCT q.id) AS unseen
        FROM weak w
        JOIN question_skills qs ON qs.skill_id = w.skill_id
        JOIN questions q        ON q.id = qs.question_id
        JOIN parts p            ON p.id = q.part_id   AND p.status = 'published'
        JOIN tests t            ON t.id = p.test_id   AND t.status = 'published'
        WHERE NOT EXISTS (
          SELECT 1 FROM attempt_answers aa
          JOIN attempts a ON a.id = aa.attempt_id
          WHERE a.user_id = $1 AND aa.question_id = q.id
        )
        GROUP BY w.skill_id, w.score, p.id, p.part_number, p.section, t.id, t.title
      ),
      -- best part per skill: most unseen questions, then lowest part number
      ranked AS (
        SELECT c.*,
               ROW_NUMBER() OVER (
                 PARTITION BY c.skill_id
                 ORDER BY c.unseen DESC, c.part_number ASC
               ) AS rn
        FROM candidates c
      )
      SELECT r.skill_id   AS "skillId",
             s.code        AS code,
             s.name        AS name,
             s.category    AS category,
             r.score       AS score,
             r.unseen      AS unseen,
             r.test_id     AS "testId",
             r.title       AS "testTitle",
             r.part_id     AS "partId",
             r.part_number AS "partNumber",
             r.section     AS section
      FROM ranked r
      JOIN skills s ON s.id = r.skill_id
      WHERE r.rn = 1
      ORDER BY r.score ASC
      `,
      [userId, MasteryService.WEAK_THRESHOLD, limit],
    );

    return rows.map((r) => ({
      ...r,
      score: Number(r.score),
      unseen: Number(r.unseen),
      partNumber: Number(r.partNumber),
    }));
  }
}
