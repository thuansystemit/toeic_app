import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TtsService } from './tts.service';

/** Sentence audio (Azure Neural TTS). Cached MP3 per sentence+accent. */
@Controller('tts')
@UseGuards(JwtAuthGuard)
export class TtsController {
  constructor(private readonly tts: TtsService) {}

  @Get()
  async speak(
    @Query('text') text: string,
    @Query('accent') accent = 'us',
    @Res() res: Response,
  ): Promise<void> {
    const clean = (text ?? '').trim();
    if (!clean || clean.length > 400) {
      throw new BadRequestException('Provide text (1–400 chars)');
    }
    const audio = await this.tts.synthesize(clean, accent);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(audio);
  }
}
