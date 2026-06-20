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

/** Part 6 is text completion: every question slot is seeded with this standard
 * business-document layout (4 blanks) instead of an empty passage, so authors
 * start from a template rather than a blank box. */
export const PART6_PASSAGE_TEMPLATE = [
  '[Email / Memo / Notice / Advertisement]',
  '',
  'To:',
  'From:',
  'Date:',
  'Subject:',
  '',
  'Dear ____,',
  '',
  '[Sentence 1] ____.',
  '[Sentence 2] ____.',
  '[Sentence 3] ____.',
  '[Sentence 4] ____.',
  '',
  'Sincerely,',
  '[Name]',
].join('\n');
