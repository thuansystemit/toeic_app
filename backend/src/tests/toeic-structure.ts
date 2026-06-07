import { Section } from './entities/part.entity';

/** Canonical TOEIC Listening & Reading structure (docs/sdlc/01-product-spec). */
export interface PartSpec {
  partNumber: number;
  section: Section;
  targetQuestionCount: number;
}

export const TOEIC_PARTS: PartSpec[] = [
  { partNumber: 1, section: 'listening', targetQuestionCount: 6 },
  { partNumber: 2, section: 'listening', targetQuestionCount: 25 },
  { partNumber: 3, section: 'listening', targetQuestionCount: 39 },
  { partNumber: 4, section: 'listening', targetQuestionCount: 30 },
  { partNumber: 5, section: 'reading', targetQuestionCount: 30 },
  { partNumber: 6, section: 'reading', targetQuestionCount: 16 },
  { partNumber: 7, section: 'reading', targetQuestionCount: 54 },
];

export function sectionForPart(partNumber: number): Section {
  return partNumber <= 4 ? 'listening' : 'reading';
}
