import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface ExtractionJobMessage {
  jobId: string;
  examFileId: string;
  storageKey: string;
  fileName: string;
  provider: string;
  model?: string | null;
  // Target TOEIC part (5/6/7). The worker forces every question to this part
  // instead of classifying it, so per-part uploads can't be mis-assigned.
  part?: number | null;
}

/** Thin Redis wrapper used to enqueue extraction jobs for the Python worker. */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private client!: Redis;
  private queueKey!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.queueKey = this.config.get<string>('extractionQueue')!;
    this.client = new Redis(this.config.get<string>('redisUrl')!, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.client.on('error', (e) => this.logger.warn(`Redis error: ${e.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => undefined);
  }

  /** Push a job onto the extraction queue (LPUSH; worker does BRPOP). */
  async enqueueExtraction(msg: ExtractionJobMessage): Promise<void> {
    await this.client.lpush(this.queueKey, JSON.stringify(msg));
    this.logger.log(`Enqueued extraction job ${msg.jobId}`);
  }
}
