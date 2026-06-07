import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExamFileStatus =
  | 'uploaded'
  | 'queued'
  | 'extracting'
  | 'extracted'
  | 'failed'
  | 'imported';

@Entity({ name: 'exam_files' })
export class ExamFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ type: 'varchar', length: 20, default: 'uploaded' })
  status!: ExamFileStatus;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy!: string;

  @Column({ name: 'test_id', type: 'uuid', nullable: true })
  testId!: string | null;

  @Column({ name: 'question_count', type: 'int', default: 0 })
  questionCount!: number;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
