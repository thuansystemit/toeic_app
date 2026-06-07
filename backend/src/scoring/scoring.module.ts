import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Score } from './entities/score.entity';
import { ScoreConversion } from './entities/score-conversion.entity';
import { ScoringService } from './scoring.service';

@Module({
  imports: [TypeOrmModule.forFeature([Score, ScoreConversion])],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
