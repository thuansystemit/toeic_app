# Feature Design — PDF Exam File Management & LLM Question Import

**Status:** Draft for approval
**Author:** generated from BA analysis + product-owner decisions

## 1. Summary & goals

Let Admins/Teachers **upload PDF (and DOCX) files that contain TOEIC reading
material**, manage them on a dedicated **PDF Management** page, and — on
successful upload — trigger a **Python extraction microservice
(`LlmExtractionService`)** that uses LLMs to extract questions. Extracted
questions land in a **review/staging screen**; the teacher verifies/edits them
and then **imports** them into a draft test's reading parts (5–7).

### Locked decisions (from product owner)
- **Extraction:** LLM-based, from uploaded documents (not a manual template).
- **Scope:** Reading parts **5–7** only (text-based) for MVP.
- **LLM providers:** pluggable — **Claude API**, **OpenAI**, and **local Ollama (llama3)**.
- **Human-in-the-loop:** mandatory **review before import** (never direct-to-DB).
- **New:** a **PDF file management page** (list / status / manage uploaded files).
- **New:** extraction is a **separate Python service** (not in the NestJS app).
- **New:** the Python service must be **enterprise-grade, scalable, and extensible**
  (easy to add new functions/requirements later) — modelled on the existing
  `cv-batch-extractor` pipeline.

### Non-goals (deferred)
- Listening parts (1–4) — need audio a document can't carry.
- OCR for scanned/image PDFs.
- A reusable question-bank across tests.
- A message broker (Kafka/RabbitMQ) — designed-for but not built in MVP.

---

## 2. High-level architecture (polyglot, 3 services)

```
┌─────────────┐     ┌──────────────────────────┐     ┌────────────────────────────┐
│  React SPA  │ ──► │  NestJS API (TypeScript)  │ ──► │  Python LlmExtractionService│
│ (frontend)  │ ◄── │  - PDF file mgmt (CRUD)   │ ◄── │  - guardrails + extraction  │
│  - Mgmt page│     │  - trigger extraction     │     │  - multi-LLM (Claude/OpenAI │
│  - Review UI│     │  - staging + import to DB │     │    /Ollama)                 │
└─────────────┘     └───────────┬──────────────┘     └──────────────┬─────────────┘
                                │                                    │
                          ┌─────▼─────┐                       ┌──────▼──────┐
                          │ PostgreSQL│                       │  LLM(s):    │
                          │  + files  │                       │ Anthropic / │
                          └───────────┘                       │ OpenAI /    │
                                                              │ Ollama(local)│
                                                              └─────────────┘
```

**Why a separate Python service:** Python has the strongest document/LLM
ecosystem (pypdf/pdfplumber, unstructured, langchain, provider SDKs, Ollama
client). The team already has a proven Python extraction pipeline
(`cv-batch-extractor`). Keeping extraction out of NestJS means it scales
independently, can be deployed/replicated separately, and new extraction
capabilities are added without touching the web app.

### Service responsibilities
| Service | Owns |
|---------|------|
| **React** | PDF management page, upload UX, extraction status, review/edit/import UI |
| **NestJS** | PDF file CRUD + storage, extraction-job orchestration, callback receiver, staging, **atomic import into `questions`/`choices`/`stimuli`**, RBAC, the system of record |
| **Python `LlmExtractionService`** | Text extraction, input guardrails, LLM provider strategy, prompt + JSON schema enforcement, returns structured questions. **Stateless** w.r.t. the app DB. |

---

## 3. Integration pattern (NestJS ↔ Python)

**Recommendation: asynchronous, job-based with callback** (enterprise-ready,
non-blocking for large PDFs), designed so a real queue can slot in later.

```
1. Teacher uploads PDF      → NestJS stores file (FilesModule), creates
                              exam_file (status=uploaded) + extraction_job (queued)
2. NestJS triggers Python   → POST {PY}/extract  { jobId, fileUrl, provider, options }
3. Python pulls the file    → GET {NEST}/internal/files/:key  (or shared volume)
4. Python runs pipeline     → guardrails → text → LLM extract → validate JSON
5. Python calls back        → POST {NEST}/internal/extraction-callback
                              { jobId, status, questions[], warnings[], usage }
   (auth via a shared internal token; NestJS also exposes GET job status for polling)
6. NestJS stores staged questions, sets exam_file.status=extracted
7. Frontend polls job/file status → opens Review screen when ready
8. Teacher reviews/edits/deletes → POST /tests/:id/import/commit
9. NestJS atomically inserts approved questions into the target part
```

- **MVP simplicity:** Python `/extract` may process synchronously inside the
  request for small files, but the **callback contract** is what we build against,
  so moving to a worker/queue is a drop-in change.
- **File access:** Python fetches the file via an **internal download URL** from
  NestJS (decouples storage; works with local disk or S3). A shared Docker volume
  is an acceptable MVP alternative.
- **Security:** the `/internal/*` endpoints require a shared `INTERNAL_API_TOKEN`;
  not exposed publicly.

---

## 4. PDF Exam File Management (NestJS + React)

### 4.1 Data model (new tables)
```
exam_files
  id              uuid pk
  original_filename varchar
  storage_key     varchar          -- via FilesModule storage adapter
  mime_type       varchar          -- application/pdf, .docx
  size_bytes      bigint
  status          varchar          -- uploaded | queued | extracting | extracted | failed
  uploaded_by     uuid → users
  test_id         uuid → tests     -- nullable; target test (chosen at import)
  question_count  int default 0    -- # extracted (after run)
  error           text             -- failure reason
  created_at / updated_at

extraction_jobs
  id              uuid pk
  exam_file_id    uuid → exam_files
  provider        varchar          -- claude | openai | ollama
  model           varchar
  status          varchar          -- queued | running | succeeded | failed
  warnings        jsonb            -- e.g. "answer key not found", low-confidence
  usage           jsonb            -- tokens / cost / duration
  staged_questions jsonb           -- ExtractedQuestion[] awaiting review
  created_at / updated_at
```
Staged questions live in `extraction_jobs.staged_questions` (JSONB) until the
teacher commits — only then are real `questions`/`choices`/`stimuli` rows created.
(No premature writes to the authoring tables.)

### 4.2 Endpoints (NestJS)
| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/exam-files` | teacher/admin | Upload a PDF/DOCX → store + create job + trigger Python |
| GET | `/exam-files` | teacher/admin | List (paginated): filename, status, count, date |
| GET | `/exam-files/:id` | teacher/admin | Detail + job status |
| DELETE | `/exam-files/:id` | teacher/admin | Remove file + staged data |
| GET | `/exam-files/:id/review` | teacher/admin | Staged questions for the review screen |
| POST | `/exam-files/:id/import` | teacher/admin | Commit approved questions → target test+part (atomic) |
| GET | `/internal/files/:key` | internal token | Python downloads the source file |
| POST | `/internal/extraction-callback` | internal token | Python returns extraction results |

### 4.3 New page: **PDF Management** (React)
- Nav entry (Teacher/Admin): **Exam Files**
- Table: filename · status badge (Uploaded → Extracting → Ready → Failed) · #questions · uploaded-by · date · actions (Review / Delete)
- **Upload** button → drag-drop PDF/DOCX → progress → row appears as "Extracting…"
- Status auto-refreshes (poll) until "Ready to review"
- **Review** action → opens the staging screen (edit/delete/confirm) → choose target **test + reading part** → Import
- Bilingual EN/VI, Tailwind, Font Awesome (consistent with the app)

---

## 5. The Python `LlmExtractionService` (enterprise design)

Modelled on `cv-batch-extractor` so it scales and is easy to extend. A FastAPI
app exposing `/extract` (+ `/health`), with a clean internal pipeline.

```
extraction-service/
├── app/
│   ├── main.py                  FastAPI app, /extract, /health
│   ├── config.py                settings (providers, tokens, limits) via env
│   ├── domain/
│   │   └── toeic_schema.py       ExtractedQuestion, Choice, Passage (pydantic)
│   ├── guardrails/              INPUT validation pipeline (composable, like cv-batch)
│   │   ├── base.py
│   │   └── input/
│   │       ├── mime_type.py      pdf/docx only
│   │       ├── file_size.py      ≤ limit
│   │       ├── text_quality.py   reject empty/garbled/low-text (scanned) docs
│   │       ├── text_length.py    chunking thresholds
│   │       └── injection.py      strip prompt-injection from document text
│   ├── extraction/
│   │   ├── text_extractor.py     PDF (pdfplumber/pypdf) + DOCX (python-docx)
│   │   └── chunker.py            split by Part / token budget
│   ├── llm/
│   │   ├── provider.py           LlmProvider Protocol (strategy interface)
│   │   ├── claude_provider.py    Anthropic API
│   │   ├── openai_provider.py    OpenAI API
│   │   ├── ollama_provider.py    local llama3 (HTTP)
│   │   └── factory.py            select provider by config/request
│   ├── prompts/
│   │   └── toeic_extract.txt      provider-neutral extraction prompt
│   ├── pipeline.py               orchestrates guardrails→extract→LLM→validate
│   ├── backend_client.py         callback to NestJS (results / errors)
│   ├── worker.py                 (phase 2) async job consumer
│   └── dead_letter.py            (phase 2) failed-job capture/retry
├── requirements.txt
├── Dockerfile
└── docs/ (ARCHITECTURE, DOMAIN_MODEL, GUARDRAILS_SPEC)   ← mirrors cv-batch
```

### 5.1 Multi-LLM provider strategy (the key extensibility point)
```python
class LlmProvider(Protocol):
    name: str
    def extract(self, text: str, schema: dict) -> list[ExtractedQuestion]: ...
```
- `ClaudeProvider`, `OpenAiProvider`, `OllamaProvider` implement it.
- `factory.get_provider(name, model)` selects per request/config.
- **One shared prompt** instructs: *extract only (never invent), return strict JSON
  matching the schema, detect the correct answer (look for a separate answer key),
  group Part 6/7 questions under their passage, mark uncertainty.*
- Provider differences (auth, request shape, JSON-mode) are isolated in adapters.
- **Adding a provider later = one new adapter file** — no pipeline change.

### 5.2 Extracted-question schema (provider-neutral contract)
```jsonc
{
  "part": 5,                         // 5 | 6 | 7
  "groupId": "p7-passage-1",         // questions sharing a passage
  "passageText": "…",                // for Parts 6/7
  "questionText": "…",
  "choices": [
    { "label": "A", "text": "…", "isCorrect": false },
    { "label": "B", "text": "…", "isCorrect": true  },
    { "label": "C", "text": "…", "isCorrect": false },
    { "label": "D", "text": "…", "isCorrect": false }
  ],
  "explanationVi": null,
  "confidence": 0.0-1.0,             // surfaced as a review warning
  "issues": ["answer_key_not_found"] // flags for the review screen
}
```
This is exactly what NestJS stages and the review screen renders.

### 5.3 Enterprise qualities (why this scales / extends)
- **Composable guardrails** — add a new validation = add a class, register it.
- **Provider strategy** — add an LLM = add an adapter.
- **Pipeline stages** — text→chunk→extract→validate are independent, swappable.
- **Stateless service** — horizontally scalable; the app DB stays in NestJS.
- **Observability** — per-job usage/cost/duration + warnings returned in the callback.
- **Async-ready** — `/extract` today; `worker.py` + queue tomorrow with no API change.
- **Dead-letter** — failed extractions captured for retry/inspection (phase 2).

---

## 6. Review & import flow (NestJS + React)
1. File status becomes **Ready** → teacher opens **Review**.
2. Review table shows each extracted question grouped by Part: text, 4 choices,
   marked correct, passage (6/7), explanation, **confidence/issue badges**.
3. Teacher edits inline / deletes bad rows / fixes correct answers.
4. Teacher picks **target test (draft) + reading part** (or one per group).
5. **Import** → NestJS validates (4 choices, exactly 1 correct — reuses existing
   authoring rules) and inserts all approved questions in **one transaction**;
   Part 6/7 groups create a shared passage stimulus per question.
6. Questions appear in the Test Editor; `exam_file` marked imported.

---

## 7. Deployment
- Add the Python service to `docker-compose.yml` (`extraction-service`, FastAPI,
  port 8000) alongside `postgres`. NestJS gets `EXTRACTION_SERVICE_URL`.
- Ollama (optional, local) runs as its own container/host process; the Ollama
  provider points at `OLLAMA_BASE_URL` (e.g. `http://host.docker.internal:11434`).
- Secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` in the Python service env;
  `INTERNAL_API_TOKEN` shared between NestJS and Python.

---

## 8. Phasing
**Phase 1 — foundation (sync path)**
- `exam_files` + `extraction_jobs` tables, NestJS CRUD + management page + upload
- Python FastAPI `/extract` with guardrails + text extraction + **one** provider
  (Ollama or Claude) + schema validation + callback
- Review screen + atomic import (Parts 5–7)

**Phase 2 — multi-provider + scale**
- Add the remaining LLM adapters (Claude/OpenAI/Ollama all selectable)
- Async worker + queue, dead-letter, import history/audit, confidence tuning

**Phase 3 — reach**
- Listening text import (audio attached after), OCR for scanned PDFs, dedup,
  question-bank.

---

## 8b. Resolved decisions (product owner)
- **Repo layout:** Python service as a folder in this monorepo → `extraction-service/`.
- **First provider:** local **Ollama (llama3)** — no API cost, offline.
- **File access:** internal token-protected **download URL** from NestJS.
- **Integration:** **async worker + queue from day one** → **Redis** broker; NestJS
  enqueues a job, a Python **worker** consumes it, runs the pipeline, and calls back.

### Resulting runtime topology
```
React → NestJS ──(LPUSH job)──► Redis ──(BRPOP)──► Python worker
                ◄──(HTTP callback /internal/extraction-callback)──┘
                                Python worker ──(GET /internal/files/:key)──► NestJS
                                Python worker ──► Ollama (llama3)
```
docker-compose services: `postgres`, `redis`, `extraction-worker` (Python).
Ollama runs on the host/its own container (`OLLAMA_BASE_URL`).

## 9. Open questions
1. **Integration mode for MVP:** sync `/extract` (simplest) vs. async worker+callback
   from day one? (Recommendation: build the callback contract; sync internally first.)
2. **File access:** internal download URL (recommended) vs. shared Docker volume?
3. **First provider to wire:** local **Ollama/llama3** (no API cost, offline) or
   **Claude** (best accuracy) for the initial working path?
4. **Repo layout:** Python service as a **folder in this monorepo**
   (`extraction-service/`) or a separate repository?
5. **Default provider/model** + who holds the API keys (per-env)?
6. **Answer-key handling** when the document lacks one: import without correct
   answers and force the teacher to set them in review, or reject?
