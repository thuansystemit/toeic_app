import { api } from './client';

/** A skill the learner has practised, with their current mastery (0..1). */
export interface SkillMastery {
  skillId: string;
  code: string;
  name: string;
  category: string;
  score: number;
  attempts: number;
  correct: number;
}

/** A weak skill paired with a published part to drill it. */
export interface PracticeRecommendation {
  skillId: string;
  code: string;
  name: string;
  category: string;
  score: number;
  unseen: number;
  testId: string;
  testTitle: string;
  partId: string;
  partNumber: number;
  section: string;
}

export async function getSkillMastery(): Promise<SkillMastery[]> {
  const res = await api.get<SkillMastery[]>('/practice/skills');
  return res.data;
}

export async function getRecommendations(): Promise<PracticeRecommendation[]> {
  const res = await api.get<PracticeRecommendation[]>('/practice/recommendations');
  return res.data;
}
