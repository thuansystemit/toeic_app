import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Test } from './entities/test.entity';
import { Part } from './entities/part.entity';
import { Stimulus } from './entities/stimulus.entity';
import { Question } from './entities/question.entity';
import { Choice } from './entities/choice.entity';
import { Skill } from './entities/skill.entity';
import { QuestionSkill } from './entities/question-skill.entity';
import { CreateTestDto } from './dto/create-test.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { PART6_PASSAGE_TEMPLATE, TOEIC_PARTS } from './toeic-structure';
import { UserRole } from '../users/user.entity';

@Injectable()
export class TestsService {
  constructor(
    @InjectRepository(Test) private readonly tests: Repository<Test>,
    @InjectRepository(Part) private readonly parts: Repository<Part>,
    @InjectRepository(Stimulus) private readonly stimuli: Repository<Stimulus>,
    @InjectRepository(Question)
    private readonly questions: Repository<Question>,
    @InjectRepository(Skill) private readonly skills: Repository<Skill>,
    @InjectRepository(QuestionSkill)
    private readonly questionSkills: Repository<QuestionSkill>,
    private readonly dataSource: DataSource,
  ) {}

  /** The full TOEIC skill taxonomy for the tagging picker. */
  listSkills(): Promise<Skill[]> {
    return this.skills.find({ order: { category: 'ASC', code: 'ASC' } });
  }

  /**
   * Knowledge-graph view (docs/adr-knowledge-graph.md): skills + tagged
   * questions as nodes, (:Question)-[:TESTS]->(:Skill) as links. Sourced from
   * Postgres (Phase 1) — the same shape a Neo4j projection would later serve.
   */
  async getKnowledgeGraph(): Promise<{
    nodes: {
      id: string;
      kind: 'skill' | 'question';
      label: string;
      category?: string;
      part?: number;
    }[];
    links: { source: string; target: string }[];
  }> {
    const skills = await this.skills.find({ order: { code: 'ASC' } });
    const rows: {
      question_id: string;
      skill_id: string;
      question_text: string | null;
      part_number: number;
    }[] = await this.questionSkills
      .createQueryBuilder('qs')
      .innerJoin(Question, 'q', 'q.id = qs.question_id')
      .innerJoin(Part, 'p', 'p.id = q.part_id')
      .select('qs.question_id', 'question_id')
      .addSelect('qs.skill_id', 'skill_id')
      .addSelect('q.question_text', 'question_text')
      .addSelect('p.part_number', 'part_number')
      .getRawMany();

    const nodes: {
      id: string;
      kind: 'skill' | 'question';
      label: string;
      category?: string;
      part?: number;
    }[] = skills.map((s) => ({
      id: `s:${s.id}`,
      kind: 'skill',
      label: s.code,
      category: s.category,
    }));

    const seen = new Set<string>();
    const links: { source: string; target: string }[] = [];
    for (const r of rows) {
      if (!seen.has(r.question_id)) {
        seen.add(r.question_id);
        nodes.push({
          id: `q:${r.question_id}`,
          kind: 'question',
          label: (r.question_text ?? 'Q').slice(0, 40) || 'Q',
          part: r.part_number,
        });
      }
      links.push({ source: `q:${r.question_id}`, target: `s:${r.skill_id}` });
    }
    return { nodes, links };
  }

  /** All Question->Skill tags for a test, keyed by question id (for the editor). */
  async getTestQuestionSkills(
    testId: string,
    userId: string,
    role: UserRole,
  ): Promise<Record<string, { skillId: string; code: string; name: string }[]>> {
    await this.assertOwner(testId, userId, role);
    const rows: {
      question_id: string;
      skill_id: string;
      code: string;
      name: string;
    }[] = await this.questionSkills
      .createQueryBuilder('qs')
      .innerJoin(Question, 'q', 'q.id = qs.question_id')
      .innerJoin(Part, 'p', 'p.id = q.part_id')
      .innerJoin(Skill, 's', 's.id = qs.skill_id')
      .select('qs.question_id', 'question_id')
      .addSelect('qs.skill_id', 'skill_id')
      .addSelect('s.code', 'code')
      .addSelect('s.name', 'name')
      .where('p.test_id = :testId', { testId })
      .orderBy('s.code', 'ASC')
      .getRawMany();

    const map: Record<string, { skillId: string; code: string; name: string }[]> = {};
    for (const r of rows) {
      (map[r.question_id] ??= []).push({
        skillId: r.skill_id,
        code: r.code,
        name: r.name,
      });
    }
    return map;
  }

  /** Replace the skill tags on a question (teacher tagging; source='human'). */
  async setQuestionSkills(
    testId: string,
    partId: string,
    questionId: string,
    userId: string,
    role: UserRole,
    skillIds: string[],
  ): Promise<{ skillIds: string[] }> {
    await this.loadOwnedPart(testId, partId, userId, role);
    const question = await this.questions.findOne({
      where: { id: questionId, partId },
    });
    if (!question) throw new NotFoundException('Question not found in this part');

    const unique = [...new Set(skillIds)];
    if (unique.length > 0) {
      const found = await this.skills.count({ where: { id: In(unique) } });
      if (found !== unique.length) {
        throw new BadRequestException('One or more skills do not exist');
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(QuestionSkill, { questionId });
      if (unique.length > 0) {
        await manager.save(
          unique.map((skillId) =>
            manager.create(QuestionSkill, {
              questionId,
              skillId,
              source: 'human',
            }),
          ),
        );
      }
    });
    return { skillIds: unique };
  }

  /**
   * Create a draft test, scaffold the 7 TOEIC parts (REQ-010), and pre-create
   * the standard question slots for every part. Each slot is a placeholder
   * (canonical TOEIC number 1-200, 4 blank choices A-D, NO correct answer yet)
   * so the teacher fills content instead of starting empty; the per-part publish
   * guard then forces a real answer on each before the part can go live.
   */
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
      const parts = await manager.save(
        TOEIC_PARTS.map((p) =>
          manager.create(Part, {
            testId: test.id,
            partNumber: p.partNumber,
            section: p.section,
            targetQuestionCount: p.targetQuestionCount,
          }),
        ),
      );

      // Standard question slots: continuous TOEIC numbering across parts 1-7.
      const orderedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);
      const questions: Question[] = [];
      let toeicNo = 1;
      for (const part of orderedParts) {
        for (let seq = 1; seq <= part.targetQuestionCount; seq++) {
          questions.push(
            manager.create(Question, {
              partId: part.id,
              sequence: seq,
              questionText: `Question ${toeicNo}`,
              explanationVi: null,
            }),
          );
          toeicNo += 1;
        }
      }
      const savedQuestions = await manager.save(questions, { chunk: 200 });

      // Part 6 is text completion: seed each question slot with the standard
      // passage template so authors start from a layout, not a blank box.
      const part6 = orderedParts.find((p) => p.partNumber === 6);
      if (part6) {
        const passages = savedQuestions
          .filter((q) => q.partId === part6.id)
          .map((q, i) =>
            manager.create(Stimulus, {
              partId: part6.id,
              questionId: q.id,
              type: 'passage' as const,
              passageText: PART6_PASSAGE_TEMPLATE,
              sequence: i,
            }),
          );
        if (passages.length > 0) await manager.save(passages, { chunk: 200 });
      }

      const choices: Choice[] = [];
      for (const q of savedQuestions) {
        for (const label of ['A', 'B', 'C', 'D'] as const) {
          choices.push(
            manager.create(Choice, {
              questionId: q.id,
              label,
              choiceText: `Choice ${label}`,
              isCorrect: false,
            }),
          );
        }
      }
      await manager.save(choices, { chunk: 400 });

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

  // --- Public (guest) surface: no auth, no question content ---

  /** Published tests as locked teasers for guests: metadata + counts only. */
  async listPublishedPublic(): Promise<
    {
      id: string;
      title: string;
      description: string | null;
      timeLimitMinutes: number;
      isSample: boolean;
      partCount: number;
      questionCount: number;
    }[]
  > {
    const tests = await this.tests.find({
      where: { status: 'published' },
      order: { isSample: 'DESC', createdAt: 'DESC' },
    });
    const cards = [];
    for (const t of tests) {
      const summaries = await this.partSummaries(t.id);
      cards.push({
        id: t.id,
        title: t.title,
        description: t.description,
        timeLimitMinutes: t.timeLimitMinutes,
        isSample: t.isSample,
        partCount: summaries.filter((s) => s.count > 0).length,
        questionCount: summaries.reduce((a, s) => a + s.count, 0),
      });
    }
    return cards;
  }

  /** The full sample test for a guest preview (answers + explanations shown).
   * Falls back to the most recently published test if none is flagged. */
  async getSamplePublic(): Promise<Test | null> {
    let test = await this.tests.findOne({
      where: { status: 'published', isSample: true },
    });
    if (!test) {
      test = await this.tests.findOne({
        where: { status: 'published' },
        order: { createdAt: 'DESC' },
      });
    }
    return test ? this.loadTree(test.id) : null;
  }

  /** Mark a published test as the single public sample (owner or admin). */
  async setSample(
    testId: string,
    userId: string,
    role: UserRole,
  ): Promise<{ isSample: boolean }> {
    const test = await this.tests.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.createdBy !== userId && role !== 'admin') {
      throw new ForbiddenException('Not your test');
    }
    if (test.status !== 'published') {
      throw new BadRequestException('Only a published test can be the sample');
    }
    await this.dataSource.transaction(async (m) => {
      await m.update(Test, { isSample: true }, { isSample: false });
      await m.update(Test, { id: testId }, { isSample: true });
    });
    return { isSample: true };
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
    // ADR-009 / D-009: a published part must be unpublished before editing.
    await this.assertPartEditable(testId, partId, userId, role);

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
    await this.assertPartEditable(testId, partId, userId, role);
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
      // Shared reading passage (Part 6/7). Replace the existing passage stimulus
      // so edits to the passage are persisted.
      if (dto.passageText !== undefined) {
        await manager.delete(Stimulus, { questionId, type: 'passage' });
        if (dto.passageText) {
          await manager.save(
            manager.create(Stimulus, {
              partId,
              questionId,
              type: 'passage',
              passageText: dto.passageText,
              sequence: 0,
            }),
          );
        }
      }
      // Audio/image stimuli (Part 1 photo+audio, Part 2 audio, …). Replace any
      // existing stimulus of the same type so re-uploading swaps the media.
      for (const m of dto.media ?? []) {
        await manager.delete(Stimulus, { questionId, type: m.type });
        await manager.save(
          manager.create(Stimulus, {
            partId,
            questionId,
            type: m.type,
            storageKey: m.storageKey,
            originalFilename: m.originalFilename ?? null,
            mimeType: m.mimeType ?? null,
            sequence: 0,
          }),
        );
      }
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
    await this.assertPartEditable(testId, partId, userId, role);
    const question = await this.questions.findOne({
      where: { id: questionId, partId },
    });
    if (!question) throw new NotFoundException('Question not found in this part');
    // Choices and stimuli cascade via FK ON DELETE CASCADE.
    await this.questions.delete({ id: questionId });
    return { deleted: true };
  }

  /**
   * Delete a whole test from the owner's library (REQ: manage test library).
   * Force delete: attempts (and their answers, audio plays and scores via their
   * own ON DELETE CASCADE) are removed first, then the test — whose parts,
   * questions, choices and stimuli cascade. exam_files.test_id is nulled by its
   * own FK. The attempts must be cleared explicitly because attempts.test_id has
   * no cascade rule.
   */
  async deleteTest(
    testId: string,
    userId: string,
    role: UserRole,
  ): Promise<{ deleted: boolean }> {
    const test = await this.tests.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.createdBy !== userId && role !== 'admin') {
      throw new ForbiddenException('Not your test');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.query(`DELETE FROM attempts WHERE test_id = $1`, [testId]);
      await manager.delete(Test, { id: testId });
    });
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
      skills?: string[];
    }[],
  ): Promise<{ imported: number; byPart: Record<number, number> }> {
    await this.assertOwner(testId, userId, role);
    const parts = await this.parts.find({ where: { testId } });
    const partByNumber = new Map(parts.map((p) => [p.partNumber, p]));
    // Map skill CODE -> id once, to persist the LLM's tags as Question->Skill edges.
    const skillByCode = new Map(
      (await this.skills.find()).map((s) => [s.code, s.id]),
    );

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
        if (part.status !== 'draft') {
          throw new BadRequestException(
            `Part ${item.part} is published; unpublish it before importing`,
          );
        }
        // Imported source documents often have no answer key, so 0 correct
        // choices is allowed here — the teacher sets answers in the editor and
        // the publish guard enforces exactly one before the part goes live.
        // More than one correct, however, is always a data error.
        if (item.choices.filter((c) => c.isCorrect).length > 1) {
          throw new BadRequestException('A question cannot have more than one correct choice');
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
        // Persist the LLM's skill tags (knowledge-graph edges); ignore any
        // codes the model invented that aren't in the taxonomy.
        const skillIds = [
          ...new Set(
            (item.skills ?? [])
              .map((code) => skillByCode.get(code))
              .filter((id): id is string => !!id),
          ),
        ];
        if (skillIds.length > 0) {
          await manager.save(
            skillIds.map((skillId) =>
              manager.create(QuestionSkill, {
                questionId: question.id,
                skillId,
                source: 'llm',
              }),
            ),
          );
        }
        imported += 1;
        byPart[item.part] = (byPart[item.part] ?? 0) + 1;
      }
      return { imported, byPart };
    });
  }

  /** Load a test and assert the caller owns it (owner/admin), ignoring status. */
  private async assertOwner(
    testId: string,
    userId: string,
    role: UserRole,
  ): Promise<Test> {
    const test = await this.tests.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.createdBy !== userId && role !== 'admin') {
      throw new ForbiddenException('Not your test');
    }
    return test;
  }

  /** Load a part of an owned test (owner/admin), ignoring status. */
  private async loadOwnedPart(
    testId: string,
    partId: string,
    userId: string,
    role: UserRole,
  ): Promise<Part> {
    await this.assertOwner(testId, userId, role);
    const part = await this.parts.findOne({ where: { id: partId, testId } });
    if (!part) throw new NotFoundException('Part not found for this test');
    return part;
  }

  /**
   * Assert the caller may edit a part's questions. Editing is locked per part:
   * a published part must be unpublished first (the test's own status no longer
   * gates editing now that parts publish independently).
   */
  private async assertPartEditable(
    testId: string,
    partId: string,
    userId: string,
    role: UserRole,
  ): Promise<Part> {
    const part = await this.loadOwnedPart(testId, partId, userId, role);
    if (part.status !== 'draft') {
      throw new BadRequestException(
        'Part is published; unpublish it before editing',
      );
    }
    return part;
  }

  /**
   * Publish a single part (REQ-015 per part): it must have ≥1 question and
   * every question must have exactly one correct answer. The latter lets import
   * accept answer-less questions while still guaranteeing a published part is
   * fully scoreable — the teacher fills any missing answers before publishing.
   */
  async publishPart(
    testId: string,
    partId: string,
    userId: string,
    role: UserRole,
  ): Promise<Part> {
    const part = await this.loadOwnedPart(testId, partId, userId, role);
    const questions = await this.questions.find({
      where: { partId },
      relations: { choices: true },
    });
    if (questions.length === 0) {
      throw new BadRequestException('Cannot publish a part with no questions');
    }
    const unanswered = questions.filter(
      (q) => q.choices.filter((c) => c.isCorrect).length !== 1,
    ).length;
    if (unanswered > 0) {
      throw new BadRequestException(
        `Set exactly one correct answer for every question first (${unanswered} still missing)`,
      );
    }
    part.status = 'published';
    await this.parts.save(part);
    return part;
  }

  async unpublishPart(
    testId: string,
    partId: string,
    userId: string,
    role: UserRole,
  ): Promise<Part> {
    const part = await this.loadOwnedPart(testId, partId, userId, role);
    part.status = 'draft';
    await this.parts.save(part);
    return part;
  }

  /**
   * Publish guard (per-part model): a test goes live once at least one of its
   * parts is published, so every library entry has something practiceable.
   */
  async publish(
    testId: string,
    userId: string,
    role: UserRole,
  ): Promise<Test> {
    const test = await this.assertOwner(testId, userId, role);
    const publishedParts = await this.parts.count({
      where: { testId, status: 'published' },
    });
    if (publishedParts === 0) {
      throw new BadRequestException(
        'Cannot publish: publish at least one part first',
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
    // Only published parts are practiceable (test must be published too, above).
    const parts = await this.parts.find({
      where: { testId, status: 'published' },
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
