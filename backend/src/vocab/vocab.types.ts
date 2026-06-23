/** Shapes for vocab generation: the LLM's raw output (Gen*) and the
 *  guardrail-validated, persistable form (Valid*). See
 *  docs/adr-english-learning-kg.md §6–§7. */

// --- what the LLM returns (validated structurally before use) ---
export interface GenItem {
  pattern: string; // display, e.g. "improve + noun"
  skill?: string | null; // taxonomy code, e.g. "L-COLLOC"
  sentence: string; // e.g. "I want to improve my English."
}
export interface GenSense {
  meaning: string; // "to make something better"
  meaningVi?: string | null;
  items: GenItem[];
}
export interface GeneratedWord {
  pos: string;
  cefr?: string | null;
  senses: GenSense[];
  collocations?: { collocate: string; relation: string }[];
  family?: { lemma: string; relation: string }[];
}

// --- guardrail-validated, ready to persist ---
export interface ValidItem {
  patternDisplay: string; // "improve + noun"
  patternName: string; // "verb + noun"
  patternTemplate: string; // reusable key, "verb + noun"
  skillId: string | null; // resolved against the skills table (null if unknown)
  sentenceText: string;
  targetStart: number;
  targetLen: number;
  exercisePrompt: string; // "I want to ______ my English."
  exerciseAnswer: string; // "improve" (surface form)
}
export interface ValidSense {
  gloss: string;
  glossVi: string | null;
  sortOrder: number;
  items: ValidItem[];
}
export interface ValidWord {
  lemma: string;
  pos: string;
  cefr: string | null;
  senses: ValidSense[];
  collocations: { collocate: string; relation: string }[];
  family: { lemma: string; relation: string }[];
  flagged: string[]; // notes on dropped/repaired content
}

// --- API response (docs §6) ---
export interface VocabResponse {
  word: string;
  pos: string;
  cefr: string | null;
  senses: {
    meaning: string;
    meaningVi: string | null;
    patterns: { display: string; skill: string | null }[];
    sentences: {
      text: string;
      exercise: { id: string; prompt: string; skill: string | null };
    }[];
  }[];
  collocations: string[];
  wordFamily: string[];
}
