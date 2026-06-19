import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { ExamFilesService } from './exam-files.service';
import { ImportQuestionsDto } from './dto/import-questions.dto';

@Controller('exam-files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('teacher', 'admin')
export class ExamFilesController {
  constructor(private readonly examFilesService: ExamFilesService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 21 * 1024 * 1024 } }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('part') part: string,
  ) {
    return this.examFilesService.upload(user.id, file, Number(part));
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.examFilesService.list(user.id, user.role);
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const file = await this.examFilesService.getOwned(id, user.id, user.role);
    const job = await this.examFilesService.latestJob(id);
    return {
      file,
      job: job
        ? { status: job.status, warnings: job.warnings, error: job.error }
        : null,
    };
  }

  @Get(':id/review')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examFilesService.review(id, user.id, user.role);
  }

  @Post(':id/import')
  import(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImportQuestionsDto,
  ) {
    return this.examFilesService.import(id, user.id, user.role, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.examFilesService.remove(id, user.id, user.role);
  }
}
