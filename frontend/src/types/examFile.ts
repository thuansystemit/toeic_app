export type ExamFileStatus =
  | 'uploaded'
  | 'queued'
  | 'extracting'
  | 'extracted'
  | 'failed'
  | 'imported';

export interface ExamFile {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: string;
  status: ExamFileStatus;
  questionCount: number;
  testId: string | null;
  error: string | null;
  createdAt: string;
}

export interface StagedChoice {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
  isCorrect: boolean;
}

export interface StagedQuestion {
  part: number;
  groupId?: string | null;
  passageText?: string | null;
  questionText: string;
  choices: StagedChoice[];
  explanationVi?: string | null;
  confidence?: number;
  issues?: string[];
}
