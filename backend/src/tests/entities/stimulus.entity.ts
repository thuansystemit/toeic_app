import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Question } from './question.entity';

export type StimulusType = 'audio' | 'image' | 'passage';

@Entity({ name: 'stimuli' })
export class Stimulus {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'part_id', type: 'uuid' })
  partId!: string;

  @Column({ name: 'question_id', type: 'uuid', nullable: true })
  questionId!: string | null;

  @ManyToOne(() => Question, (question) => question.stimuli, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_id' })
  question!: Question | null;

  @Column({ type: 'varchar', length: 20 })
  type!: StimulusType;

  @Column({ name: 'storage_key', type: 'varchar', length: 500, nullable: true })
  storageKey!: string | null;

  @Column({ name: 'passage_text', type: 'text', nullable: true })
  passageText!: string | null;

  @Column({
    name: 'original_filename',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  originalFilename!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 50, nullable: true })
  mimeType!: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes!: string | null;

  @Column({ type: 'int', default: 0 })
  sequence!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
