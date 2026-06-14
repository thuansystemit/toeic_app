import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type SkillSection = 'reading' | 'listening';
export type SkillCategory =
  | 'grammar'
  | 'lexical'
  | 'discourse'
  | 'comprehension'
  | 'listening';

/** A node in the TOEIC skill taxonomy (docs/adr-knowledge-graph.md). */
@Entity({ name: 'skills' })
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 10 })
  section!: SkillSection;

  @Column({ type: 'varchar', length: 20 })
  category!: SkillCategory;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
