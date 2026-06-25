import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { MasteryModule } from '../mastery/mastery.module';
import { VocabController } from './vocab.controller';
import { VocabService } from './vocab.service';
import { VocabGenerator } from './vocab.generator';

/**
 * English Learning Knowledge Graph (P1). Uses raw SQL over the `lex_*` tables
 * via the shared DataSource, so no `forFeature` entities are needed. Depends on
 * LlmModule (generation) and MasteryModule (mastery integration, §8).
 */
@Module({
  imports: [LlmModule, MasteryModule],
  controllers: [VocabController],
  providers: [VocabService, VocabGenerator],
  exports: [VocabService],
})
export class VocabModule {}
