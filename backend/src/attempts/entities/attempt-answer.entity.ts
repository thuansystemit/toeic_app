import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'attempt_answers' })
export class AttemptAnswer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId!: string;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @Column({ name: 'selected_choice_id', type: 'uuid', nullable: true })
  selectedChoiceId!: string | null;

  @Column({ name: 'is_correct', type: 'boolean', nullable: true })
  isCorrect!: boolean | null;

  @Column({ name: 'answered_at', type: 'timestamptz', nullable: true })
  answeredAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
