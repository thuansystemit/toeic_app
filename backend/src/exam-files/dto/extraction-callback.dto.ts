import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Structural verification of the worker payload (EDIES §13: validate ALL LLM
 * output). These DTOs mirror the Python `ExtractedQuestion` contract exactly so
 * the global ValidationPipe (whitelist + forbidNonWhitelisted) rejects a
 * malformed payload with 400 BEFORE the job is marked succeeded. Domain-level
 * checks (choice count, single correct answer, ...) are NOT enforced here — they
 * are the guardrail's job (see extraction-guardrail.ts), which flags rather than
 * rejects so a mostly-good extraction still reaches review.
 */
class StagedChoiceDto {
  @IsIn(['A', 'B', 'C', 'D'])
  label!: 'A' | 'B' | 'C' | 'D';

  @IsString()
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class StagedQuestionDto {
  @IsInt()
  @Min(5)
  @Max(7)
  part!: number;

  // Source question number (e.g. 101) — round-tripped, not persisted separately.
  @IsOptional()
  @IsInt()
  number?: number | null;

  @IsOptional()
  @IsString()
  groupId?: string | null;

  @IsOptional()
  @IsString()
  passageText?: string | null;

  @IsString()
  questionText!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StagedChoiceDto)
  choices!: StagedChoiceDto[];

  @IsOptional()
  @IsString()
  explanationVi?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  issues?: string[];

  @IsOptional()
  @IsInt()
  sourcePage?: number | null;
}

/** Payload the Python worker POSTs back when an extraction finishes. */
export class ExtractionCallbackDto {
  @IsIn(['succeeded', 'failed'])
  status!: 'succeeded' | 'failed';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StagedQuestionDto)
  questions?: StagedQuestionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  warnings?: string[];

  @IsOptional()
  @IsObject()
  usage?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
