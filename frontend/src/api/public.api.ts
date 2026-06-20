import { api } from './client';
import type { TestDto } from '../types/test';

export interface PublicTestCard {
  id: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number;
  isSample: boolean;
  partCount: number;
  questionCount: number;
}

/** Locked teasers of published tests (no questions). No auth required. */
export async function getPublicTests(): Promise<PublicTestCard[]> {
  const res = await api.get<PublicTestCard[]>('/public/tests');
  return res.data;
}

/** The full sample test for a guest preview, or null if none. No auth required. */
export async function getSampleTest(): Promise<TestDto | null> {
  const res = await api.get<TestDto | null>('/public/tests/sample');
  return res.data;
}
