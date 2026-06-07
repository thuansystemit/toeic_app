import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Test } from './entities/test.entity';
import { Part } from './entities/part.entity';
import { Stimulus } from './entities/stimulus.entity';
import { Question } from './entities/question.entity';
import { Choice } from './entities/choice.entity';
import { TestsService } from './tests.service';
import { TestsController } from './tests.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Test, Part, Stimulus, Question, Choice]),
  ],
  providers: [TestsService],
  controllers: [TestsController],
  exports: [TestsService],
})
export class TestsModule {}
