export type TestStatus = 'draft' | 'published';
export type PartStatus = 'draft' | 'published';
export type Section = 'listening' | 'reading';

export interface PartSummary {
  partId: string;
  partNumber: number;
  count: number;
}

export interface Skill {
  id: string;
  code: string;
  name: string;
  section: Section;
  category: 'grammar' | 'lexical' | 'discourse' | 'comprehension' | 'listening';
}

export interface QuestionSkillTag {
  skillId: string;
  code: string;
  name: string;
}

/** Map of question id -> its skill tags (from GET /tests/:id/question-skills). */
export type QuestionSkillsMap = Record<string, QuestionSkillTag[]>;

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
  status: PartStatus;
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
