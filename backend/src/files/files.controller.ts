import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FilesService, UploadKind } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // Authoring upload — teachers/admins only.
  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('teacher', 'admin')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('kind') kind: UploadKind = 'image',
  ) {
    return this.filesService.upload(kind === 'audio' ? 'audio' : 'image', file);
  }

  // Serving is unauthenticated: keys are unguessable UUIDs and <audio>/<img>
  // tags cannot attach an Authorization header. (Local-dev equivalent of a
  // pre-signed URL — see ADR-010 for the S3 variant.)
  @Get(':key')
  async serve(
    @Param('key') key: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.filesService.read(key);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.sizeBytes);
    res.setHeader('Accept-Ranges', 'bytes');
    file.stream.pipe(res);
  }
}
