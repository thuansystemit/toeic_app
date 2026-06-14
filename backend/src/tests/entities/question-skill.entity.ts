import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type TagSource = 'llm' | 'human';

/** Keystone edge: a question tests a skill ((:Question)-[:TESTS]->(:Skill)). */
@Entity({ name: 'question_skills' })
export class QuestionSkill {
  @PrimaryColumn({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @PrimaryColumn({ name: 'skill_id', type: 'uuid' })
  skillId!: string;

  @Column({ type: 'varchar', length: 10, default: 'human' })
  source!: TagSource;

  @Column({ type: 'real', nullable: true })
  confidence!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
