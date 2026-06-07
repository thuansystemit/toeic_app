import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { User } from './users/user.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { PasswordResetToken } from './auth/password-reset-token.entity';
import { Test } from './tests/entities/test.entity';
import { Part } from './tests/entities/part.entity';
import { Stimulus } from './tests/entities/stimulus.entity';
import { Question } from './tests/entities/question.entity';
import { Choice } from './tests/entities/choice.entity';
import { Attempt } from './attempts/entities/attempt.entity';
import { AttemptAnswer } from './attempts/entities/attempt-answer.entity';
import { AttemptAudioPlay } from './attempts/entities/attempt-audio-play.entity';
import { Score } from './scoring/entities/score.entity';
import { ScoreConversion } from './scoring/entities/score-conversion.entity';
import { ExamFile } from './exam-files/entities/exam-file.entity';
import { ExtractionJob } from './exam-files/entities/extraction-job.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TestsModule } from './tests/tests.module';
import { AttemptsModule } from './attempts/attempts.module';
import { FilesModule } from './files/files.module';
import { AdminModule } from './admin/admin.module';
import { ProfileModule } from './profile/profile.module';
import { ExamFilesModule } from './exam-files/exam-files.module';
import { HealthController } from './health.controller';

const ENTITIES = [
  User,
  RefreshToken,
  PasswordResetToken,
  Test,
  Part,
  Stimulus,
  Question,
  Choice,
  Attempt,
  AttemptAnswer,
  AttemptAudioPlay,
  Score,
  ScoreConversion,
  ExamFile,
  ExtractionJob,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        username: config.get<string>('db.user'),
        password: config.get<string>('db.password'),
        database: config.get<string>('db.name'),
        entities: ENTITIES,
        synchronize: false,
        // Migrations are the source of truth; never auto-sync schema.
        poolSize: 10,
      }),
    }),
    UsersModule,
    AuthModule,
    TestsModule,
    AttemptsModule,
    FilesModule,
    AdminModule,
    ProfileModule,
    ExamFilesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
