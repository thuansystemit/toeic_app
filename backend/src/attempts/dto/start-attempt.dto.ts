import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class StartAttemptDto {
  @IsUUID()
  testId!: string;

  @IsIn(['full', 'practice'])
  mode!: 'full' | 'practice';

  // Required for practice mode (REQ-040): which part to practice.
  @IsOptional()
  @IsUUID()
  partId?: string;
}
