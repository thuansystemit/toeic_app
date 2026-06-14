import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Attempt, AttemptStatus } from './entities/attempt.entity';
import { AttemptAnswer } from './entities/attempt-answer.entity';
import { AttemptAudioPlay } from './entities/attempt-audio-play.entity';
import { StartAttemptDto } from './dto/start-attempt.dto';
import { TestsService } from '../tests/tests.service';
import { Test } from '../tests/entities/test.entity';
import { Part } from '../tests/entities/part.entity';
import { ScoringService, SectionRaw } from '../scoring/scoring.service';

export interface AttemptView {
  id: string;
  testId: string;
  testTitle: string;
  mode: string;
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string | null;
  timeRemainingSeconds: number | null;
  parts: PartView[];
  scores?: {
    section: string;
    rawScore: number;
    scaledScore: number | null;
    scaledUnavailable: boolean;
  }[];
}

interface PartView {
  partId: string;
  partNumber: number;
  section: string;
  questions: QuestionView[];
}

interface StimulusView {
  id: string;
  type: string;
  storageKey: string | null;
  passageText: string | null;
  // Whether this audio has already been played in this attempt (C-003).
  played: boolean;
}

interface QuestionView {
  id: string;
  sequence: number;
  questionText: string | null;
  stimuli: StimulusView[];
  choices: { id: string; label: string; choiceText: string; isCorrect?: boolean }[];
  selectedChoiceId: string | null;
  // Review-only fields (populated once the attempt is terminal):
  isCorrect?: boolean | null;
  explanationVi?: string | null;
}

@Injectable()
export class AttemptsService {
  constructor(
    @InjectRepository(Attempt) private readonly attempts: Repository<Attempt>,
    @InjectRepository(AttemptAnswer)
    private readonly answers: Repository<AttemptAnswer>,
    @InjectRepository(AttemptAudioPlay)
    private readonly audioPlays: Repository<AttemptAudioPlay>,
    private readonly testsService: TestsService,
    private readonly scoringService: ScoringService,
  ) {}

  async start(userId: string, dto: StartAttemptDto): Promise<AttemptView> {
    const test = await this.testsService.getPublishedTreeOrThrow(dto.testId);

    if (dto.mode === 'practice' && !dto.partId) {
      throw new BadRequestException('partId is required for practice mode');
    }
    if (dto.mode === 'practice' && dto.partId) {
      const part = test.parts.find((p) => p.id === dto.partId);
      if (!part) throw new BadRequestException('partId does not belong to this test');
      if (part.status !== 'published') {
        throw new ForbiddenException('This part is not published');
      }
    }

    const expiresAt =
      dto.mode === 'full'
        ? new Date(Date.now() + test.timeLimitMinutes * 60 * 1000)
        : null;

    try {
      const attempt = await this.attempts.save(
        this.attempts.create({
          userId,
          testId: dto.testId,
          partId: dto.mode === 'practice' ? dto.partId! : null,
          mode: dto.mode,
          status: 'in-progress',
          startedAt: new Date(),
          expiresAt,
        }),
      );
      return this.buildView(attempt, test);
    } catch (err) {
      // REQ-037: unique partial index blocks a second in-progress full attempt.
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException(
          'You already have an in-progress attempt for this test',
        );
      }
      throw err;
    }
  }

  async getView(userId: string, attemptId: string): Promise<AttemptView> {
    const attempt = await this.ownedAttempt(userId, attemptId);
    await this.expireIfDue(attempt);
    const test = await this.testsService.loadTree(attempt.testId);
    return this.buildView(attempt, test);
  }

  async saveAnswer(
    userId: string,
    attemptId: string,
    questionId: string,
    selectedChoiceId: string,
  ): Promise<{
    saved: boolean;
    feedback?: {
      isCorrect: boolean;
      correctChoiceId: string | null;
      explanationVi: string | null;
    };
  }> {
    const attempt = await this.ownedAttempt(userId, attemptId);
    if (await this.expireIfDue(attempt)) {
      throw new BadRequestException('Attempt has expired');
    }
    if (attempt.status !== 'in-progress') {
      throw new BadRequestException('Attempt is not in progress');
    }

    const test = await this.testsService.loadTree(attempt.testId);
    const { question, choice } = this.locateChoice(
      test,
      attempt,
      questionId,
      selectedChoiceId,
    );

    const existing = await this.answers.findOne({
      where: { attemptId, questionId },
    });
    // Answers are freely changeable until the attempt is submitted (both modes).
    const isCorrect = choice.isCorrect;
    if (existing) {
      existing.selectedChoiceId = choice.id;
      existing.isCorrect = isCorrect;
      existing.answeredAt = new Date();
      await this.answers.save(existing);
    } else {
      await this.answers.save(
        this.answers.create({
          attemptId,
          questionId: question.id,
          selectedChoiceId: choice.id,
          isCorrect,
          answeredAt: new Date(),
        }),
      );
    }

    // US-004: practice mode gives instant per-question feedback.
    if (attempt.mode === 'practice') {
      const correctChoice = question.choices.find((c) => c.isCorrect);
      return {
        saved: true,
        feedback: {
          isCorrect,
          correctChoiceId: correctChoice?.id ?? null,
          explanationVi: question.explanationVi ?? null,
        },
      };
    }
    return { saved: true };
  }

  /** Strict full-test mode: record first play; reject replays (C-003). */
  async recordAudioPlay(
    userId: string,
    attemptId: string,
    stimulusId: string,
  ): Promise<{ firstPlay: boolean }> {
    const attempt = await this.ownedAttempt(userId, attemptId);
    if (attempt.mode !== 'full') {
      // Practice mode allows unlimited replay; nothing to track.
      return { firstPlay: true };
    }
    if (await this.expireIfDue(attempt)) {
      throw new BadRequestException('Attempt has expired');
    }
    const existing = await this.audioPlays.findOne({
      where: { attemptId, stimulusId },
    });
    if (existing) {
      throw new ConflictException('Audio already played in this exam');
    }
    await this.audioPlays.save(
      this.audioPlays.create({ attemptId, stimulusId }),
    );
    return { firstPlay: true };
  }

  async submit(userId: string, attemptId: string): Promise<AttemptView> {
    const attempt = await this.ownedAttempt(userId, attemptId);
    if (attempt.status !== 'in-progress') {
      // Idempotent: return the already-finalized view.
      const test = await this.testsService.loadTree(attempt.testId);
      return this.buildView(attempt, test);
    }
    if (await this.expireIfDue(attempt)) {
      const test = await this.testsService.loadTree(attempt.testId);
      return this.buildView(attempt, test);
    }
    await this.finalize(attempt, 'submitted');
    const test = await this.testsService.loadTree(attempt.testId);
    return this.buildView(attempt, test);
  }

  async listMine(userId: string): Promise<
    {
      id: string;
      testId: string;
      mode: string;
      status: AttemptStatus;
      startedAt: string;
      submittedAt: string | null;
      total: { rawScore: number; scaledScore: number | null } | null;
    }[]
  > {
    const list = await this.attempts.find({
      where: { userId },
      order: { startedAt: 'DESC' },
    });
    const result = [];
    for (const a of list) {
      const scores =
        a.status === 'in-progress'
          ? []
          : await this.scoringService.getByAttempt(a.id);
      const total = scores.find((s) => s.section === 'total');
      result.push({
        id: a.id,
        testId: a.testId,
        mode: a.mode,
        status: a.status,
        startedAt: a.startedAt.toISOString(),
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
        total: total
          ? { rawScore: total.rawScore, scaledScore: total.scaledScore }
          : null,
      });
    }
    return result;
  }

  /** Cron backstop (I-005 / D-001): finalize attempts whose timer has lapsed. */
  async sweepExpired(): Promise<number> {
    const due = await this.attempts.find({
      where: {
        status: 'in-progress',
        mode: 'full',
        expiresAt: LessThan(new Date()),
      },
    });
    for (const attempt of due) {
      await this.finalize(attempt, 'expired');
    }
    return due.length;
  }

  // --- internals ---

  private async ownedAttempt(
    userId: string,
    attemptId: string,
  ): Promise<Attempt> {
    const attempt = await this.attempts.findOne({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.userId !== userId) {
      throw new ForbiddenException('Not your attempt');
    }
    return attempt;
  }

  /** Lazy expiry: if a full attempt's timer lapsed, finalize it now. */
  private async expireIfDue(attempt: Attempt): Promise<boolean> {
    if (
      attempt.status === 'in-progress' &&
      attempt.mode === 'full' &&
      attempt.expiresAt &&
      attempt.expiresAt.getTime() <= Date.now()
    ) {
      await this.finalize(attempt, 'expired');
      return true;
    }
    return false;
  }

  private async finalize(
    attempt: Attempt,
    status: 'submitted' | 'expired',
  ): Promise<void> {
    const test = await this.testsService.loadTree(attempt.testId);
    const partsInScope = this.scopeParts(test, attempt);

    const answers = await this.answers.find({
      where: { attemptId: attempt.id },
    });
    const correctByQuestion = new Map<string, boolean>();
    for (const a of answers) {
      correctByQuestion.set(a.questionId, a.isCorrect === true);
    }

    const tally: Record<'listening' | 'reading', { correct: number; total: number }> = {
      listening: { correct: 0, total: 0 },
      reading: { correct: 0, total: 0 },
    };
    for (const part of partsInScope) {
      const sec = part.section;
      for (const q of part.questions) {
        tally[sec].total += 1;
        if (correctByQuestion.get(q.id)) tally[sec].correct += 1;
      }
    }

    const sections: SectionRaw[] = [];
    if (tally.listening.total > 0)
      sections.push({ section: 'listening', ...tally.listening });
    if (tally.reading.total > 0)
      sections.push({ section: 'reading', ...tally.reading });

    await this.scoringService.scoreAttempt(attempt.id, sections);

    attempt.status = status;
    attempt.submittedAt = new Date();
    await this.attempts.save(attempt);
  }

  private stimulusView(
    stimulus: {
      id: string;
      type: string;
      storageKey: string | null;
      passageText: string | null;
    },
    played: boolean,
  ): StimulusView {
    return {
      id: stimulus.id,
      type: stimulus.type,
      storageKey: stimulus.storageKey,
      passageText: stimulus.passageText,
      played,
    };
  }

  private scopeParts(test: Test, attempt: Attempt): Part[] {
    if (attempt.mode === 'practice' && attempt.partId) {
      return test.parts.filter((p) => p.id === attempt.partId);
    }
    return test.parts;
  }

  private locateChoice(
    test: Test,
    attempt: Attempt,
    questionId: string,
    choiceId: string,
  ) {
    for (const part of this.scopeParts(test, attempt)) {
      for (const q of part.questions) {
        if (q.id === questionId) {
          const choice = q.choices.find((c) => c.id === choiceId);
          if (!choice) {
            throw new BadRequestException('Choice does not belong to question');
          }
          return { question: q, choice };
        }
      }
    }
    throw new BadRequestException('Question is not part of this attempt');
  }

  private async buildView(attempt: Attempt, test: Test): Promise<AttemptView> {
    const terminal = attempt.status !== 'in-progress';
    const partsInScope = this.scopeParts(test, attempt);

    const answers = await this.answers.find({
      where: { attemptId: attempt.id },
    });
    const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));

    const plays = await this.audioPlays.find({
      where: { attemptId: attempt.id },
    });
    const playedSet = new Set(plays.map((p) => p.stimulusId));

    const parts: PartView[] = partsInScope.map((part) => ({
      partId: part.id,
      partNumber: part.partNumber,
      section: part.section,
      questions: part.questions.map((q): QuestionView => {
        const ans = answerByQuestion.get(q.id);
        return {
          id: q.id,
          sequence: q.sequence,
          questionText: q.questionText,
          stimuli: (q.stimuli ?? []).map((s) =>
            this.stimulusView(s, playedSet.has(s.id)),
          ),
          choices: q.choices.map((c) => ({
            id: c.id,
            label: c.label,
            choiceText: c.choiceText,
            // Never leak the answer key while the attempt is live.
            ...(terminal ? { isCorrect: c.isCorrect } : {}),
          })),
          selectedChoiceId: ans?.selectedChoiceId ?? null,
          ...(terminal
            ? { isCorrect: ans?.isCorrect ?? null, explanationVi: q.explanationVi }
            : {}),
        };
      }),
    }));

    let scores;
    if (terminal) {
      const rows = await this.scoringService.getByAttempt(attempt.id);
      scores = rows.map((s) => ({
        section: s.section,
        rawScore: s.rawScore,
        scaledScore: s.scaledScore,
        scaledUnavailable: s.scaledUnavailable,
      }));
    }

    const timeRemainingSeconds =
      attempt.status === 'in-progress' && attempt.expiresAt
        ? Math.max(
            0,
            Math.floor((attempt.expiresAt.getTime() - Date.now()) / 1000),
          )
        : null;

    return {
      id: attempt.id,
      testId: attempt.testId,
      testTitle: test.title,
      mode: attempt.mode,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: attempt.expiresAt ? attempt.expiresAt.toISOString() : null,
      timeRemainingSeconds,
      parts,
      scores,
    };
  }
}
