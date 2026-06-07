import { api } from './client';
import type { AttemptView, AttemptSummary } from '../types/attempt';

export async function startAttempt(payload: {
  testId: string;
  mode: 'full' | 'practice';
  partId?: string;
}): Promise<AttemptView> {
  const res = await api.post<AttemptView>('/attempts', payload);
  return res.data;
}

export async function getAttempt(attemptId: string): Promise<AttemptView> {
  const res = await api.get<AttemptView>(`/attempts/${attemptId}`);
  return res.data;
}

export interface AnswerFeedback {
  isCorrect: boolean;
  correctChoiceId: string | null;
  explanationVi: string | null;
}

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  selectedChoiceId: string,
): Promise<{ saved: boolean; feedback?: AnswerFeedback }> {
  const res = await api.post<{ saved: boolean; feedback?: AnswerFeedback }>(
    `/attempts/${attemptId}/answers`,
    { questionId, selectedChoiceId },
  );
  return res.data;
}

export async function submitAttempt(attemptId: string): Promise<AttemptView> {
  const res = await api.post<AttemptView>(`/attempts/${attemptId}/submit`);
  return res.data;
}

/** Record the (single) play of an audio stimulus. Rejects with 409 if already
 *  played in a full-test attempt (strict play-once). */
export async function recordAudioPlay(
  attemptId: string,
  stimulusId: string,
): Promise<void> {
  await api.post(`/attempts/${attemptId}/audio-plays`, { stimulusId });
}

export async function listMyAttempts(): Promise<AttemptSummary[]> {
  const res = await api.get<AttemptSummary[]>('/attempts/mine');
  return res.data;
}
