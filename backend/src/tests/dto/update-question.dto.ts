import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ChoiceInput, MediaStimulusInput } from './create-question.dto';

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  questionText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  explanationVi?: string;

  // Shared reading passage (Part 6 text completion, Part 7 reading). Replaces
  // the question's existing `passage` stimulus when provided.
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  passageText?: string;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ChoiceInput)
  choices!: ChoiceInput[];

  // Audio/image stimuli (e.g. Part 1 photo+audio, Part 2 audio). Each entry
  // replaces the existing stimulus of the same type on this question.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaStimulusInput)
  media?: MediaStimulusInput[];
}
