import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ConversionSection = 'listening' | 'reading';

@Entity({ name: 'score_conversion_table' })
export class ScoreConversion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  section!: ConversionSection;

  @Column({ name: 'raw_score', type: 'int' })
  rawScore!: number;

  @Column({ name: 'scaled_score', type: 'int' })
  scaledScore!: number;
}
