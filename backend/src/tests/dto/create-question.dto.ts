import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ChoiceInput {
  @IsIn(['A', 'B', 'C', 'D'])
  label!: 'A' | 'B' | 'C' | 'D';

  @IsString()
  @MinLength(1)
  choiceText!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class MediaStimulusInput {
  @IsIn(['audio', 'image'])
  type!: 'audio' | 'image';

  // storageKey returned from POST /files/upload
  @IsString()
  @MaxLength(500)
  storageKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalFilename?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mimeType?: string;
}

export class CreateQuestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  questionText?: string;

  // Vietnamese explanation (GAP-001) — optional at authoring time.
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  explanationVi?: string;

  // Optional passage stimulus (Parts 6/7).
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  passageText?: string;

  // Optional audio/image stimuli. A question may carry several — e.g. TOEIC
  // Part 1 has both a photograph (image) and the spoken options (audio).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => MediaStimulusInput)
  media?: MediaStimulusInput[];

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ChoiceInput)
  choices!: ChoiceInput[];
}
