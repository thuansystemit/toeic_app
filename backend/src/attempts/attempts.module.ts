import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attempt } from './entities/attempt.entity';
import { AttemptAnswer } from './entities/attempt-answer.entity';
import { AttemptAudioPlay } from './entities/attempt-audio-play.entity';
import { AttemptsService } from './attempts.service';
import { AttemptsController } from './attempts.controller';
import { AttemptExpiryService } from './attempt-expiry.service';
import { TestsModule } from '../tests/tests.module';
import { ScoringModule } from '../scoring/scoring.module';
import { MasteryModule } from '../mastery/mastery.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attempt, AttemptAnswer, AttemptAudioPlay]),
    TestsModule,
    ScoringModule,
    MasteryModule,
  ],
  providers: [AttemptsService, AttemptExpiryService],
  controllers: [AttemptsController],
})
export class AttemptsModule {}
