import { api } from './client';
import type { ExamFile, StagedQuestion } from '../types/examFile';

export async function uploadExamFile(file: File): Promise<ExamFile> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<ExamFile>('/exam-files', form);
  return res.data;
}

export async function listExamFiles(): Promise<ExamFile[]> {
  const res = await api.get<ExamFile[]>('/exam-files');
  return res.data;
}

export async function getExamFile(
  id: string,
): Promise<{ file: ExamFile; job: { status: string; warnings: string[] | null; error: string | null } | null }> {
  const res = await api.get(`/exam-files/${id}`);
  return res.data;
}

export async function reviewExamFile(
  id: string,
): Promise<{ file: ExamFile; questions: StagedQuestion[]; warnings: string[] }> {
  const res = await api.get(`/exam-files/${id}/review`);
  return res.data;
}

export async function importExamFile(
  id: string,
  testId: string,
  questions: StagedQuestion[],
): Promise<{ imported: number; byPart: Record<number, number> }> {
  const res = await api.post(`/exam-files/${id}/import`, { testId, questions });
  return res.data;
}

export async function deleteExamFile(id: string): Promise<void> {
  await api.delete(`/exam-files/${id}`);
}
