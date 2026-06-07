import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ScoreSection = 'listening' | 'reading' | 'total';

@Entity({ name: 'scores' })
export class Score {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId!: string;

  @Column({ type: 'varchar', length: 10 })
  section!: ScoreSection;

  @Column({ name: 'raw_score', type: 'int' })
  rawScore!: number;

  @Column({ name: 'scaled_score', type: 'int', nullable: true })
  scaledScore!: number | null;

  @Column({ name: 'scaled_unavailable', type: 'boolean', default: false })
  scaledUnavailable!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
