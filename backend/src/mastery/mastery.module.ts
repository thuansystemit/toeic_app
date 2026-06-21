import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearnerSkillMastery } from './entities/learner-skill-mastery.entity';
import { MasteryService } from './mastery.service';
import { MasteryController } from './mastery.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LearnerSkillMastery])],
  providers: [MasteryService],
  controllers: [MasteryController],
  exports: [MasteryService],
})
export class MasteryModule {}
