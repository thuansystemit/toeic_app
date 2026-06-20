import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Part } from './part.entity';

export type TestStatus = 'draft' | 'published';

@Entity({ name: 'tests' })
export class Test {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: TestStatus;

  @Column({ name: 'time_limit_minutes', type: 'int', default: 120 })
  timeLimitMinutes!: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  // The single published test guests may preview without an account.
  @Column({ name: 'is_sample', type: 'boolean', default: false })
  isSample!: boolean;

  @OneToMany(() => Part, (part) => part.test)
  parts!: Part[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
