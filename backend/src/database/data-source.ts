import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { PasswordResetToken } from '../auth/password-reset-token.entity';
import { Test } from '../tests/entities/test.entity';
import { Part } from '../tests/entities/part.entity';
import { Stimulus } from '../tests/entities/stimulus.entity';
import { Question } from '../tests/entities/question.entity';
import { Choice } from '../tests/entities/choice.entity';
import { Skill } from '../tests/entities/skill.entity';
import { QuestionSkill } from '../tests/entities/question-skill.entity';
import { Attempt } from '../attempts/entities/attempt.entity';
import { AttemptAnswer } from '../attempts/entities/attempt-answer.entity';
import { AttemptAudioPlay } from '../attempts/entities/attempt-audio-play.entity';
import { Score } from '../scoring/entities/score.entity';
import { ScoreConversion } from '../scoring/entities/score-conversion.entity';
import { ExamFile } from '../exam-files/entities/exam-file.entity';
import { ExtractionJob } from '../exam-files/entities/extraction-job.entity';
import { InitAuth1700000000000 } from './migrations/1700000000000-InitAuth';
import { TestAttemptScoring1700000001000 } from './migrations/1700000001000-TestAttemptScoring';
import { QuestionStimuli1700000002000 } from './migrations/1700000002000-QuestionStimuli';
import { SocialAuth1700000003000 } from './migrations/1700000003000-SocialAuth';
import { ExamFiles1700000004000 } from './migrations/1700000004000-ExamFiles';
import { PartStatus1700000005000 } from './migrations/1700000005000-PartStatus';
import { Skills1700000006000 } from './migrations/1700000006000-Skills';

// Load backend/.env when running the TypeORM CLI outside of Nest's runtime.
loadEnv();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'toeic',
  password: process.env.DB_PASSWORD ?? 'toeic',
  database: process.env.DB_NAME ?? 'toeic',
  entities: [
    User,
    RefreshToken,
    PasswordResetToken,
    Test,
    Part,
    Stimulus,
    Question,
    Choice,
    Skill,
    QuestionSkill,
    Attempt,
    AttemptAnswer,
    AttemptAudioPlay,
    Score,
    ScoreConversion,
    ExamFile,
    ExtractionJob,
  ],
  migrations: [
    InitAuth1700000000000,
    TestAttemptScoring1700000001000,
    QuestionStimuli1700000002000,
    SocialAuth1700000003000,
    ExamFiles1700000004000,
    PartStatus1700000005000,
    Skills1700000006000,
  ],
  synchronize: false,
  logging: false,
});
