import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { InternalTokenGuard } from './internal-token.guard';
import { ExamFilesService } from './exam-files.service';
import { FilesService } from '../files/files.service';
import { ExtractionCallbackDto } from './dto/extraction-callback.dto';

/** Endpoints used only by the Python extraction worker (shared-token auth). */
@Controller('internal')
@UseGuards(InternalTokenGuard)
export class InternalController {
  constructor(
    private readonly examFilesService: ExamFilesService,
    private readonly filesService: FilesService,
  ) {}

  // Worker downloads the uploaded source document.
  @Get('files/:key')
  async download(
    @Param('key') key: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.filesService.read(key);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.sizeBytes);
    file.stream.pipe(res);
  }

  @Post('extraction/:jobId/started')
  @HttpCode(HttpStatus.NO_CONTENT)
  started(@Param('jobId') jobId: string): Promise<void> {
    return this.examFilesService.markExtracting(jobId);
  }

  @Post('extraction/:jobId/callback')
  @HttpCode(HttpStatus.NO_CONTENT)
  callback(
    @Param('jobId') jobId: string,
    @Body() dto: ExtractionCallbackDto,
  ): Promise<void> {
    return this.examFilesService.handleCallback(jobId, dto);
  }
}
