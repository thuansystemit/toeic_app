import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { AttemptsService } from './attempts.service';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { AudioPlayDto } from './dto/audio-play.dto';

@Controller('attempts')
@UseGuards(JwtAuthGuard)
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post()
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartAttemptDto) {
    return this.attemptsService.start(user.id, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.attemptsService.listMine(user.id);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attemptsService.getView(user.id, id);
  }

  @Post(':id/answers')
  saveAnswer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAnswerDto,
  ) {
    return this.attemptsService.saveAnswer(
      user.id,
      id,
      dto.questionId,
      dto.selectedChoiceId,
    );
  }

  @Post(':id/audio-plays')
  recordAudioPlay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AudioPlayDto,
  ) {
    return this.attemptsService.recordAudioPlay(user.id, id, dto.stimulusId);
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.attemptsService.submit(user.id, id);
  }
}
