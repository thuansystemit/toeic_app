import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamFile } from './entities/exam-file.entity';
import { ExtractionJob } from './entities/extraction-job.entity';
import { ExamFilesService } from './exam-files.service';
import { ExamFilesController } from './exam-files.controller';
import { InternalController } from './internal.controller';
import { FilesModule } from '../files/files.module';
import { QueueModule } from '../queue/queue.module';
import { TestsModule } from '../tests/tests.module';
import { VocabModule } from '../vocab/vocab.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExamFile, ExtractionJob]),
    FilesModule,
    QueueModule,
    TestsModule,
    VocabModule,
  ],
  providers: [ExamFilesService],
  controllers: [ExamFilesController, InternalController],
})
export class ExamFilesModule {}
