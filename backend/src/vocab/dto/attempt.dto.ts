import { IsString, MaxLength, MinLength } from 'class-validator';

/** Learner's answer to a cloze exercise (§12.1). The server grades it. */
export class AttemptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  answer!: string;
}
