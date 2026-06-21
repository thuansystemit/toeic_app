import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { MasteryService } from './mastery.service';

/**
 * Learner-facing weak-skill practice surface (ADR knowledge-graph Phase 1).
 * Mastery is derived from the learner's own attempts; recommendations deep-link
 * back into the existing per-part practice flow.
 */
@Controller('practice')
@UseGuards(JwtAuthGuard)
export class MasteryController {
  constructor(private readonly mastery: MasteryService) {}

  /** The learner's per-skill mastery (weakest first). */
  @Get('skills')
  skills(@CurrentUser() user: AuthenticatedUser) {
    return this.mastery.getSummary(user.id);
  }

  /** Weakest skills paired with a part to practise them. */
  @Get('recommendations')
  recommendations(@CurrentUser() user: AuthenticatedUser) {
    return this.mastery.getRecommendations(user.id);
  }
}
