import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class ImportChoice {
  @IsIn(['A', 'B', 'C', 'D'])
  label!: 'A' | 'B' | 'C' | 'D';

  @IsString()
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

class ImportQuestion {
  @IsInt()
  @Min(5)
  part!: number; // reading parts 5-7

  @IsString()
  questionText!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  passageText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  explanationVi?: string;

  // Skill codes (knowledge-graph tags) classified by the extraction LLM.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  // Carried over from the staged/extracted shape; accepted but not required.
  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  issues?: string[];

  @IsOptional()
  @IsInt()
  sourcePage?: number;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ImportChoice)
  choices!: ImportChoice[];
}

export class ImportQuestionsDto {
  // Target draft test the approved questions are imported into.
  @IsUUID()
  testId!: string;

  // The teacher-approved (and possibly edited) questions from the review screen.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportQuestion)
  questions!: ImportQuestion[];
}
