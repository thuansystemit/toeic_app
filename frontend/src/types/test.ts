export type TestStatus = 'draft' | 'published';
export type Section = 'listening' | 'reading';

export interface PartSummary {
  partId: string;
  partNumber: number;
  count: number;
}

export interface ChoiceDto {
  id: string;
  label: string;
  choiceText: string;
  isCorrect?: boolean;
}

export interface QuestionDto {
  id: string;
  sequence: number;
  questionText: string | null;
  explanationVi?: string | null;
  choices: ChoiceDto[];
}

export interface PartDto {
  id: string;
  partNumber: number;
  section: Section;
  targetQuestionCount: number;
  questions?: QuestionDto[];
}

export interface TestDto {
  id: string;
  title: string;
  description: string | null;
  status: TestStatus;
  timeLimitMinutes: number;
  parts?: PartDto[];
}

export interface MediaStimulusInput {
  type: 'audio' | 'image';
  storageKey: string;
  originalFilename?: string;
  mimeType?: string;
}

export interface NewQuestionInput {
  questionText?: string;
  explanationVi?: string;
  passageText?: string;
  media?: MediaStimulusInput[];
  choices: { label: 'A' | 'B' | 'C' | 'D'; choiceText: string; isCorrect: boolean }[];
}
