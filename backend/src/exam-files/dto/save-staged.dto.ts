import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { StagedQuestionDto } from './extraction-callback.dto';

/**
 * Payload for saving teacher edits back to the staged questions (before import).
 * Reuses the same lenient per-question validation as the worker callback —
 * structure is checked, but a partially-filled question is allowed so work can be
 * saved mid-edit. The import DTO remains the strict gate to a real test.
 */
export class SaveStagedQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StagedQuestionDto)
  questions!: StagedQuestionDto[];
}
