import { api } from './client';

/** One cloze exercise derived from an example sentence. */
export interface VocabExercise {
  id: string;
  prompt: string; // "I want to ______ my English."
  skill: string | null;
}
export interface VocabPattern {
  display: string; // "improve + noun"
  skill: string | null;
}
export interface VocabSense {
  meaning: string;
  meaningVi: string | null;
  patterns: VocabPattern[];
  sentences: { text: string; exercise: VocabExercise }[];
}
/** Mirrors the backend VocabResponse (English Learning KG, P1). */
export interface VocabEntry {
  word: string;
  pos: string;
  cefr: string | null;
  senses: VocabSense[];
  collocations: string[];
  wordFamily: string[];
}

export interface AttemptResult {
  correct: boolean;
  correctAnswer: string;
  meaning: string | null;
  pattern: string | null;
}

/** Look up a word → generate-and-cache learning content. */
export async function lookupWord(word: string): Promise<VocabEntry> {
  const res = await api.get<VocabEntry>(`/vocab/${encodeURIComponent(word)}`);
  return res.data;
}

/** Submit the learner's answer to a cloze exercise (server grades it). */
export async function submitAttempt(
  exerciseId: string,
  answer: string,
): Promise<AttemptResult> {
  const res = await api.post<AttemptResult>(
    `/vocab/exercises/${exerciseId}/attempt`,
    { answer },
  );
  return res.data;
}
