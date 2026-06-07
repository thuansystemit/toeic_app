export type AttemptStatus = 'in-progress' | 'submitted' | 'expired';

export interface AttemptChoice {
  id: string;
  label: string;
  choiceText: string;
  isCorrect?: boolean;
}

export interface AttemptStimulus {
  id: string;
  type: 'audio' | 'image' | 'passage' | string;
  storageKey: string | null;
  passageText: string | null;
  played: boolean;
}

export interface AttemptQuestion {
  id: string;
  sequence: number;
  questionText: string | null;
  stimuli: AttemptStimulus[];
  choices: AttemptChoice[];
  selectedChoiceId: string | null;
  isCorrect?: boolean | null;
  explanationVi?: string | null;
}

export interface AttemptPart {
  partId: string;
  partNumber: number;
  section: string;
  questions: AttemptQuestion[];
}

export interface ScoreLine {
  section: string;
  rawScore: number;
  scaledScore: number | null;
  scaledUnavailable: boolean;
}

export interface AttemptView {
  id: string;
  testId: string;
  testTitle: string;
  mode: 'full' | 'practice';
  status: AttemptStatus;
  startedAt: string;
  expiresAt: string | null;
  timeRemainingSeconds: number | null;
  parts: AttemptPart[];
  scores?: ScoreLine[];
}

export interface AttemptSummary {
  id: string;
  testId: string;
  mode: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  total: { rawScore: number; scaledScore: number | null } | null;
}
