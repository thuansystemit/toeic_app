import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { StagedQuestion } from '../entities/extraction-job.entity';

/** Payload the Python worker POSTs back when an extraction finishes. */
export class ExtractionCallbackDto {
  @IsIn(['succeeded', 'failed'])
  status!: 'succeeded' | 'failed';

  @IsOptional()
  @IsArray()
  questions?: StagedQuestion[];

  @IsOptional()
  @IsArray()
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
