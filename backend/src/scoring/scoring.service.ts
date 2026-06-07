import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Score, ScoreSection } from './entities/score.entity';
import {
  ConversionSection,
  ScoreConversion,
} from './entities/score-conversion.entity';

export interface SectionRaw {
  section: ConversionSection;
  correct: number;
  total: number;
}

export interface ScoreLine {
  section: ScoreSection;
  rawScore: number;
  scaledScore: number | null;
  scaledUnavailable: boolean;
}

/**
 * Swappable conversion strategy (ADR-007 / I-001):
 *  - If the score_conversion_table has rows for a section, use them (official/admin-seeded).
 *  - Otherwise fall back to a linear approximation (raw 0 -> 5, raw 100 -> 495,
 *    rounded to the nearest 5). Approximation is flagged via scaledUnavailable=false
 *    but the values are clearly marked as approximate to the caller via the table check.
 */
@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(Score)
    private readonly scores: Repository<Score>,
    @InjectRepository(ScoreConversion)
    private readonly conversions: Repository<ScoreConversion>,
  ) {}

  /** Compute and persist scores for an attempt. Returns the lines written. */
  async scoreAttempt(
    attemptId: string,
    sections: SectionRaw[],
  ): Promise<ScoreLine[]> {
    const lines: ScoreLine[] = [];
    let totalScaled = 0;
    let anyScaledUnavailable = false;
    let totalRaw = 0;

    for (const s of sections) {
      // Normalize correct-count onto the 0-100 raw scale the table expects.
      const rawNormalized =
        s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      const scaled = await this.toScaled(s.section, rawNormalized);
      lines.push({
        section: s.section,
        rawScore: s.correct,
        scaledScore: scaled,
        scaledUnavailable: scaled === null,
      });
      totalRaw += s.correct;
      if (scaled === null) anyScaledUnavailable = true;
      else totalScaled += scaled;
    }

    lines.push({
      section: 'total',
      rawScore: totalRaw,
      scaledScore: anyScaledUnavailable ? null : totalScaled,
      scaledUnavailable: anyScaledUnavailable,
    });

    await this.scores.delete({ attemptId });
    await this.scores.save(
      lines.map((l) =>
        this.scores.create({
          attemptId,
          section: l.section,
          rawScore: l.rawScore,
          scaledScore: l.scaledScore,
          scaledUnavailable: l.scaledUnavailable,
        }),
      ),
    );
    return lines;
  }

  getByAttempt(attemptId: string): Promise<Score[]> {
    return this.scores.find({ where: { attemptId } });
  }

  private async toScaled(
    section: ConversionSection,
    rawNormalized: number,
  ): Promise<number | null> {
    const row = await this.conversions.findOne({
      where: { section, rawScore: rawNormalized },
    });
    if (row) return row.scaledScore;

    // No seeded table -> linear approximation rounded to nearest 5 (REQ-072 bounds).
    const approx = 5 + (rawNormalized / 100) * (495 - 5);
    return Math.round(approx / 5) * 5;
  }
}
