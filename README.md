# TOEIC Learning Platform

A full-stack platform for learning TOEIC. Teachers and admins author tests
(7 parts, audio/image/passage stimuli); learners register, take **full timed
exams** with strict exam fidelity or **practice by part** with instant feedback,
then review their results with Vietnamese explanations and scaled scores.

It also offers **AI-assisted question import**: upload a reading PDF/DOCX and a
separate **Python extraction microservice** uses an LLM (Ollama / Claude / OpenAI)
to extract questions for human review before import.

- **Backend:** NestJS (TypeScript) · PostgreSQL via TypeORM · JWT auth (HS256, refresh in HttpOnly cookie)
- **Frontend:** React (TypeScript) · Vite · Tailwind CSS · Zustand + TanStack Query · react-i18next (EN/VI) · Font Awesome
- **Extraction service:** Python worker · Redis queue · pluggable LLM providers (Ollama / Claude / OpenAI)
- **Design docs:** [`docs/sdlc/`](docs/sdlc/) · [`docs/feature-pdf-question-import.md`](docs/feature-pdf-question-import.md) · [`docs/adr-knowledge-graph.md`](docs/adr-knowledge-graph.md)
- **Setup guides:** [`docs/social-login-setup.md`](docs/social-login-setup.md) · extraction standard [`docs/enterprise_document_extraction_standard.md`](docs/enterprise_document_extraction_standard.md) ([conformance](extraction-service/docs/EDIES_CONFORMANCE.md))

---

## Features

### Accounts & auth
- Open self-registration, email/password login, JWT access + refresh (HttpOnly cookie)
- **Social login** — Sign in with **Google** & **Facebook** (token verified server-side, account-linked by email)
- **Forgot / reset password** via email (30-min single-use link)
- **My Profile** — edit display name & UI language, self-service password change
- Role-based access control: **Admin**, **Teacher**, **Learner**

### Authoring (Teacher / Admin)
- Create a test → **7 TOEIC parts auto-scaffolded** (Listening 1–4, Reading 5–7)
- Add / **edit** / **delete** questions (4 choices, exactly-one-correct validation)
- Per-question **Vietnamese explanation**
- **Skill tagging** — tag questions against the TOEIC skill taxonomy (+ coverage view)
- Upload **audio + image + passage** stimuli (a single question can carry several — e.g. Part 1 photo + audio)
- **Per-part publishing** — publish/unpublish each part independently (guard: ≥1 question, every question answered); a part is practiceable only when its test **and** the part are published
- **Delete a test** from the author library

### Taking tests (Learner)
- **Full timed test** — server-authoritative countdown, auto-submit on expiry, **audio plays once** (no replay), unanswered-count warning before submit
- **Practice by part** — no timer, replayable audio, **instant per-question feedback** with explanation
- **Sidebar question navigator** with answered/unanswered tracking
- **Scaled scoring** — raw → scaled (Listening/Reading/Total) via a swappable conversion strategy
- **Review** — per-question correctness, correct answer, explanation, "wrong only" filter

### Question import (Teacher / Admin)
- Upload a **reading PDF/DOCX** on the **Import** page → a Python worker extracts questions asynchronously
- **Pluggable LLM** providers — local **Ollama (llama3)**, **Claude API**, or **OpenAI** (select per env)
- **Mandatory review** — edit extracted questions, set the correct answer, then bulk-import into a draft test's reading parts (atomic)
- Live status (Queued → Extracting → Ready), warnings (e.g. missing answer key), and **traceability** (source page, file hash, model, prompt/schema version) per the [EDIES standard](docs/enterprise_document_extraction_standard.md)

### Admin
- Paginated user management — search, filter, change role, deactivate/reactivate, and **hard-delete** users (full purge; self- and last-admin-protected)

### Cross-cutting
- Bilingual **English / Vietnamese** UI throughout
- Local file storage (S3-swappable adapter), provider-agnostic email (SMTP)

---

## Tech stack

| Layer | Stack |
|-------|-------|
| Backend | NestJS 10, TypeScript, TypeORM, PostgreSQL 16, Passport JWT, bcrypt |
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router, Zustand, TanStack Query, react-i18next |
| Auth | JWT HS256 (access) + opaque refresh token (HttpOnly cookie); Google (`google-auth-library`) & Facebook OAuth |
| Email | Nodemailer (any SMTP: SES / SendGrid / Resend / Gmail / Mailgun) |
| Extraction | Python 3.12 worker, Redis queue, pdfplumber / python-docx, pluggable LLM (Ollama / `anthropic` / `openai`), pydantic schema validation |
| Infra | npm workspaces monorepo, Docker Compose (PostgreSQL + Redis + extraction worker) |

---

## Prerequisites

- **Node.js** ≥ 20
- **Docker** (for PostgreSQL + Redis)
- *(optional, for live question import)* **Python 3.12** + an LLM — local [**Ollama**](https://ollama.com) with `llama3`, or a Claude/OpenAI API key

---

## Services at a glance

```
React SPA ──► NestJS API (system of record) ──► PostgreSQL
                  │  ▲                            Redis (extraction queue)
       enqueue job│  │ callback (results)          ▲   │
                  ▼  │                             │   ▼
              Python extraction worker ───────────┘  Ollama / Claude / OpenAI
              (guardrails → text → chunk → LLM → validate)
```
The NestJS app is the system of record; the **Python worker is stateless** and
extraction-only. See [`docs/feature-pdf-question-import.md`](docs/feature-pdf-question-import.md).

---

## High-level workflow

From an uploaded PDF to a published, practiceable test — and, ahead, a skill graph:

```
┌── A. UPLOAD ──────────────────────────────────────────────┐
 Teacher uploads PDF/DOCX  →  POST /exam-files
   • file saved to disk, exam_file row (status: uploaded→queued)
   • extraction_job created, job pushed to Redis queue
└───────────────────────────────────────────────────────────┘
                         │ (Redis queue)
                         ▼
┌── B. EXTRACTION WORKER (Python, async) ───────────────────┐
 1. VALIDATING      – mime / size / encryption / page count
 2. EXTRACTING_TEXT – pdfplumber text layer
                      ↳ OCR fallback (PyMuPDF + Tesseract) for
                        scanned pages with no text
 3. guardrails      – min length / quality / strip injection
 4. CHUNKING        – line-aware, passage-preserving, overlap
 5. EXTRACTING ⇐ LLM (Ollama / Claude / OpenAI)
                      per chunk → JSON questions → validate → dedup
 6. VALIDATING_OUTPUT – quality gate
 7. callback → staged_questions saved on job; status: extracted
└───────────────────────────────────────────────────────────┘
                         │
                         ▼
┌── C. REVIEW & IMPORT (human-in-the-loop) ─────────────────┐
 Teacher opens review screen → GET /exam-files/:id/review
   • edit text, fix choices, SET correct answers
   • POST /exam-files/:id/import → questions into a DRAFT test
     (answer-less allowed; answers can be filled later)
└───────────────────────────────────────────────────────────┘
                         │
                         ▼
┌── D. AUTHORING & PUBLISH ─────────────────────────────────┐
 • tag questions with skills (manual now)
 • publish per part (guard: every Q has 1 correct answer)
 • publish test → appears in learner library
└───────────────────────────────────────────────────────────┘
                         │
            ┌────────────┴─────────────┐
            ▼                           ▼
┌── E. LEARNER ──────────┐   ┌── F. KNOWLEDGE GRAPH (future) ─┐
 practice / full attempt      • LLM auto-tag skills (not built)
 → answers → scoring          • graph view (built, Postgres)
 → results                    • adaptive recommendations (later)
└────────────────────────┘   └────────────────────────────────┘
```

The **LLM** in step B (and the future auto-tagging in F) is pluggable per env
(`LLM_PROVIDER`); on a small GPU (e.g. 4 GB) prefer a model that fits in VRAM.
Knowledge-graph design: [`docs/adr-knowledge-graph.md`](docs/adr-knowledge-graph.md).

---

## Getting started

```bash
# 1. Install all workspace deps (monorepo: backend + frontend)
npm install

# 2. Start PostgreSQL + Redis (Docker)
npm run db:up

# 3. Configure backend env
cp backend/.env.example backend/.env

# 4. Run database migrations
npm run migration:run

# 5. Seed a default admin (admin@toeic.local / Admin12345)
npm run seed:admin

# 6. Start the backend  →  http://localhost:3000/api
npm run backend:dev

# 7. In another terminal, start the frontend  →  http://localhost:5173
npm run frontend:dev
```

Open **http://localhost:5173**:
- Log in as **admin@toeic.local / Admin12345** → **Authoring** → create & publish a test
- Register a **learner** → **Tests** → take it → review your score

> Registration always creates **learner** accounts. Teachers/admins are created by
> seeding (`npm run seed:admin`) or promoted via the admin **Users** page.

### Optional — enable live question import

The **Import** page works end-to-end once the extraction worker + an LLM are running:

```bash
# Local LLM (no API key, runs offline)
ollama pull llama3 && ollama serve

# Build & start the Python worker (consumes the Redis queue)
docker compose --profile extraction up -d --build extraction-worker
```

Without the worker, uploaded files stay at "Queued/Extracting" (nothing consumes
the job). To use Claude/OpenAI instead of Ollama, set `LLM_PROVIDER` +
`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` on the worker (see `docker-compose.yml`).

---

## Root npm scripts

| Script | Description |
|--------|-------------|
| `npm run db:up` / `db:down` | Start / stop the PostgreSQL + Redis containers |
| `npm run migration:run` | Apply database migrations |
| `npm run seed:admin` | Create/repair the default admin account |
| `npm run backend:dev` | Start the API in watch mode |
| `npm run frontend:dev` | Start the Vite dev server |

Per-workspace scripts live in `backend/package.json` and `frontend/package.json`
(`build`, `start:prod`, `migration:generate`, etc.).

---

## Configuration

All backend config is via `backend/.env` (template: `backend/.env.example`).

| Area | Keys | Notes |
|------|------|-------|
| Server | `PORT`, `NODE_ENV`, `CORS_ORIGIN` | |
| Database | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | matches `docker-compose.yml` |
| JWT | `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_TTL_DAYS` | change secrets in prod |
| Files | `UPLOADS_DIR` | local disk; S3-swappable adapter |
| Admin seed | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` | |
| Google login | `GOOGLE_CLIENT_ID` (+ `VITE_GOOGLE_CLIENT_ID` in `frontend/.env`) | see social-login doc |
| Facebook login | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` (+ `VITE_FACEBOOK_APP_ID`) | see social-login doc |
| Email | `APP_BASE_URL`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | blank SMTP_HOST → reset links logged to console (dev) |
| Import queue | `REDIS_URL`, `EXTRACTION_QUEUE`, `INTERNAL_API_TOKEN` | `INTERNAL_API_TOKEN` is the shared secret between NestJS and the Python worker |

The **Python worker** is configured separately (env in `docker-compose.yml` /
`extraction-service/.env`): `LLM_PROVIDER` (`ollama`/`claude`/`openai`),
`OLLAMA_BASE_URL` + `OLLAMA_MODEL`, `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL`,
`OPENAI_API_KEY` + `OPENAI_MODEL`, `BACKEND_BASE_URL`, `INTERNAL_API_TOKEN`.

Social login is **disabled** unless its keys are set (the buttons show a
"not configured" state). Email falls back to **console logging** when SMTP is unset.
See [`docs/social-login-setup.md`](docs/social-login-setup.md) for step-by-step
Google & Facebook setup.

---

## Project layout

```
toeic_app/
├── backend/                 NestJS API
│   ├── src/
│   │   ├── auth/            register/login/refresh, social login, password reset
│   │   ├── users/          user entity & service
│   │   ├── profile/        self-service profile + password change
│   │   ├── admin/          user management (paginated, RBAC)
│   │   ├── tests/          test/part/question/choice/stimulus authoring
│   │   ├── attempts/       attempt lifecycle, answers, audio play-once, expiry
│   │   ├── scoring/        raw → scaled conversion (swappable strategy)
│   │   ├── files/          upload + serving (local-disk storage adapter)
│   │   ├── email/          provider-agnostic SMTP sender
│   │   ├── exam-files/     PDF/DOCX upload, extraction jobs, review + import
│   │   ├── queue/          Redis enqueue (ioredis)
│   │   └── database/       migrations, data-source, admin seed
│   └── .env.example
├── frontend/                React SPA
│   └── src/
│       ├── routes/         pages (auth, tests, exam, review, authoring, admin, profile, exam-files)
│       ├── components/     layout, AudioPlayer, StimulusDisplay, Icon, SocialAuth…
│       ├── api/            typed API clients (axios)
│       ├── store/          Zustand auth store
│       └── i18n/           EN/VI translations
├── extraction-service/      Python question-extraction worker
│   ├── app/
│   │   ├── worker.py        Redis consumer + callback to NestJS
│   │   ├── pipeline.py      validate → text → chunk → LLM → validate output
│   │   ├── guardrails/      input + content guardrails (EDIES §5, §13)
│   │   ├── extraction/      text extractor (pdfplumber/docx) + chunker
│   │   ├── llm/             provider strategy (ollama / claude / openai + factory)
│   │   ├── domain/          TOEIC schema + traceable ExtractionEnvelope
│   │   ├── observability.py structured audit logs + metrics
│   │   ├── errors.py        classified error taxonomy
│   │   └── version.py       schema / prompt versioning
│   ├── docs/EDIES_CONFORMANCE.md
│   └── Dockerfile
├── docs/
│   ├── sdlc/                       product spec, requirements, architecture, estimates
│   ├── feature-pdf-question-import.md
│   ├── enterprise_document_extraction_standard.md  (EDIES)
│   └── social-login-setup.md
└── docker-compose.yml       PostgreSQL 16 + Redis 7 + extraction worker
```

---

## Architecture highlights

- **Modular monolith** (NestJS) as the system of record + a **stateless Python worker** for extraction (polyglot, queue-decoupled)
- **Async import pipeline** — NestJS enqueues to **Redis** → worker runs guardrails → text → chunk → LLM → schema-validate → **callback**; results are staged for **human review** before any DB write
- **Pluggable LLM** — `LlmProvider` strategy (Ollama / Claude / OpenAI); add a provider = one adapter file. Follows the [EDIES standard](docs/enterprise_document_extraction_standard.md) (traceability, versioning, classified errors, audit logs)
- **Attempt expiry** — hybrid: lazy evaluation on access + a 60s cron sweep backstop
- **Audio play-once** — `attempt_audio_plays` join table enforces single play server-side; the player auto-plays once (on view) with no replay in full-test mode
- **Scaled scoring** — uses an admin-seedable conversion table, falling back to a linear approximation when none is loaded
- **Storage adapter** — local disk now; S3 can drop in without touching callers
- **Anti-enumeration** — login and forgot-password never reveal whether an email exists

---

## Default credentials (dev)

| Account | Email | Password |
|---------|-------|----------|
| Admin | `admin@toeic.local` | `Admin12345` |

> Change these before any non-local deployment.

---

## Changing the extraction model (Ollama) — and applying config changes

The extraction worker's LLM is configured in **`docker-compose.yml`** under the
`extraction-worker` service:

```yaml
LLM_PROVIDER: ollama
OLLAMA_BASE_URL: http://<ollama-host>:11434   # the machine running Ollama
OLLAMA_MODEL: qwen2.5:3b                       # must be pulled on that host
```

### Steps to switch the model

1. **Pull the model on the Ollama host first** (otherwise `/api/chat` returns
   **404 "model not found"** and every job fails):
   ```bash
   # on the Ollama machine
   ollama pull qwen2.5:3b
   # …or remotely via the API
   curl -X POST http://<ollama-host>:11434/api/pull -d '{"name":"qwen2.5:3b"}'
   # verify it's installed
   curl http://<ollama-host>:11434/api/tags
   ```
2. **Edit** `OLLAMA_MODEL` (and `OLLAMA_BASE_URL` if the host changed) in
   `docker-compose.yml`.
3. **Recreate the worker so it picks up the new config:**
   ```bash
   docker compose --profile extraction up -d extraction-worker
   ```

> ⚠️ **`docker compose restart` does NOT apply compose changes** — it reuses the
> old container's environment. You must `up -d` (which **recreates** the
> container) or add `--force-recreate`. Add `--build` as well if you changed the
> worker's code or `Dockerfile`:
> ```bash
> docker compose --profile extraction up -d --build extraction-worker
> ```

4. **Verify** it took effect:
   ```bash
   docker exec toeic_extraction_worker printenv OLLAMA_MODEL   # new value
   docker logs --tail 5 toeic_extraction_worker                # WORKER_UP, provider ollama
   ```

### Pick a model that fits the GPU
| GPU VRAM | Recommended | Notes |
|---|---|---|
| 4 GB (e.g. GTX 1650) | `qwen2.5:3b` (~2 GB) | fully on GPU; fast |
| 8 GB | `qwen2.5:7b` (~4.7 GB) | fits with headroom |
| 12 GB+ | `qwen2.5:14b` (~9 GB) | best accuracy |

A model larger than VRAM runs **CPU-only** (very slow) or **OOMs and crashes
Ollama** — `qwen2.5:14b` on a 4 GB card will not work.

### Same pattern for any compose config change
Changing env/ports for **any** service applies the same way — `docker compose up -d <service>`
recreates it with the new config (use `--build` if code/Dockerfile changed).
`restart` alone only reboots the existing container and won't pick up
`docker-compose.yml` edits.

## Using a hosted LLM (Claude / OpenAI) instead of Ollama

The extraction worker can run against a hosted provider for higher accuracy
(recommended for Part 6/7 passages). It picks the provider from `LLM_PROVIDER`
and reads the matching API key from the environment:

| `LLM_PROVIDER` | Required key | Model env (optional) |
|---|---|---|
| `ollama` (default) | — | `OLLAMA_MODEL` |
| `claude` | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` (default `claude-opus-4-8`) |
| `openai` | `OPENAI_API_KEY` | `OPENAI_MODEL` (default `gpt-4o`) |

Keys are wired through `docker-compose.yml` via variable substitution, so put
them in a **`.env` file at the repo root** — it is gitignored and never
committed (`.env.example` is the committed template).

### Set up the Claude API key

1. **Get a key** at <https://console.anthropic.com/settings/keys>.
2. **Create `.env`** at the repo root (copy the template):
   ```bash
   cp .env.example .env
   ```
3. **Fill in** `.env`:
   ```ini
   LLM_PROVIDER=claude
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_MODEL=claude-opus-4-8
   ```
4. **No restart needed** — the worker mounts `.env` and re-reads it on every job,
   so the next extraction uses the new provider. See the section below.
5. **Verify** the next job picks it up:
   ```bash
   docker logs -f toeic_extraction_worker   # EXTRACTION_STARTED … "provider": "claude"
   ```

> The key is read in `extraction-service/app/config.py` (`ANTHROPIC_API_KEY`) and
> used by `app/llm/factory.py` only when `LLM_PROVIDER=claude`; if the provider is
> `claude` but the key is missing, the worker raises a clear error at startup.

## Switching LLMs live via `.env` (no rebuild, no restart)

The extraction worker treats the repo-root **`.env`** as the single, live source
of truth for which LLM to use. `docker-compose.yml` mounts it read-only into the
container (`./.env:/app/.env:ro`), and the worker **re-reads it on every job**
(`get_settings()` in `extraction-service/app/config.py`). Editing `.env` takes
effect on the **next extraction** — no code change, no image rebuild, no
container restart.

### Switch the provider

Edit `.env` at the repo root:

```ini
# ollama (local) | claude | openai
LLM_PROVIDER=claude

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-8

# used when LLM_PROVIDER=ollama (reach a host-run Ollama from Docker):
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen2.5:3b
```

Save the file, then just run the next extraction. To confirm a live value without
waiting for a job:

```bash
docker exec toeic_extraction_worker \
  python -c "from app.config import get_settings; print(get_settings().provider)"
```

### How it works

- **Worker** picks the provider per job from `get_settings().provider` (the live
  `.env`); the provider stamped on the job by the backend is ignored for
  selection, so `.env` is the only switch.
- **`get_provider()`** (`app/llm/factory.py`) reads the live model + API key too,
  so changing `ANTHROPIC_MODEL` / `OLLAMA_MODEL` is also instant.
- The stored result records the **actual** model used.

### Caveats

- **Ollama** must be reachable at `OLLAMA_BASE_URL` with the model pulled — that's
  the only non-live prerequisite, but it's still configured entirely in `.env`.
- The **backend** records a provider on the job from its own boot-time env (purely
  cosmetic — the worker ignores it). Changing the backend's default still needs a
  recreate (`docker compose up -d backend`).
- `.env` is gitignored; keep real keys there. `.env.example` is the committed
  template and must hold placeholders only.
