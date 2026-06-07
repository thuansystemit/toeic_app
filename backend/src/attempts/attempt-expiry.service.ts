import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AttemptsService } from './attempts.service';

/**
 * Cron backstop for attempt expiry (I-005 / D-001 hybrid). Lazy evaluation on
 * access is the primary mechanism; this sweep finalizes attempts abandoned by a
 * disconnected client so their scores still materialize.
 */
@Injectable()
export class AttemptExpiryService {
  private readonly logger = new Logger(AttemptExpiryService.name);

  constructor(private readonly attemptsService: AttemptsService) {}

  @Interval(60_000)
  async sweep(): Promise<void> {
    try {
      const n = await this.attemptsService.sweepExpired();
      if (n > 0) {
        this.logger.log(`Expired ${n} timed-out attempt(s).`);
      }
    } catch (err) {
      this.logger.error('Attempt expiry sweep failed', err as Error);
    }
  }
}
