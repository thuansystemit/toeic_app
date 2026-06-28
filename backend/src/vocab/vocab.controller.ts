import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { AttemptDto } from './dto/attempt.dto';
import {
  AttemptResult,
  VocabService,
  VocabWordSummary,
} from './vocab.service';
import { VocabResponse } from './vocab.types';

/** English Learning Knowledge Graph — learner-facing word lookup + practice. */
@Controller('vocab')
@UseGuards(JwtAuthGuard)
export class VocabController {
  constructor(private readonly vocab: VocabService) {}

  /** All words currently in the graph (for the browse-all index). */
  @Get()
  listWords(): Promise<VocabWordSummary[]> {
    return this.vocab.listWords();
  }

  /** A word's example sentences only (lightweight; for the word page). */
  @Get(':word/sentences')
  sentences(
    @Param('word') word: string,
  ): Promise<{ word: string; sentences: string[] }> {
    return this.vocab.getSentences(word);
  }

  /** Look up a word → meaning / pattern / sentence / exercise (generate-cache). */
  @Get(':word')
  lookup(@Param('word') word: string): Promise<VocabResponse> {
    const trimmed = (word ?? '').trim();
    if (!/^[A-Za-z][A-Za-z'-]{0,79}$/.test(trimmed)) {
      throw new BadRequestException('Provide a single English word');
    }
    return this.vocab.lookup(trimmed);
  }

  /** Answer a cloze exercise; the server grades it and updates skill mastery. */
  @Post('exercises/:id/attempt')
  attempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AttemptDto,
  ): Promise<AttemptResult> {
    return this.vocab.attempt(user.id, id, dto.answer);
  }
}
