import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Derived (:Learner)-[:MASTERY]->(:Skill) — a learner's mastery of one skill,
 * recomputed from their attempts. Source of truth is Postgres (ADR Phase 1).
 */
@Entity({ name: 'learner_skill_mastery' })
export class LearnerSkillMastery {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'skill_id', type: 'uuid' })
  skillId!: string;

  /** Recency-weighted rolling accuracy, 0..1. */
  @Column({ type: 'real', default: 0 })
  score!: number;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'int', default: 0 })
  correct!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
