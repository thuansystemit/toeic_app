import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Test } from './entities/test.entity';
import { Part } from './entities/part.entity';
import { Stimulus } from './entities/stimulus.entity';
import { Question } from './entities/question.entity';
import { Choice } from './entities/choice.entity';
import { CreateTestDto } from './dto/create-test.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { TOEIC_PARTS } from './toeic-structure';
import { UserRole } from '../users/user.entity';

@Injectable()
export class TestsService {
  constructor(
    @InjectRepository(Test) private readonly tests: Repository<Test>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(Stimulus) private readonly stimuli: Repository<Stimulus>,
    @InjectRepository(Question)
    private readonly questions: Repository<Question>,
    private readonly dataSource: DataSource,
  ) {}

  /** Create a draft test and auto-scaffold the 7 TOEIC parts (REQ-010). */
  async createTest(userId: string, dto: CreateTestDto): Promise<Test> {
    const testId = await this.dataSource.transaction(async (manager) => {
      const test = await manager.save(
        manager.create(Test, {
          title: dto.title,
          description: dto.description ?? null,
          timeLimitMinutes: dto.timeLimitMinutes ?? 120,
          status: 'draft',
          createdBy: userId,
        }),
      );
      await manager.save(
        TOEIC_PARTS.map((p) =>
          manager.create(Part, {
            testId: test.id,
            partNumber: p.partNumber,
            section: p.section,
            targetQuestionCount: p.targetQuestionCount,
          }),
        ),
      );
      return test.id;
    });
    // Load the tree after commit so the default connection can see the rows.
    return this.loadTree(testId);
  }

  listMine(userId: string): Promise<Test[]> {
    return this.tests.find({
      where: { createdBy: userId },
      order: { createdAt: 'DESC' },
    });
  }

  listPublished(): Promise<Test[]> {
    return this.tests.find({
      where: { status: 'published' },
      order: { createdAt: 'DESC' },
    });
  }

  /** Full authoring tree; only the owner (or an admin) may view a draft. */
  async getAuthoringView(
    testId: string,
    userId: string,
    role: UserRole,
  ): Promise<Test> {
    const test = await this.tests.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.createdBy !== userId && role !== 'admin') {
      throw new ForbiddenException('Not your test');
    }
    return this.loadTree(testId);
  }

  /** Counts of questions per part — used by the authoring UI and publish guard. */
  async partSummaries(
    testId: string,
  ): Promise<{ partId: string; partNumber: number; count: number }[]> {
    const rows: { part_id: string; part_number: number; count: string }[] =
      await this.parts
        .createQueryBuilder('p')
        .leftJoin(Question, 'q', 'q.part_id = p.id')
        .select('p.id', 'part_id')
        .addSelect('p.part_number', 'part_number')
        .addSelect('COUNT(q.id)', 'count')
        .where('p.test_id = :testId', { testId })
        .groupBy('p.id')
        .addGroupBy('p.part_number')
        .orderBy('p.part_number', 'ASC')
        .getRawMany();
    return rows.map((r) => ({
      partId: r.part_id,
      partNumber: r.part_number,
      count: parseInt(r.count, 10),
    }));
  }

  /** Add a question (+ 4 choices, optional passage stimulus) to a part. */
  async addQuestion(
    testId: string,
    partId: string,
    userId: string,
    role: UserRole,
    dto: CreateQuestionDto,
  ): Promise<Question> {
    const test = await this.tests.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.createdBy !== userId && role !== 'admin') {
      throw new ForbiddenException('Not your test');
    }
    if (test.status !== 'draft') {
      // ADR-009 / D-009: published tests must be unpublished before editing.
      throw new BadRequestException(
        'Test is published; unpublish before editing',
      );
    }
    const part = await this.parts.findOne({
      where: { id: partId, testId },
    });
    if (!part) throw new NotFoundException('Part not found for this test');

    // REQ-017: exactly one correct choice, labels A-D unique.
    const correct = dto.choices.filter((c) => c.isCorrect).length;
    if (correct !== 1) {
      throw new BadRequestException('A question must have exactly one correct choice');
    }
    const labels = new Set(dto.choices.map((c) => c.label));
    if (labels.size !== 4) {
      throw new BadRequestException('Choices must use distinct labels A, B, C, D');
    }

    return this.dataSource.transaction(async (manager) => {
      const maxSeq = await manager
        .createQueryBuilder(Question, 'q')
        .select('MAX(q.sequence)', 'max')
        .where('q.part_id = :partId', { partId })
        .getRawOne<{ max: number | null }>();
      const sequence = (maxSeq?.max ?? 0) + 1;

      const question = await manager.save(
        manager.create(Question, {
          partId,
          sequence,
          questionText: dto.questionText ?? null,
          explanationVi: dto.explanationVi ?? null,
        }),
      );

      // A question may carry several stimuli (audio + image + passage).
      const stimuli: Stimulus[] = [];
      (dto.media ?? []).forEach((m, i) => {
        stimuli.push(
          manager.create(Stimulus, {
            partId,
            questionId: question.id,
            type: m.type,
            storageKey: m.storageKey,
            originalFilename: m.originalFilename ?? null,
            mimeType: m.mimeType ?? null,
            sequence: i,
          }),
        );
      });
      if (dto.passageText) {
        stimuli.push(
          manager.create(Stimulus, {
            partId,
            questionId: question.id,
            type: 'passage',
            passageText: dto.passageText,
            sequence: stimuli.length,
          }),
        );
      }
      if (stimuli.length > 0) {
        await manager.save(stimuli);
      }

      await manager.save(
        dto.choices.map((c) =>
          manager.create(Choice, {
            questionId: question.id,
            label: c.label,
            choiceText: c.choiceText,
            isCorrect: c.isCorrect,
          }),
        ),
      );
      return manager.findOneOrFail(Question, {
        where: { id: question.id },
        relations: { choices: true, stimuli: true },
      });
    });
  }

  /** Edit a question's text, explanation and choices (draft tests only). */
  async updateQuestion(
    testId: string,
    partId: string,
    questionId: string,
    userId: string,
    role: UserRole,
    dto: UpdateQuestionDto,
  ): Promise<Question> {
    const test = await this.assertEditable(testId, userId, role);
    void test;
    const question = await this.questions.findOne({
      where: { id: questionId, partId },
    });
    if (!question) throw new NotFoundException('Question not found in this part');

    const correct = dto.choices.filter((c) => c.isCorrect).length;
    if (correct !== 1) {
      throw new BadRequestException('A question must have exactly one correct choice');
    }
    if (new Set(dto.choices.map((c) => c.label)).size !== 4) {
      throw new BadRequestException('Choices must use distinct labels A, B, C, D');
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.questionText !== undefined) question.questionText = dto.questionText;
      if (dto.explanationVi !== undefined) question.explanationVi = dto.explanationVi;
      await manager.save(question);
      // Replace choices wholesale.
      await manager.delete(Choice, { questionId });
      await manager.save(
        dto.choices.map((c) =>
          manager.create(Choice, {
            questionId,
            label: c.label,
            choiceText: c.choiceText,
            isCorrect: c.isCorrect,
          }),
        ),
      );
      return manager.findOneOrFail(Question, {
        where: { id: questionId },
        relations: { choices: true, stimuli: true },
      });
    });
  }

  async deleteQuestion(
    testId: string,
    partId: string,
    questionId: string,
    userId: string,
    role: UserRole,
  ): Promise<{ deleted: boolean }> {
    await this.assertEditable(testId, userId, role);
    const question = await this.questions.findOne({
      where: { id: questionId, partId },
    });
    if (!question) throw new NotFoundException('Question not found in this part');
    // Choices and stimuli cascade via FK ON DELETE CASCADE.
    await this.questions.delete({ id: questionId });
    return { deleted: true };
  }

  /** Atomic bulk import (used by the question-extraction feature). */
  async importQuestions(
    testId: string,
    userId: string,
    role: UserRole,
    items: {
      part: number;
      questionText: string;
      passageText?: string;
      explanationVi?: string;
      choices: { label: 'A' | 'B' | 'C' | 'D'; text: string; isCorrect: boolean }[];
    }[],
  ): Promise<{ imported: number; byPart: Record<number, number> }> {
    await this.assertEditable(testId, userId, role);
    const parts = await this.parts.find({ where: { testId } });
    const partByNumber = new Map(parts.map((p) => [p.partNumber, p]));

    return this.dataSource.transaction(async (manager) => {
      const seqByPart = new Map<string, number>();
      for (const p of parts) {
        const max = await manager
          .createQueryBuilder(Question, 'q')
          .select('MAX(q.sequence)', 'max')
          .where('q.part_id = :pid', { pid: p.id })
          .getRawOne<{ max: number | null }>();
        seqByPart.set(p.id, max?.max ?? 0);
      }

      const byPart: Record<number, number> = {};
      let imported = 0;
      for (const item of items) {
        const part = partByNumber.get(item.part);
        if (!part) {
          throw new BadRequestException(`Part ${item.part} does not exist in this test`);
        }
        if (item.choices.filter((c) => c.isCorrect).length !== 1) {
          throw new BadRequestException('Each question must have exactly one correct choice');
        }
        if (new Set(item.choices.map((c) => c.label)).size !== 4) {
          throw new BadRequestException('Choices must use distinct labels A, B, C, D');
        }
        const seq = (seqByPart.get(part.id) ?? 0) + 1;
        seqByPart.set(part.id, seq);

        const question = await manager.save(
          manager.create(Question, {
            partId: part.id,
            sequence: seq,
            questionText: item.questionText,
            explanationVi: item.explanationVi ?? null,
          }),
        );
        if (item.passageText) {
          await manager.save(
            manager.create(Stimulus, {
              partId: part.id,
              questionId: question.id,
              type: 'passage',
              passageText: item.passageText,
              sequence: 0,
            }),
          );
        }
        await manager.save(
          item.choices.map((c) =>
            manager.create(Choice, {
              questionId: question.id,
              label: c.label,
              choiceText: c.text,
              isCorrect: c.isCorrect,
            }),
          ),
        );
        imported += 1;
        byPart[item.part] = (byPart[item.part] ?? 0) + 1;
      }
      return { imported, byPart };
    });
  }

  /** Load a test and assert the caller may edit it (owner/admin, draft only). */
  private async assertEditable(
    testId: string,
    userId: string,
    role: UserRole,
  ): Promise<Test> {
    const test = await this.tests.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.createdBy !== userId && role !== 'admin') {
      throw new ForbiddenException('Not your test');
    }
    if (test.status !== 'draft') {
      throw new BadRequestException(
        'Test is published; unpublish before editing',
      );
    }
    return test;
  }

  /** Publish guard (REQ-015): every part must have at least one question. */
  async publish(
    testId: string,
    userId: string,
    role: UserRole,
  ): Promise<Test> {
    const test = await this.tests.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.createdBy !== userId && role !== 'admin') {
      throw new ForbiddenException('Not your test');
    }
    const summaries = await this.partSummaries(testId);
    const empty = summaries.filter((s) => s.count === 0).map((s) => s.partNumber);
    if (empty.length > 0) {
      throw new BadRequestException(
        `Cannot publish: parts with no questions: ${empty.join(', ')}`,
      );
    }
    test.status = 'published';
    await this.tests.save(test);
    return test;
  }

  async unpublish(
    testId: string,
    userId: string,
    role: UserRole,
  ): Promise<Test> {
    const test = await this.tests.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.createdBy !== userId && role !== 'admin') {
      throw new ForbiddenException('Not your test');
    }
    test.status = 'draft';
    await this.tests.save(test);
    return test;
  }

  /** Full tree (parts -> questions -> choices) ordered for play/review. */
  async loadTree(testId: string): Promise<Test> {
    const test = await this.tests.findOne({
      where: { id: testId },
      relations: {
        parts: { questions: { choices: true, stimuli: true } },
      },
      order: {
        parts: { partNumber: 'ASC' },
      },
    });
    if (!test) throw new NotFoundException('Test not found');
    // Order nested collections deterministically.
    for (const part of test.parts) {
      part.questions.sort((a, b) => a.sequence - b.sequence);
      for (const q of part.questions) {
        q.choices.sort((a, b) => a.label.localeCompare(b.label));
        q.stimuli?.sort((a, b) => a.sequence - b.sequence);
      }
    }
    return test;
  }

  /** Part metadata for a published test — used by learners to pick a practice part. */
  async getPublishedParts(
    testId: string,
  ): Promise<
    { partId: string; partNumber: number; section: string; count: number }[]
  > {
    const test = await this.tests.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.status !== 'published') {
      throw new ForbiddenException('Test is not published');
    }
    const parts = await this.parts.find({
      where: { testId },
      order: { partNumber: 'ASC' },
    });
    const summaries = await this.partSummaries(testId);
    const countByPart = new Map(summaries.map((s) => [s.partId, s.count]));
    return parts.map((p) => ({
      partId: p.id,
      partNumber: p.partNumber,
      section: p.section,
      count: countByPart.get(p.id) ?? 0,
    }));
  }

  async getPublishedTreeOrThrow(testId: string): Promise<Test> {
    const test = await this.loadTree(testId);
    if (test.status !== 'published') {
      throw new ForbiddenException('Test is not published');
    }
    return test;
  }
}
