import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test } from './entities/test.entity';
import { Part } from './entities/part.entity';
import { Stimulus } from './entities/stimulus.entity';
import { Question } from './entities/question.entity';
import { Choice } from './entities/choice.entity';
import { Skill } from './entities/skill.entity';
import { QuestionSkill } from './entities/question-skill.entity';
import { TestsService } from './tests.service';
import { TestsController } from './tests.controller';
import { PublicTestsController } from './public-tests.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Test,
      Part,
      Stimulus,
      Question,
      Choice,
      Skill,
      QuestionSkill,
    ]),
  ],
  providers: [TestsService],
  controllers: [TestsController, PublicTestsController],
  exports: [TestsService],
})
export class TestsModule {}
