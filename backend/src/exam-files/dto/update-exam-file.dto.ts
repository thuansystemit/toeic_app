import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateExamFileDto {
  // Human-friendly title for the import; empty string clears it.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
