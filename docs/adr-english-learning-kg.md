# Design — English Learning Knowledge Graph (word-centric lexical layer)

**Status:** Draft for review (design-only; no code yet)
**Related:** [adr-knowledge-graph.md](./adr-knowledge-graph.md) (skill taxonomy + learner mastery — this builds on it), [feature-pdf-question-import.md](./feature-pdf-question-import.md)

## 1. Requirement

> User provides an English word; the system uses a knowledge graph to generate
> useful learning content, especially example sentences.

**Worked example** — input `improve`:

| Field | Output | Backing graph node |
|---|---|---|
| Meaning | to make something better | `lex_sense.gloss` |
| Pattern | improve + noun | `lex_word_pattern` (word × pattern) |
| Sentence | I want to improve my English. | `lex_sentence.text` |
| Exercise | I want to ______ my English. | `lex_exercise.prompt` (+ answer `improve`) |

## 2. Decisions (locked with product owner)

1. **Deliverable now:** this design doc; implementation follows on approval.
2. **Storage:** Postgres (NestJS + TypeORM) — model the graph as a property
   graph in relational tables. No new infra; consistent with the existing
   knowledge-graph ADR (§3: "~70–80% of value needs no graph DB").
3. **Content source:** LLM-generated on demand, then **cached** into the graph
   as nodes/edges. Repeat lookups are instant and the content is editable.
4. **Integration:** wire into the **existing skill taxonomy** (`skills`) and
   **`learner_skill_mastery`**, so word practice feeds the same mastery model as
   TOEIC questions. The lexical layer reuses the keystone `skills` table — it
   does not fork a second taxonomy.

## 3. Why this is a graph (not just a vocab table)

The value is the **edges**: a word connects to senses, to reusable patterns, to
sentences, to exercises, to collocates, to its word family, and — the
integration keystone — to **skills**. A lookup is a traversal from one `Word`
node out to the learning content; recommendations later traverse Word ↔ Skill ↔
Learner. Modeled relationally now; the same node/edge shape can project into
Neo4j later (per the existing ADR §2) without redesign.

## 4. Domain model

### 4.1 Nodes
- **Word** (`lex_words`) — a headword/lemma. The entry point.
- **Sense** (`lex_senses`) — one meaning of a word ("to make something better").
  A word has 1..n senses.
- **Pattern** (`lex_patterns`) — a reusable grammatical/collocational frame
  ("V + object noun"). Shared across many words.
- **Sentence** (`lex_sentences`) — an example that realizes a sense (+ usually a
  pattern), with the target word's span recorded.
- **Exercise** (`lex_exercises`) — a practice item derived from a sentence by
  blanking the target span.

### 4.2 Edges
- `Word —HAS_SENSE→ Sense`
- `Word —HAS_PATTERN→ Pattern` (via `lex_word_patterns`, the "improve + noun"
  instantiation) **—TESTS→ Skill**
- `Sense —EXEMPLIFIED_BY→ Sentence`
- `Sentence —INSTANTIATES→ Pattern`
- `Sentence —HAS_EXERCISE→ Exercise` **—TESTS→ Skill**
- `Word —COLLOCATES_WITH→ Word` (via `lex_collocations`)
- `Word —WORD_FAMILY→ Word` (improve / improvement / improved)
- `Word —SYNONYM|ANTONYM→ Word` (via `lex_word_relations`)

### 4.3 Integration edges (keystone)
- `Pattern.skill_id → skills.id` and `Exercise.skill_id → skills.id`
  (e.g. "improve + noun" → `L-COLLOC`; word-form items → `G-WFORM`).
- Answering an exercise updates **`learner_skill_mastery(user_id, skill_id)`** —
  the *existing* per-skill mastery table — so vocabulary practice and TOEIC
  questions accrue to one mastery model and feed the same weak-skill
  recommendations (ADR §B).

```
                         ┌──────────────┐
   input "improve"  ─►   │   lex_words  │
                         └──────┬───────┘
            HAS_SENSE ┌─────────┼─────────┐ HAS_PATTERN
                      ▼                   ▼
              ┌─────────────┐     ┌────────────────┐   TESTS   ┌────────┐
              │ lex_senses  │     │lex_word_patterns├──────────►│ skills │◄─┐
              └──────┬──────┘     └───────┬────────┘           └────────┘  │
        EXEMPLIFIED_BY│                   │ INSTANTIATES                    │
                      ▼                   │                                 │
              ┌─────────────┐◄────────────┘                                 │
              │lex_sentences│                                               │
              └──────┬──────┘                                               │
          HAS_EXERCISE│                                              TESTS  │
                      ▼                                                      │
              ┌─────────────┐                                               │
              │lex_exercises├───────────────────────────────────────────────┘
              └──────┬──────┘
                     │ attempt ►  learner_skill_mastery(user_id, skill_id)   (existing)
```

## 5. Schema (Postgres / TypeORM, proposed)

All new tables are prefixed `lex_` to keep the lexical layer visually distinct
from the question/test core. Generated content carries provenance
(`model`, `prompt_version`, `status`) so it can be regenerated and human-curated
— mirroring the `extraction_jobs` staged-question review pattern.

```sql
CREATE TABLE lex_words (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lemma         VARCHAR(80)  NOT NULL,
  pos           VARCHAR(16)  NOT NULL,           -- verb|noun|adj|adv|...
  cefr          VARCHAR(4),                      -- A1..C2 (optional)
  freq_rank     INT,                             -- corpus frequency (optional)
  status        VARCHAR(12)  NOT NULL DEFAULT 'generated', -- generated|approved
  model         VARCHAR(100),
  prompt_version VARCHAR(40),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (lemma, pos)
);

CREATE TABLE lex_senses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id     UUID NOT NULL REFERENCES lex_words(id) ON DELETE CASCADE,
  gloss       TEXT NOT NULL,                     -- "to make something better"
  gloss_vi    TEXT,                              -- L1 gloss (optional)
  sort_order  INT  NOT NULL DEFAULT 0
);

CREATE TABLE lex_patterns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120) NOT NULL,             -- "verb + object noun"
  template    VARCHAR(120) NOT NULL,             -- "V + NP"
  pattern_type VARCHAR(24) NOT NULL,             -- colligation|collocation
  skill_id    UUID REFERENCES skills(id),        -- integration edge
  UNIQUE (template)
);

CREATE TABLE lex_word_patterns (                 -- Word —HAS_PATTERN→ Pattern
  word_id     UUID NOT NULL REFERENCES lex_words(id)    ON DELETE CASCADE,
  pattern_id  UUID NOT NULL REFERENCES lex_patterns(id) ON DELETE CASCADE,
  display     VARCHAR(120) NOT NULL,             -- "improve + noun"
  PRIMARY KEY (word_id, pattern_id)
);

CREATE TABLE lex_sentences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sense_id      UUID NOT NULL REFERENCES lex_senses(id) ON DELETE CASCADE,
  pattern_id    UUID REFERENCES lex_patterns(id),
  text          TEXT NOT NULL,                   -- "I want to improve my English."
  target_word_id UUID NOT NULL REFERENCES lex_words(id),
  target_start  INT NOT NULL,                    -- char offset of the surface form
  target_len    INT NOT NULL,
  cefr          VARCHAR(4),
  status        VARCHAR(12) NOT NULL DEFAULT 'generated'
);

CREATE TABLE lex_exercises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sentence_id UUID NOT NULL REFERENCES lex_sentences(id) ON DELETE CASCADE,
  kind        VARCHAR(16) NOT NULL DEFAULT 'cloze',   -- cloze|mcq
  prompt      TEXT NOT NULL,                     -- "I want to ______ my English."
  answer      VARCHAR(80) NOT NULL,              -- "improve" (surface form)
  distractors JSONB,                             -- ["improvement","improving",...] for mcq
  skill_id    UUID REFERENCES skills(id),        -- integration edge → mastery
  status      VARCHAR(12) NOT NULL DEFAULT 'generated'
);

-- relational edges
CREATE TABLE lex_collocations (
  head_word_id UUID NOT NULL REFERENCES lex_words(id) ON DELETE CASCADE,
  collocate    VARCHAR(80) NOT NULL,             -- "English", "skills"
  relation     VARCHAR(24) NOT NULL,             -- verb+noun|adj+noun|...
  strength     REAL,
  PRIMARY KEY (head_word_id, collocate, relation)
);
CREATE TABLE lex_word_relations (                -- synonym/antonym/word-family
  from_word_id UUID NOT NULL REFERENCES lex_words(id) ON DELETE CASCADE,
  to_lemma     VARCHAR(80) NOT NULL,
  relation     VARCHAR(16) NOT NULL,             -- synonym|antonym|noun_form|adj_form
  PRIMARY KEY (from_word_id, to_lemma, relation)
);
```

## 6. Lookup + generation flow

```
GET /vocab/:word
  1. normalize → lemma + POS (lemmatizer)
  2. SELECT from lex_words by lemma
       hit  → traverse (senses, word_patterns, sentences, exercises) → return  ← cache hit, instant
       miss → 3. GENERATE
  3. LLM call (existing pluggable provider) → structured JSON:
       { senses[], patterns[], sentences[], exercises[], collocations[], family[], skillCodes[] }
  4. GUARDRAIL + validate (see §7); drop/flag invalid items
  5. PERSIST nodes/edges (cache); map skillCodes → skills.id
  6. return assembled payload
```

**Exercise generation is mechanical, not LLM-trusted.** The LLM picks the best
sentence and identifies the target word; the cloze blank is then produced in
code by masking `[target_start, target_len]`. This *guarantees* the exercise
matches the sentence and the answer is exactly the target surface form — the
same "don't trust the model for what code can verify" principle used in the
extraction guardrail.

### Response shape (matches the requirement)
```json
{
  "word": "improve", "pos": "verb",
  "senses": [{
    "meaning": "to make something better",
    "patterns": [{ "display": "improve + noun", "skill": "L-COLLOC" }],
    "sentences": [{
      "text": "I want to improve my English.",
      "exercise": { "prompt": "I want to ______ my English.", "answer": "improve", "skill": "L-COLLOC" }
    }]
  }],
  "collocations": ["improve skills", "improve English"],
  "wordFamily": ["improvement", "improved"]
}
```

## 7. Guardrails on generated content (before cache)

Reuse the extraction-guardrail philosophy (flag/repair, hard-filter against the
taxonomy). For each generated item:

- **Sentence** must contain the target word's surface form; reject otherwise.
- **Exercise** invariant: `prompt` with the blank refilled by `answer` must equal
  `sentence.text` exactly; `answer` must equal the masked span. (Mechanical
  generation makes this hold by construction; the check catches LLM drift.)
- **Skill code** must exist in `skills` (hard-filter, exactly like the existing
  tagger in `extraction-service/app/tagging`). Unknown codes are dropped, never
  invented.
- **Pattern** `display` must reference the headword.
- Cache only items that pass; flag the rest for review (`status='generated'` vs
  `'approved'`), so a curator can promote/edit — same gate as staged questions.

## 8. Integration with mastery (the keystone)

`POST /vocab/exercises/:id/attempt { answer: string }` — the learner types the
missing word (see §12.1); the server **grades** it (never trusts a client-sent
`correct`):
1. normalize + compare `answer` to `lex_exercises.answer` (case/space-insensitive;
   accepts the registered word-family/synonym forms);
2. log the attempt in `lex_attempts` (raw history behind mastery);
3. upsert `learner_skill_mastery(user_id, skill_id)` with the existing
   recency-weighted rolling-accuracy update (ADR §B);
4. weak-skill recommendations can now pull **either** TOEIC questions
   (`question_skills`) **or** vocabulary exercises (`lex_exercises`) for the same
   weak skill — one mastery model, two practice surfaces.

## 9. Phasing

The four user-input modes from §12 are slotted across phases (not all in P1):

- **P1 — Core lexical graph + first input mode (this doc):** `lex_*` tables,
  `GET /vocab/:word` with LLM-generate-and-cache, mechanical cloze, skill
  mapping, **and §12.1 answer-the-exercise** (grading is the natural completion
  of an exercise). Delivers the required output as an interactive loop.
- **P2 — Mastery integration + decks:** attempt → `learner_skill_mastery`;
  **§12.4 word lists / decks** and suggestions; surface vocab exercises in
  weak-skill practice.
- **P3 — Contributed & analyzed input:** **§12.2 user-submitted content** with
  moderation + curator review screen; **§12.3 free-text passage** analysis →
  per-word fan-out + cloze from the user's own sentences; richer edges
  (collocation/synonym/family traversal), MCQ distractors.
- **P4 (optional):** project `lex_*` + `skills` into Neo4j for multi-hop
  recommendation/similarity (only if traversal depth justifies it — ADR §3).

## 10. Resolved decisions (defaults chosen for P1)
1. **Word scope → open vocabulary.** Any English word is accepted; the cache
   makes repeat lookups free, so we don't gate on a fixed list. (A TOEIC-list
   filter can be layered later as a `freq_rank`/allow-list.)
2. **L1 support → include Vietnamese, nullable.** `gloss_vi` is populated when
   the generator returns it (the app is already VN-facing: `explanationVi`,
   i18n) but never required — English-only content is still valid.
3. **Curation gate → auto-serve guardrail-valid content.** Items that pass §7
   are served immediately with `status='generated'`; invalid items are not
   served. The `status` column is retained so a curator can later promote to
   `'approved'` and an "approved-only" mode can be switched on. Blocking every
   word on human review is incompatible with open vocabulary.
4. **New skill codes → map onto the existing taxonomy for P1.** Use
   `L-COLLOC` / `G-WFORM` / `L-WCHOICE` (and the grammar codes) and hard-filter
   against `skills`. New lexical codes (phrasal-verb, word-family) are deferred
   to P3 to avoid taxonomy drift and keep mastery integration clean.

## 11. P1 implementation plan

**Goal of P1:** `GET /vocab/:word` returns the required Meaning / Pattern /
Sentence / Exercise, generating-and-caching on a miss, with guardrail-validated
content and skill codes mapped to the existing taxonomy.

### 11.1 Where the LLM call lives — decision
A word lookup is **synchronous** (the user waits), and skill-code validation is a
`skills` table query that already lives in the backend DB. The Python service is
a Redis *worker* with no HTTP server. Therefore P1 does generation **in the
backend (NestJS)** via a thin `LlmModule`, not by standing up a new HTTP API on
the Python worker.
- P1 ships one provider: **Ollama** (same `LLM_PROVIDER`/host env the worker
  uses), behind a small `LlmProvider` interface so Claude/OpenAI can be added
  later without touching `vocab`.
- *Rejected alternative:* enqueue a Redis "generate-vocab" job — async, wrong UX
  for an interactive lookup. *Deferred alternative:* expose a sync endpoint on
  the Python service to reuse its provider layer — revisit only if multi-provider
  parity becomes a P1 requirement.

### 11.2 Files (new unless noted)
```
backend/src/database/migrations/<ts>-LexicalGraph.ts   # all lex_* tables (§5)
backend/src/llm/llm.module.ts
backend/src/llm/llm.provider.ts                         # LlmProvider interface + generateJson()
backend/src/llm/ollama.provider.ts                      # thin HTTP client, JSON mode
backend/src/vocab/vocab.module.ts
backend/src/vocab/vocab.controller.ts                   # GET /vocab/:word  (JWT-guarded)
backend/src/vocab/vocab.service.ts                      # lookup → cache-hit traverse | miss → generate
backend/src/vocab/vocab-generator.service.ts            # prompt build + LLM call + parse
backend/src/vocab/vocab-guardrail.ts                    # §7 validation + mechanical cloze
backend/src/vocab/entities/lex-word.entity.ts           # + sense, pattern, word-pattern,
                                                         #   sentence, exercise, collocation, relation
backend/src/vocab/dto/vocab-response.dto.ts
backend/src/app.module.ts                               # (edit) register VocabModule, LlmModule
backend/package.json                                    # (edit) add a lemmatizer (e.g. wink-lemmatizer)
```

### 11.3 Build order (each step independently testable)
1. **Migration + entities** — create `lex_*` tables and TypeORM entities; verify
   `migration:run` up/down cleanly.
2. **LlmModule (Ollama)** — `generateJson(system, user)` returning parsed JSON;
   unit-test against a mocked HTTP response.
3. **Generator** — prompt that asks for `{senses[], patterns[], sentences[],
   collocations[], family[], skillCodes[]}` for a lemma+POS; parse to a typed
   intermediate. The target word span in each sentence is located in code (find
   the surface form), **not** trusted from the model.
4. **Guardrail** (`vocab-guardrail.ts`) — apply §7: sentence must contain the
   word; build the cloze **mechanically** by masking the located span; verify
   refill==original; map `skillCodes` → `skills.id` via a DB lookup, dropping
   unknown codes (mirrors `app/tagging` hard-filter). Reuse the
   flag-keep-valid policy from `extraction-guardrail.ts`.
5. **Persist + cache** — write words/senses/patterns/sentences/exercises +
   edges in one transaction; map patterns/exercises to `skill_id`.
6. **Service + controller** — `GET /vocab/:word`: normalize (lemmatize) →
   `findByLemma`; hit → assemble response from the graph; miss → generate →
   guardrail → persist → assemble. JWT-guarded like other learner routes.
7. **Response DTO** — shape per §6 ("Response shape"); confirm the worked
   example (`improve`) round-trips end to end.

### 11.4 Also in P1 — answer-the-exercise (§12.1)
Grading is the natural close of an exercise, so P1 includes it: add
`lex_attempts` (migration), `POST /vocab/exercises/:id/attempt { answer }` with
**server-side grading** (§8), and the `learner_skill_mastery` upsert (reuses the
existing `mastery` module). This is the smallest slice that makes the loop
interactive.

### 11.5 Out of P1 (tracked in §9)
Word lists / decks + suggestions (P2); user-submitted content + moderation +
curator review screen, free-text passage analysis, collocation/word-family
traversal UI, MCQ distractors (P3); Neo4j projection (P4).

### 11.6 Risks / mitigations
- **LLM returns malformed/garbled content** → guardrail drops invalid items;
  mechanical cloze guarantees exercise⇄sentence consistency (same principle as
  the extraction guardrail).
- **Lemmatization errors** (e.g. "improving" → wrong lemma) → store both the
  input surface form and resolved lemma; cache by lemma; allow a surface-form
  alias table later.
- **Cold-lookup latency** (first hit waits on the LLM) → acceptable for P1
  (cached thereafter); a background pre-warm of a TOEIC word list can be added
  in P3.
- **Cost on open vocabulary** → cache is the control; one generation per new
  (lemma) ever.

## 12. User-input modes (interactive, contributed, analyzed, personal)

The graph is not read-only. Four input modes are supported (all selected by the
product owner); they share the same nodes and the same guardrail/mastery
machinery. Every mode is **server-validated** — the client never asserts
correctness or trusted content.

### 12.1 Answer the exercise  *(P1)*
The learner types the missing word into the cloze blank.
- `POST /vocab/exercises/:id/attempt { answer }` → server grades (§8), returns
  `{ correct, correctAnswer, meaning, pattern }` for feedback, logs the attempt,
  updates mastery.
- Schema: `lex_attempts(id, user_id, exercise_id, answer, is_correct, created_at)`
  — raw history behind `learner_skill_mastery` (mirrors `attempt_answers`).
- Grading: normalize case/space; accept registered word-family/synonym forms
  (from `lex_word_relations`) as correct-with-note. **Never** accept a
  client-sent verdict.

### 12.2 Submit / edit own content  *(P3, with moderation)*
Users contribute words, senses, or example sentences.
- Schema deltas (add to `lex_words`/`lex_senses`/`lex_sentences`/`lex_exercises`):
  `created_by UUID REFERENCES users(id)`, `source VARCHAR(10) 'llm'|'human'`,
  and extend `status` to `generated|pending|approved|rejected`.
- Endpoints: `POST /vocab/:word/sentences`, `PATCH /vocab/sentences/:id`,
  `POST /vocab/sentences/:id/{approve,reject}` (curator/admin only — reuse the
  role guard pattern from `exam-files`).
- **Moderation gate** (refines §10.3): `source='llm'` → auto-serve if
  guardrail-valid; learner submissions → `status='pending'` until a curator
  approves; teacher/admin submissions → auto-`approved`. The same content
  guardrail (§7) runs on human input too (sentence must contain the word, etc.).

### 12.3 Free-text passage input  *(P3)*
User pastes a sentence/paragraph; the system turns it into learning content.
- `POST /vocab/analyze { text }` → tokenize + lemmatize → select target words
  (content words, ranked by CEFR/frequency, stopwords dropped, deduped) → for
  each, reuse `GET /vocab/:word` (cache or generate).
- Bonus: build a cloze **from the user's own sentence** by mechanically masking a
  chosen target word — their text becomes practice, exercise⇄sentence consistent
  by construction.
- Guards: max length + rate-limit (it fans out to N generations); cap N target
  words per request.

### 12.4 Pick from a list / their own deck  *(P2)*
The learner isn't limited to typing one word.
- Schema: `lex_word_lists(id, user_id, name, created_at)` and
  `lex_word_list_items(list_id, word_id, added_at, PRIMARY KEY(list_id, word_id))`
  — a personal study deck.
- Endpoints: CRUD lists, add/remove words, `GET /vocab/lists/:id` (returns the
  cards), and `GET /vocab/suggestions` (words tied to the learner's weak skills
  via `pattern.skill_id`/`exercise.skill_id` ↔ `learner_skill_mastery`, or by
  frequency). Deck practice pulls exercises for the deck's words and feeds the
  same mastery loop (§8).
