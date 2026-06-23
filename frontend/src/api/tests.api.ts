import { api } from './client';
import type {
  PartSummary,
  TestDto,
  NewQuestionInput,
  Skill,
  QuestionSkillsMap,
} from '../types/test';

export async function listSkills(): Promise<Skill[]> {
  const res = await api.get<Skill[]>('/tests/skills');
  return res.data;
}

export interface GraphNode {
  id: string;
  kind: 'skill' | 'question' | 'word';
  label: string;
  category?: string;
  part?: number;
  sentences?: string[]; // example sentences for word nodes (shown on hover)
}
export interface KnowledgeGraph {
  nodes: GraphNode[];
  links: { source: string; target: string }[];
}

export async function getKnowledgeGraph(): Promise<KnowledgeGraph> {
  const res = await api.get<KnowledgeGraph>('/tests/graph');
  return res.data;
}

export async function getQuestionSkills(
  testId: string,
): Promise<QuestionSkillsMap> {
  const res = await api.get<QuestionSkillsMap>(`/tests/${testId}/question-skills`);
  return res.data;
}

export async function setQuestionSkills(
  testId: string,
  partId: string,
  questionId: string,
  skillIds: string[],
): Promise<void> {
  await api.put(
    `/tests/${testId}/parts/${partId}/questions/${questionId}/skills`,
    { skillIds },
  );
}

export async function listPublishedTests(): Promise<TestDto[]> {
  const res = await api.get<TestDto[]>('/tests');
  return res.data;
}

export async function listMyTests(): Promise<TestDto[]> {
  const res = await api.get<TestDto[]>('/tests/mine');
  return res.data;
}

export interface PublishedPart {
  partId: string;
  partNumber: number;
  section: string;
  count: number;
}

export async function getPublishedParts(
  testId: string,
): Promise<PublishedPart[]> {
  const res = await api.get<PublishedPart[]>(`/tests/${testId}/parts`);
  return res.data;
}

export async function createTest(payload: {
  title: string;
  description?: string;
  timeLimitMinutes?: number;
}): Promise<TestDto> {
  const res = await api.post<TestDto>('/tests', payload);
  return res.data;
}

export async function getAuthoringView(testId: string): Promise<TestDto> {
  const res = await api.get<TestDto>(`/tests/${testId}/authoring`);
  return res.data;
}

export async function getPartSummaries(testId: string): Promise<PartSummary[]> {
  const res = await api.get<PartSummary[]>(`/tests/${testId}/summary`);
  return res.data;
}

export async function addQuestion(
  testId: string,
  partId: string,
  input: NewQuestionInput,
): Promise<void> {
  await api.post(`/tests/${testId}/parts/${partId}/questions`, input);
}

export async function updateQuestion(
  testId: string,
  partId: string,
  questionId: string,
  input: {
    questionText?: string;
    explanationVi?: string;
    passageText?: string;
    choices: NewQuestionInput['choices'];
    media?: NewQuestionInput['media'];
  },
): Promise<void> {
  await api.patch(
    `/tests/${testId}/parts/${partId}/questions/${questionId}`,
    input,
  );
}

export async function deleteQuestion(
  testId: string,
  partId: string,
  questionId: string,
): Promise<void> {
  await api.delete(`/tests/${testId}/parts/${partId}/questions/${questionId}`);
}

export async function deleteTest(testId: string): Promise<void> {
  await api.delete(`/tests/${testId}`);
}

export async function publishPart(
  testId: string,
  partId: string,
): Promise<void> {
  await api.post(`/tests/${testId}/parts/${partId}/publish`);
}

export async function unpublishPart(
  testId: string,
  partId: string,
): Promise<void> {
  await api.post(`/tests/${testId}/parts/${partId}/unpublish`);
}

export async function publishTest(testId: string): Promise<TestDto> {
  const res = await api.post<TestDto>(`/tests/${testId}/publish`);
  return res.data;
}

export async function unpublishTest(testId: string): Promise<TestDto> {
  const res = await api.post<TestDto>(`/tests/${testId}/unpublish`);
  return res.data;
}

/** Mark this published test as the single public sample for guests. */
export async function setSampleTest(testId: string): Promise<{ isSample: boolean }> {
  const res = await api.post<{ isSample: boolean }>(`/tests/${testId}/sample`);
  return res.data;
}
