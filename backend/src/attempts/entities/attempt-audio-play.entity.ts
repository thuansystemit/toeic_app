import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** C-003: one row per stimulus per attempt = "this audio has been played". */
@Entity({ name: 'attempt_audio_plays' })
export class AttemptAudioPlay {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId!: string;

  @Column({ name: 'stimulus_id', type: 'uuid' })
  stimulusId!: string;

  @Column({ name: 'played_at', type: 'timestamptz', default: () => 'now()' })
  playedAt!: Date;
}
