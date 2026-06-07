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
- **Design docs:** [`docs/sdlc/`](docs/sdlc/) · [`docs/feature-pdf-question-import.md`](docs/feature-pdf-question-import.md)
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
- Upload **audio + image + passage** stimuli (a single question can carry several — e.g. Part 1 photo + audio)
- **Publish guard** — every part must have ≥1 question; unpublish to edit

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
- Paginated user management — search, filter, change role, deactivate/reactivate (with self-protection)

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
