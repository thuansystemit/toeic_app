import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Test } from './test.entity';
import { Question } from './question.entity';

export type Section = 'listening' | 'reading';

@Entity({ name: 'parts' })
export class Part {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'test_id', type: 'uuid' })
  testId!: string;

  @ManyToOne(() => Test, (test) => test.parts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id' })
  test!: Test;

  @Column({ name: 'part_number', type: 'int' })
  partNumber!: number;

  @Column({ type: 'varchar', length: 10 })
  section!: Section;

  @Column({ name: 'target_question_count', type: 'int' })
  targetQuestionCount!: number;

  @OneToMany(() => Question, (question) => question.part)
  questions!: Question[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
