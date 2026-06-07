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

export type ChoiceLabel = 'A' | 'B' | 'C' | 'D';

@Entity({ name: 'choices' })
export class Choice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @ManyToOne(() => Question, (question) => question.choices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_id' })
  question!: Question;

  @Column({ type: 'char', length: 1 })
  label!: ChoiceLabel;

  @Column({ name: 'choice_text', type: 'text' })
  choiceText!: string;

  @Column({ name: 'is_correct', type: 'boolean', default: false })
  isCorrect!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
