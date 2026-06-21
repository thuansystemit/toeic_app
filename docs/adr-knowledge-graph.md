# Architecture Design — Knowledge Graph & Adaptive Learning

**Status:** Draft for discussion
**Author:** generated from architecture discussion (product-owner exploring Neo4j / LangGraph)
**Related:** [feature-pdf-question-import.md](./feature-pdf-question-import.md), [sdlc/03-architecture.md](./sdlc/03-architecture.md)

## 1. Summary & goals

Add a **knowledge layer** on top of the existing TOEIC platform so the product
can do **adaptive learning**: target a learner's weakest skills, recommend the
next-best questions, surface similar/remediation questions, and report skill
coverage of a test.

The end-state substrate is a **graph** of questions ↔ skills ↔ learners. The
question on the table was "use LangGraph or Neo4j to build a graph first." This
doc separates those, recommends a **phased** approach, and is explicit that the
graph's value depends on a prerequisite that is *not* a database choice: a
**skill taxonomy + per-question skill tagging**.

### Locked context (from discussion)
- Goal is a **product capability** (adaptive learning / recommendations /
  semantic search), distinct from the import-extraction completeness work.
- Postgres (NestJS + TypeORM) is the existing transactional system of record.
- A local Ollama (llama3) is the default LLM; Claude/OpenAI are pluggable.
- A **qdrant** vector store is already running in the environment (ocr-service).

## 2. LangGraph vs Neo4j — not the same layer

| | LangGraph | Neo4j |
|---|---|---|
| What | LLM **orchestration** (stateful step-graph: branch/retry/loop) | Graph **database** (entities + relationships, multi-hop queries) |
| Solves | Reliability of a multi-step LLM pipeline | Relationship-centric reads SQL is bad at |
| Role here | *Optional* — formalizes a verify/repair extraction loop | The knowledge-graph substrate (Phase 2+) |

**Decision:** LangGraph is out of scope for this doc (it addresses extraction
flow, not the knowledge graph). Neo4j is the substrate, introduced **as a
derived projection**, not a system of record.

## 3. Why a graph — and why not *yet*

A graph DB earns its place when queries need **multi-hop traversal**:
- recommend N unseen questions on a learner's weakest skills, respecting
  `PREREQUISITE_OF` chains;
- remediation path: given a wrong answer, walk to easier questions on the same
  skill;
- similarity graphs; skill-coverage of a test.

But **~70–80% of early value needs no graph DB**: "target weak skills",
"filtered practice", "coverage report" are a `skills` table + a `question_skills`
join + a `learner_skill_mastery` table in Postgres. Neo4j is justified once the
**traversal depth** (prerequisite chains, similarity walks, multi-hop
recommendations) makes SQL genuinely painful.

> **The real first step is the skill taxonomy + auto-tagging, not the database.**
> Without `(:Question)-[:TESTS]->(:Skill)` edges, a graph is just a renamed copy
> of the Postgres tree — same data, new query language, zero new value.

## 4. Domain model

### 4.1 Nodes
- `Learner` (mirrors `users.id`)
- `Question` (mirrors `questions.id`; properties: part, difficulty, type)
- `Passage` / `Stimulus` (shared reading/audio context; Parts 3–4, 6–7)
- `Skill` (the taxonomy — see §4.3)
- `Topic` (TOEIC contexts: office, travel, finance, HR, manufacturing…)
- `Part`, `Test` (optional, for coverage queries)

### 4.2 Edges
- `(:Question)-[:TESTS]->(:Skill)` — **keystone**, one or more per question
- `(:Question)-[:BELONGS_TO]->(:Passage)`
- `(:Question)-[:ABOUT]->(:Topic)`
- `(:Question)-[:IN_PART]->(:Part)`
- `(:Skill)-[:PREREQUISITE_OF]->(:Skill)` — skill dependency DAG
- `(:Learner)-[:ANSWERED {correct, ts, attemptId}]->(:Question)` — events
- `(:Learner)-[:MASTERY {score, updatedAt}]->(:Skill)` — *derived*
- `(:Question)-[:SIMILAR_TO {score}]->(:Question)` — *derived* (shared skills + embeddings)

### 4.3 TOEIC skill taxonomy (starter)
Tool-agnostic; this is the gating content work.

**Reading**
- Part 5/6 grammar: verb tense & aspect, subject–verb agreement, prepositions,
  conjunctions/transitions, pronouns, relative clauses, comparatives, word form
  (part of speech), gerund/infinitive, conditionals.
- Part 5/6 lexical: vocabulary-in-context, collocations, word choice.
- Part 6 discourse: sentence insertion / cohesion.
- Part 7 comprehension: main idea/gist, specific detail, inference, vocabulary-
  in-context, purpose/tone, NOT/true, cross-reference (multi-passage).

**Listening** (later)
- gist, detail, inference, function/purpose, speaker role, graphic/visual.

Each `Skill` also carries a `section` (reading/listening) and feeds
`PREREQUISITE_OF` (e.g., *word form* → *sentence completion*).

## 5. Architecture: Postgres source of truth + Neo4j projection

```
                 ┌──────────────────────┐
   writes ─────▶ │ Postgres (TypeORM)   │  system of record:
                 │  tests/parts/questions│  content + attempts + tags
                 │  choices/attempts     │
                 │  + skills/question_   │
                 │    skills/mastery     │
                 └─────────┬────────────┘
                           │  change events / batch sync
                           ▼
                 ┌──────────────────────┐        ┌───────────────┐
   graph reads ◀ │ Neo4j (projection)   │  ◀────▶ │ qdrant        │
                 │  derived read-model   │ vectors │ embeddings    │
                 └──────────────────────┘        └───────────────┘
```

**Principles**
1. **Postgres stays authoritative.** The app keeps working unchanged; Neo4j is
   additive and disposable (rebuildable from Postgres at any time).
2. **No transactional dual-write.** Sync Postgres → Neo4j via either:
   - *batch* rebuild (cron / on-demand) — simplest, fine for MVP; or
   - *event-driven* (outbox table → worker upserts graph nodes/edges) — for
     near-real-time once attempt volume grows.
3. **Split responsibilities:** Neo4j = relationships/traversal; qdrant = vector
   similarity. `SIMILAR_TO` edges are materialized from qdrant kNN + shared-skill
   overlap.

## 6. The tagging problem (the actual hard part)

`(:Question)-[:TESTS]->(:Skill)` must come from somewhere. Plan:
- **LLM classifier** at extraction/import time: input a question (stem +
  choices + passage), output `{skills[], type, topic, difficulty, confidence}`
  constrained to the taxonomy via JSON schema (same provider abstraction the
  extraction service already has).
- Store tags in **Postgres** first (`question_skills`, plus `topic`,
  `difficulty`, `type` columns/table). Human-in-the-loop review can correct tags
  on the existing review screen.
- The graph projection then reads these tags — it never originates them.

This rides on the extraction pipeline already in place and is **independent of
Neo4j** — which is exactly why Phase 1 ships value without it.

## 7. Representative queries (end-state, Cypher)

Recommend next questions on weakest skills, unseen, prerequisite-respecting:
```cypher
MATCH (l:Learner {id:$learner})-[m:MASTERY]->(s:Skill)
WHERE m.score < 0.5
MATCH (q:Question)-[:TESTS]->(s)
WHERE NOT (l)-[:ANSWERED]->(q)
  AND NOT EXISTS {
    MATCH (s)<-[:PREREQUISITE_OF]-(pre:Skill)<-[:MASTERY {score:ms}]-(l)
    WHERE ms < 0.4 }            // don't serve advanced skill before its prereq
RETURN q ORDER BY m.score ASC, q.difficulty ASC LIMIT $n;
```

Remediation for a wrong answer (easier, same skill):
```cypher
MATCH (:Question {id:$q})-[:TESTS]->(s:Skill)<-[:TESTS]-(easier:Question)
WHERE easier.difficulty < $difficulty
RETURN DISTINCT easier LIMIT 5;
```

Skill coverage of a test:
```cypher
MATCH (:Test {id:$t})<-[:IN_TEST]-(:Part)<-[:IN_PART]-(q)-[:TESTS]->(s:Skill)
RETURN s.name, count(q) ORDER BY count(q) DESC;
```

## 8. Adaptive engine (Phase 3)
The graph is the substrate; the policy sits on top:
- **Mastery estimation:** start simple (rolling accuracy per skill with recency
  decay); graduate to a light IRT/BKT if warranted.
- **Recommendation policy:** weakest-skill + spaced-repetition + prerequisite
  gating (the Cypher above) + difficulty ramp.

## 9. Phased roadmap

| Phase | Deliverable | Stack | Value | Status |
|---|---|---|---|---|
| 0 | Skill taxonomy (content) | docs | gates everything | ✅ done (Reading; seeded in migration `1700000006000-Skills`) |
| 1 | LLM auto-tagging at import; `skills`/`question_skills`/`mastery` tables; weak-skill practice + coverage | **Postgres only** | most early value, no new infra | ✅ done — taxonomy + human/LLM tagging + coverage view + a Postgres force-graph view + **per-learner mastery** (`learner_skill_mastery`, recomputed on attempt submit) + **weak-skill practice** (`/practice` page, `GET /practice/skills` + `/recommendations`, deep-linking into part practice). *Listening taxonomy and a `question_meta`/difficulty sidecar remain deferred.* |
| 2 | Neo4j projection + sync; recommendation/similarity/prereq Cypher; qdrant `SIMILAR_TO` | + Neo4j, qdrant | multi-hop reads, similarity | ⬜ not started |
| 3 | Mastery model + recommendation policy | app logic on graph | true adaptivity | ⬜ not started (Phase 1 uses a simple recency-weighted rolling accuracy as the starter estimator) |

> **Note on the graph view.** A read-only **Postgres-projected** knowledge-graph
> view (`GET /tests/graph`, `react-force-graph-2d`) shipped in Phase 1 rather than
> waiting for Neo4j — it renders the `(:Question)-[:TESTS]->(:Skill)` edges that
> already live in Postgres. Neo4j remains the Phase 2 substrate for *multi-hop*
> traversal (prerequisite-respecting recommendations, similarity walks), which the
> Phase 1 single-skill weak-practice query does not need.

**Recommendation:** do **Phase 0 + 1 first** in the current stack. Introduce
Neo4j at Phase 2 only when traversal depth (prerequisite chains, similarity
walks) makes SQL painful. This avoids paying the second-datastore tax (sync,
ops, dual model) before the taxonomy/tagging has proven its signal.

**Status (current):** Phase 0 + 1 are **implemented** in the existing Postgres
stack (see the roadmap table). The remaining open items before considering Neo4j
are content/quality, not infra: a Listening taxonomy, a `question_meta`
difficulty/topic sidecar to sharpen ordering, and validating that the mastery
signal is good enough to drive recommendations. Neo4j is still deferred to
Phase 2.

## 10. Trade-offs & risks
- **Premature Neo4j** = a second datastore + sync complexity before value is
  proven. Mitigation: projection-only, batch-rebuildable, Phase 2.
- **Tag quality ceiling.** llama3 tagging may be noisy; allow human correction
  in review; consider Claude for tagging accuracy. Garbage tags ⇒ garbage graph.
- **Sync consistency.** Keep Neo4j strictly derived; never let the app read
  graph data it can't rebuild from Postgres.
- **Taxonomy churn.** The skill set will evolve; store `skillVersion` on tags so
  re-tagging is tractable.

## 11. Open questions
1. Roadmap priority: is adaptive learning a near-term product bet, or
   exploratory? (Determines whether we even reach Phase 2.)
2. Tagging model: accept llama3 noise + human review, or use Claude for tagging?
3. Manual vs auto taxonomy: hand-curate the skill list (recommended) vs let the
   LLM cluster skills?
4. Listening scope: include Parts 1–4 now or Reading-only first?

## 12. Decision
Adopt the **projection model**: Postgres = source of truth, Neo4j = derived
graph introduced at **Phase 2**. **Start with Phase 0 (taxonomy) + Phase 1
(Postgres tagging + weak-skill practice).** Revisit Neo4j once multi-hop
traversal is the bottleneck. LangGraph remains out of scope here.

---

## Appendix A — TOEIC skill taxonomy (Phase 0)

Stable `code`s so tags survive renames; `PREREQUISITE_OF` forms the skill DAG.
Reading is the MVP scope; Listening is listed for completeness (later).

### A.1 Reading — Grammar (Parts 5–6, category `grammar`)
| Code | Skill |
|---|---|
| `G-TENSE` | Verb tense & aspect |
| `G-SVA` | Subject–verb agreement |
| `G-PREP` | Prepositions |
| `G-CONJ` | Conjunctions & transitions |
| `G-PRON` | Pronouns & reference |
| `G-RELCL` | Relative clauses |
| `G-COMP` | Comparatives & superlatives |
| `G-WFORM` | Word form (part of speech) |
| `G-VERBAL` | Gerunds & infinitives |
| `G-COND` | Conditionals |
| `G-VOICE` | Active / passive voice |
| `G-DET` | Articles & determiners |
| `G-MODAL` | Modal verbs |

### A.2 Reading — Lexical (Parts 5–6, category `lexical`)
| Code | Skill |
|---|---|
| `L-VOCAB` | Vocabulary in context |
| `L-COLLOC` | Collocations |
| `L-WCHOICE` | Word choice / usage |

### A.3 Reading — Discourse (Part 6, category `discourse`)
| Code | Skill |
|---|---|
| `D-INSERT` | Sentence insertion |
| `D-COHESION` | Cohesion / transition selection |

### A.4 Reading — Comprehension (Part 7, category `comprehension`)
| Code | Skill |
|---|---|
| `R-GIST` | Main idea / gist |
| `R-DETAIL` | Specific detail |
| `R-INFER` | Inference |
| `R-VIC` | Vocabulary in context (passage) |
| `R-PURPOSE` | Purpose / tone / audience |
| `R-NOTTRUE` | NOT / true (exception) |
| `R-XREF` | Cross-reference (multi-passage) |
| `R-INTENT` | Implied meaning (chat/message intent) |

### A.5 Listening (Parts 1–4, category `listening`, later)
`LI-PHOTO` (Part 1), `LI-QR` (Part 2 question–response), `LI-GIST`,
`LI-DETAIL`, `LI-INFER`, `LI-FUNCTION` (purpose), `LI-SPEAKER` (role/setting),
`LI-GRAPHIC` (visual/graphic).

### A.6 Prerequisite DAG (starter edges)
```
G-WFORM   ─PREREQUISITE_OF→ L-WCHOICE
G-TENSE   ─PREREQUISITE_OF→ G-COND
G-SVA     ─PREREQUISITE_OF→ G-RELCL
L-VOCAB   ─PREREQUISITE_OF→ R-VIC
R-DETAIL  ─PREREQUISITE_OF→ R-INFER
R-DETAIL  ─PREREQUISITE_OF→ R-XREF
R-GIST    ─PREREQUISITE_OF→ R-PURPOSE
```

### A.7 Question metadata (orthogonal to skills)
- `difficulty`: 1–5 (1 easy … 5 hard).
- `topic`: `office`, `hr`, `finance`, `travel`, `manufacturing`, `marketing`,
  `it`, `customer-service`, `general`.
- `q_type`: convenience label (`grammar`, `vocab`, `gist`, `detail`,
  `inference`, `purpose`, `not-true`, `cross-ref`, `sentence-insert`).

## Appendix B — Phase 1 Postgres schema (no Neo4j)

DDL is illustrative (final form via a TypeORM migration). Everything here is
**source of truth**; Phase 2 projects it into Neo4j unchanged.

```sql
-- Curated taxonomy (seeded from Appendix A)
CREATE TABLE skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20)  UNIQUE NOT NULL,        -- 'G-TENSE'
  name        VARCHAR(120) NOT NULL,
  section     VARCHAR(10)  NOT NULL CHECK (section IN ('reading','listening')),
  category    VARCHAR(20)  NOT NULL,               -- grammar/lexical/discourse/comprehension/listening
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Skill prerequisite DAG (projected to (:Skill)-[:PREREQUISITE_OF]->(:Skill))
CREATE TABLE skill_prerequisites (
  skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  prerequisite_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (skill_id, prerequisite_id),
  CHECK (skill_id <> prerequisite_id)
);

-- Keystone edge: question -> skill(s)  ((:Question)-[:TESTS]->(:Skill))
CREATE TABLE question_skills (
  question_id   UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  skill_id      UUID NOT NULL REFERENCES skills(id)    ON DELETE CASCADE,
  confidence    REAL,                                  -- LLM confidence 0..1
  source        VARCHAR(10) NOT NULL DEFAULT 'llm' CHECK (source IN ('llm','human')),
  skill_version INT  NOT NULL DEFAULT 1,               -- taxonomy version, for re-tagging
  PRIMARY KEY (question_id, skill_id)
);
CREATE INDEX idx_question_skills_skill ON question_skills (skill_id);

-- Per-question metadata (sidecar keeps the hot questions table lean)
CREATE TABLE question_meta (
  question_id UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  difficulty  SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  topic       VARCHAR(40),
  q_type      VARCHAR(30),
  tagged_at   TIMESTAMPTZ,
  tag_model   VARCHAR(60)                              -- provenance: which model tagged it
);

-- Derived: learner mastery per skill (recomputed from attempts)
CREATE TABLE learner_skill_mastery (
  user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  skill_id   UUID NOT NULL REFERENCES skills(id)  ON DELETE CASCADE,
  score      REAL NOT NULL DEFAULT 0,                  -- 0..1 mastery estimate
  attempts   INT  NOT NULL DEFAULT 0,
  correct    INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);
```

### B.1 Tagging flow (Phase 1)
1. On import (or a backfill job), send each question (stem + choices + passage)
   to the LLM with a **taxonomy-constrained JSON schema**:
   ```json
   {"skills": ["G-TENSE"], "type": "grammar", "topic": "office",
    "difficulty": 2, "confidence": 0.81}
   ```
   `skills` values are restricted to Appendix A codes (enum in the schema).
2. Persist into `question_skills` (`source='llm'`) + `question_meta`.
3. Teacher can correct on the review screen → rows become `source='human'`
   (human tags win and are never overwritten by re-tagging).

### B.2 Value query — weak-skill practice (Postgres-only, no graph)
```sql
SELECT q.id, qs.skill_id, m.score
FROM learner_skill_mastery m
JOIN question_skills qs ON qs.skill_id = m.skill_id
JOIN questions q        ON q.id = qs.question_id
LEFT JOIN question_meta qm ON qm.question_id = q.id
WHERE m.user_id = $1
  AND m.score < 0.5
  AND NOT EXISTS (                                   -- unseen questions only
    SELECT 1 FROM attempt_answers aa
    JOIN attempts a ON a.id = aa.attempt_id
    WHERE a.user_id = $1 AND aa.question_id = q.id)
ORDER BY m.score ASC, qm.difficulty ASC NULLS LAST
LIMIT $2;
```
This proves the adaptive value **before** any graph DB. The single thing
Postgres can't do well — *prerequisite-respecting, multi-hop* recommendation —
is exactly the trigger to graduate to Neo4j (Phase 2, §7).

### B.3 Mastery recompute (Phase 1, simple)
Rolling accuracy with recency weighting, recomputed on attempt submit (or
nightly):
```
score(user, skill) = Σ wᵢ·correctᵢ / Σ wᵢ ,  wᵢ = decay^(age_in_days)
```
Graduate to IRT/BKT in Phase 3 only if the simple estimator under-performs.
