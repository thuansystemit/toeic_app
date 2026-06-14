import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { TestsService } from './tests.service';
import { CreateTestDto } from './dto/create-test.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Controller('tests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  // --- Learner-facing: published library ---

  @Get()
  listPublished() {
    return this.testsService.listPublished();
  }

  @Get(':id/parts')
  publishedParts(@Param('id', ParseUUIDPipe) id: string) {
    return this.testsService.getPublishedParts(id);
  }

  // --- Author-facing ---

  @Get('skills')
  @Roles('teacher', 'admin')
  listSkills() {
    return this.testsService.listSkills();
  }

  @Get('graph')
  @Roles('teacher', 'admin')
  knowledgeGraph() {
    return this.testsService.getKnowledgeGraph();
  }

  @Post()
  @Roles('teacher', 'admin')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTestDto) {
    return this.testsService.createTest(user.id, dto);
  }

  @Get(':id/question-skills')
  @Roles('teacher', 'admin')
  questionSkills(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.testsService.getTestQuestionSkills(id, user.id, user.role);
  }

  @Put(':id/parts/:partId/questions/:questionId/skills')
  @Roles('teacher', 'admin')
  setQuestionSkills(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partId', ParseUUIDPipe) partId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() body: { skillIds: string[] },
  ) {
    return this.testsService.setQuestionSkills(
      id,
      partId,
      questionId,
      user.id,
      user.role,
      body.skillIds ?? [],
    );
  }

  @Get('mine')
  @Roles('teacher', 'admin')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.testsService.listMine(user.id);
  }

  @Get(':id/authoring')
  @Roles('teacher', 'admin')
  authoringView(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.testsService.getAuthoringView(id, user.id, user.role);
  }

  @Get(':id/summary')
  @Roles('teacher', 'admin')
  summary(@Param('id', ParseUUIDPipe) id: string) {
    return this.testsService.partSummaries(id);
  }

  @Post(':id/parts/:partId/questions')
  @Roles('teacher', 'admin')
  addQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partId', ParseUUIDPipe) partId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.testsService.addQuestion(id, partId, user.id, user.role, dto);
  }

  @Patch(':id/parts/:partId/questions/:questionId')
  @Roles('teacher', 'admin')
  updateQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partId', ParseUUIDPipe) partId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.testsService.updateQuestion(
      id,
      partId,
      questionId,
      user.id,
      user.role,
      dto,
    );
  }

  @Delete(':id/parts/:partId/questions/:questionId')
  @Roles('teacher', 'admin')
  deleteQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partId', ParseUUIDPipe) partId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
  ) {
    return this.testsService.deleteQuestion(
      id,
      partId,
      questionId,
      user.id,
      user.role,
    );
  }

  @Delete(':id')
  @Roles('teacher', 'admin')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.testsService.deleteTest(id, user.id, user.role);
  }

  @Post(':id/parts/:partId/publish')
  @Roles('teacher', 'admin')
  publishPart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partId', ParseUUIDPipe) partId: string,
  ) {
    return this.testsService.publishPart(id, partId, user.id, user.role);
  }

  @Post(':id/parts/:partId/unpublish')
  @Roles('teacher', 'admin')
  unpublishPart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('partId', ParseUUIDPipe) partId: string,
  ) {
    return this.testsService.unpublishPart(id, partId, user.id, user.role);
  }

  @Post(':id/publish')
  @Roles('teacher', 'admin')
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.testsService.publish(id, user.id, user.role);
  }

  @Post(':id/unpublish')
  @Roles('teacher', 'admin')
  unpublish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.testsService.unpublish(id, user.id, user.role);
  }
}
