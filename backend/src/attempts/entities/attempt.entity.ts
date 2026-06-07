import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AttemptMode = 'full' | 'practice';
export type AttemptStatus = 'in-progress' | 'submitted' | 'expired';

@Entity({ name: 'attempts' })
export class Attempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'test_id', type: 'uuid' })
  testId!: string;

  @Column({ name: 'part_id', type: 'uuid', nullable: true })
  partId!: string | null;

  @Column({ type: 'varchar', length: 10 })
  mode!: AttemptMode;

  @Column({ type: 'varchar', length: 15, default: 'in-progress' })
  status!: AttemptStatus;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
