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
import { Part } from './part.entity';
import { Choice } from './choice.entity';
import { Stimulus } from './stimulus.entity';

@Entity({ name: 'questions' })
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'part_id', type: 'uuid' })
  partId!: string;

  @ManyToOne(() => Part, (part) => part.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'part_id' })
  part!: Part;

  @Column({ name: 'stimulus_id', type: 'uuid', nullable: true })
  stimulusId!: string | null;

  // A question may own several stimuli (e.g. Part 1 = image + audio).
  @OneToMany(() => Stimulus, (stimulus) => stimulus.question)
  stimuli!: Stimulus[];

  @Column({ type: 'int' })
  sequence!: number;

  @Column({ name: 'question_text', type: 'text', nullable: true })
  questionText!: string | null;

  // Vietnamese rationale shown in practice feedback + result review (GAP-001).
  @Column({ name: 'explanation_vi', type: 'varchar', length: 5000, nullable: true })
  explanationVi!: string | null;

  @OneToMany(() => Choice, (choice) => choice.question, { cascade: true })
  choices!: Choice[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
