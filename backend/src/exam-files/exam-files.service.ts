import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExamFile } from './entities/exam-file.entity';
import {
  ExtractionJob,
  StagedQuestion,
} from './entities/extraction-job.entity';
import { FilesService } from '../files/files.service';
import { QueueService } from '../queue/queue.service';
import { TestsService } from '../tests/tests.service';
import { ExtractionCallbackDto } from './dto/extraction-callback.dto';
import { ImportQuestionsDto } from './dto/import-questions.dto';
import { UserRole } from '../users/user.entity';

const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

@Injectable()
export class ExamFilesService {
  constructor(
    @InjectRepository(ExamFile)
    private readonly examFiles: Repository<ExamFile>,
    @InjectRepository(ExtractionJob)
    private readonly jobs: Repository<ExtractionJob>,
    private readonly filesService: FilesService,
    private readonly queue: QueueService,
    private readonly testsService: TestsService,
  ) {}

  async upload(
    userId: string,
    file: Express.Multer.File | undefined,
    part: number,
    // Default the extraction provider from env so it stays in sync with the
    // worker's LLM_PROVIDER (both read the same value); falls back to ollama.
    provider = process.env.LLM_PROVIDER ?? 'ollama',
  ): Promise<ExamFile> {
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File exceeds 20MB limit');
    }
    // Reading parts only — listening (1-4) can't be extracted from a document.
    if (![5, 6, 7].includes(part)) {
      throw new BadRequestException('part must be 5, 6 or 7 (reading)');
    }
    const stored = await this.filesService.saveDocument(file);

    const examFile = await this.examFiles.save(
      this.examFiles.create({
        originalFilename: file.originalname,
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        sizeBytes: String(file.size),
        status: 'queued',
        uploadedBy: userId,
        part,
        questionCount: 0,
      }),
    );

    const job = await this.jobs.save(
      this.jobs.create({ examFileId: examFile.id, provider, status: 'queued' }),
    );

    await this.queue.enqueueExtraction({
      jobId: job.id,
      examFileId: examFile.id,
      storageKey: examFile.storageKey,
      fileName: examFile.originalFilename,
      provider,
      part,
    });
    return examFile;
  }

  list(userId: string, role: UserRole): Promise<ExamFile[]> {
    const where = role === 'admin' ? {} : { uploadedBy: userId };
    return this.examFiles.find({ where, order: { createdAt: 'DESC' } });
  }

  async getOwned(
    id: string,
    userId: string,
    role: UserRole,
  ): Promise<ExamFile> {
    const f = await this.examFiles.findOne({ where: { id } });
    if (!f) throw new NotFoundException('Exam file not found');
    if (f.uploadedBy !== userId && role !== 'admin') {
      throw new ForbiddenException('Not your file');
    }
    return f;
  }

  async latestJob(examFileId: string): Promise<ExtractionJob | null> {
    return this.jobs.findOne({
      where: { examFileId },
      order: { createdAt: 'DESC' },
    });
  }

  async review(
    id: string,
    userId: string,
    role: UserRole,
  ): Promise<{ file: ExamFile; questions: StagedQuestion[]; warnings: string[] }> {
    const file = await this.getOwned(id, userId, role);
    const job = await this.latestJob(id);
    if (!job || job.status !== 'succeeded') {
      throw new BadRequestException('Extraction is not ready for review');
    }
    return {
      file,
      questions: job.stagedQuestions ?? [],
      warnings: job.warnings ?? [],
    };
  }

  async remove(id: string, userId: string, role: UserRole): Promise<void> {
    const file = await this.getOwned(id, userId, role);
    await this.examFiles.delete({ id: file.id }); // jobs cascade
  }

  /** Commit teacher-approved questions into a draft test (atomic). */
  async import(
    id: string,
    userId: string,
    role: UserRole,
    dto: ImportQuestionsDto,
  ): Promise<{ imported: number; byPart: Record<number, number> }> {
    const file = await this.getOwned(id, userId, role);
    const result = await this.testsService.importQuestions(
      dto.testId,
      userId,
      role,
      dto.questions.map((q) => ({
        part: q.part,
        questionText: q.questionText,
        passageText: q.passageText,
        explanationVi: q.explanationVi,
        choices: q.choices,
        skills: q.skills,
      })),
    );
    file.status = 'imported';
    file.testId = dto.testId;
    file.questionCount = result.imported;
    await this.examFiles.save(file);
    return result;
  }

  // --- internal (called by the Python worker) ---

  async markExtracting(jobId: string): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) return;
    job.status = 'running';
    await this.jobs.save(job);
    await this.examFiles.update({ id: job.examFileId }, { status: 'extracting' });
  }

  async handleCallback(
    jobId: string,
    dto: ExtractionCallbackDto,
  ): Promise<void> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    if (dto.status === 'succeeded') {
      job.status = 'succeeded';
      job.stagedQuestions = dto.questions ?? [];
      job.warnings = dto.warnings ?? [];
      job.usage = dto.usage ?? null;
      job.model = dto.model ?? job.model;
      await this.jobs.save(job);
      await this.examFiles.update(
        { id: job.examFileId },
        { status: 'extracted', questionCount: (dto.questions ?? []).length },
      );
    } else {
      job.status = 'failed';
      job.error = dto.error ?? 'Extraction failed';
      await this.jobs.save(job);
      await this.examFiles.update(
        { id: job.examFileId },
        { status: 'failed', error: dto.error ?? 'Extraction failed' },
      );
    }
  }
}
