import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExtractionJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** One extracted question awaiting review (shape mirrors the Python service contract). */
export interface StagedChoice {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  isCorrect: boolean;
}
export interface StagedQuestion {
  part: number;
  /** Source question number (e.g. 101); round-tripped, not persisted separately. */
  number?: number | null;
  groupId?: string | null;
  passageText?: string | null;
  questionText: string;
  choices: StagedChoice[];
  explanationVi?: string | null;
  skills?: string[];
  confidence?: number;
  issues?: string[];
  sourcePage?: number | null;
}

@Entity({ name: 'extraction_jobs' })
export class ExtractionJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'exam_file_id', type: 'uuid' })
  examFileId!: string;

  @Column({ type: 'varchar', length: 20, default: 'ollama' })
  provider!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'queued' })
  status!: ExtractionJobStatus;

  @Column({ type: 'jsonb', nullable: true })
  warnings!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  usage!: Record<string, unknown> | null;

  @Column({ name: 'staged_questions', type: 'jsonb', nullable: true })
  stagedQuestions!: StagedQuestion[] | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
