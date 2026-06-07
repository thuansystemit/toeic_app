# Architecture -- TOEIC Learning Platform
**Date:** 2026-06-07  **Author:** @architect  **Status:** DECIDED
**Sources:** `docs/sdlc/01-product-spec.md`, `docs/sdlc/02-requirements.md`

---

## Table of Contents

1. [Requirement & Context Summary](#1-requirement--context-summary)
2. [High-Level Architecture](#2-high-level-architecture)
3. [NestJS Module Breakdown](#3-nestjs-module-breakdown)
4. [Data Model -- PostgreSQL Schema](#4-data-model----postgresql-schema)
5. [API Surface](#5-api-surface)
6. [Auth & RBAC Design](#6-auth--rbac-design)
7. [Scoring Subsystem](#7-scoring-subsystem)
8. [File & Audio Subsystem](#8-file--audio-subsystem)
9. [Timer & Attempt Lifecycle (I-005 Resolution)](#9-timer--attempt-lifecycle-i-005-resolution)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Cross-Cutting NFRs](#11-cross-cutting-nfrs)
12. [Architectural Decision Records](#12-architectural-decision-records)
13. [Risks & Mitigations](#13-risks--mitigations)

---

## 1. Requirement & Context Summary

### Functional Requirements Coverage

51 MUST requirements (REQ-001 through REQ-086) spanning 8 user stories:
- **US-001** Auth (9 REQs): self-registration, JWT login, password reset, email normalization
- **US-002** Test Authoring (11 REQs): CRUD tests/parts/questions/stimuli, file upload, publish workflow
- **US-003** Full Test (10 REQs): strict mode, server timer, attempt state machine, auto-submit
- **US-004** Practice (7 REQs): lenient mode, instant feedback, answer locking, raw score
- **US-005** Review (5 REQs): attempt list, question review, wrong-only filter, group display
- **US-006** Admin (6 REQs): user list, role change, deactivation, self-protection
- **US-007** Scoring (6 REQs): raw computation, scaled lookup, boundary handling, missing entry
- **US-008** Audio (7 REQs): single-play enforcement, pre-signed URLs, refresh, error fallback
- **GAP-001/002/003** i18n + explanation_vi (8 REQs): bilingual UI, locale persistence, fallback

### Non-Functional Requirements

| NFR | Requirement | Priority |
|-----|------------|---------|
| NFR-001 | API p95 < 500ms at 200 concurrent users | SHOULD |
| NFR-002 | Score display < 5s post-submit | SHOULD |
| NFR-003 | Concurrent registration handled by DB unique constraint | MUST |
| NFR-004 | Passwords bcrypt cost >= 10 | MUST |
| NFR-005 | Access token <= 15min, refresh <= 7days | MUST |
| NFR-006 | Streaming file uploads to S3 (no full buffering) | SHOULD |
| NFR-007 | RBAC enforced on all endpoints | MUST |
| NFR-008 | Audio error rate < 1% over 7-day window | SHOULD |

### Constraints (Fixed -- Not Relitigated)

- C-STACK: NestJS (TypeScript) + React (TypeScript) + PostgreSQL
- C-AUTH: JWT access + refresh tokens; RBAC with roles Admin, Teacher, Learner
- C-STORAGE: S3 recommended (OQ-2 pending); design behind abstraction
- C-TIMER: Server-authoritative timer; strict mode has no pause
- C-AUDIO: Full-test = single play, no replay; Practice = unlimited replay
- C-I18N: Bilingual EN+VI (react-i18next); TOEIC content stays EN; explanations + UI chrome are locale-sensitive
- C-SIGNUP: Open self-registration, no approval gate

### Open Issues Affecting Architecture

| Issue | Architectural Impact | Resolution in This Document |
|-------|---------------------|---------------------------|
| I-001 (ETS table copyright) | Scoring module must work with or without conversion data | Swappable ConversionStrategy (Section 7) |
| I-002 (Storage provider) | Upload/download paths must be provider-agnostic | StorageAdapter abstraction (Section 8) |
| I-003 (Edit published test) | Concurrent attempt integrity | Recommend "unpublish-first" + version column (ADR-009) |
| I-004 (Max concurrent users) | Pool sizing, instance count | Design for 200 concurrent (NFR-001); document scaling path |
| I-005 (Attempt expiry mechanism) | Timer reliability when browser closes | Hybrid: lazy + cron sweep (Section 9) |

---

## 2. High-Level Architecture

### Architecture Style: Modular Monolith

**Rationale:** Small team (likely 2-5 engineers), single deployment target, domain boundaries are clear but not complex enough to justify microservice overhead. NestJS modules provide logical separation with the option to extract services later if needed. Satisfies NFR-001 (low latency -- no inter-service hops) and reduces operational complexity.

**Trade-offs accepted:** Cannot independently scale modules; acceptable at 200 concurrent users. Single database instance is the bottleneck ceiling; manageable with read replicas and connection pooling at higher load.

### System Context Diagram

```
                        ┌──────────────────┐
                        │   Learner /      │
                        │   Teacher /      │
                        │   Admin          │
                        │   (Browser)      │
                        └────────┬─────────┘
                                 │ HTTPS
                                 ▼
                        ┌──────────────────┐
                        │   React SPA      │
                        │   (Static files  │
                        │    via CDN/Nginx) │
                        └────────┬─────────┘
                                 │ REST API (JSON)
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│                     NestJS API Server                          │
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  Auth    │ │  Test    │ │ Attempt  │ │  Scoring         │ │
│  │  Module  │ │ Authoring│ │ Module   │ │  Module          │ │
│  │          │ │  Module  │ │          │ │                  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  File    │ │  Admin   │ │  User    │ │  Scheduler       │ │
│  │  Storage │ │  Module  │ │  Module  │ │  (Cron worker)   │ │
│  │  Module  │ │          │ │          │ │                  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Shared: Guards, Interceptors, Pipes, Filters, DTOs     │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────┬──────────────────────────────┬─────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────┐            ┌──────────────────┐
│  PostgreSQL 16   │            │  S3-Compatible   │
│                  │            │  Object Storage  │
│  All relational  │            │  (Audio, Images) │
│  data            │            │                  │
└──────────────────┘            └──────────────────┘
```

### Container Diagram (More Detail)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TOEIC Platform                                 │
│                                                                         │
│   ┌─────────────────┐     ┌─────────────────────────────────────────┐  │
│   │  React SPA      │     │         NestJS API Server               │  │
│   │  (TypeScript)   │────▶│                                         │  │
│   │                 │     │  Auth ─── Test ─── Attempt ─── Scoring  │  │
│   │  - React Router │     │   │        │         │          │       │  │
│   │  - react-i18next│     │   │        │         │          │       │  │
│   │  - Zustand/     │     │  File ─── Admin ── User ─── Scheduler  │  │
│   │    Context      │     │   │                                     │  │
│   │  - HTML5 Audio  │     │   │        ┌─────────────────────────┐  │  │
│   └─────────────────┘     │   │        │ Shared Infrastructure   │  │  │
│                           │   │        │ - JwtAuthGuard          │  │  │
│                           │   │        │ - RolesGuard            │  │  │
│                           │   │        │ - ValidationPipe        │  │  │
│                           │   │        │ - HttpExceptionFilter   │  │  │
│                           │   │        │ - LoggingInterceptor    │  │  │
│                           │   │        └─────────────────────────┘  │  │
│                           └──────┬────────────────────┬─────────────┘  │
│                                  │                    │                 │
│                           ┌──────▼──────┐    ┌───────▼───────┐        │
│                           │ PostgreSQL  │    │ S3-Compatible │        │
│                           │ 16          │    │ Storage       │        │
│                           │             │    │               │        │
│                           │ users       │    │ /audio/{uuid} │        │
│                           │ tests       │    │ /images/{uuid}│        │
│                           │ parts       │    │               │        │
│                           │ questions   │    └───────────────┘        │
│                           │ attempts    │                              │
│                           │ scores      │                              │
│                           │ ...         │                              │
│                           └─────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions at This Level

1. **Single NestJS process** hosts all modules + a cron scheduler (no separate worker)
2. **PostgreSQL is the sole data store** -- no Redis needed at MVP scale (200 concurrent users)
3. **S3-compatible storage** for binary assets; accessed via pre-signed URLs (no proxying through NestJS)
4. **No message queue** -- scoring is synchronous-in-request at MVP load; cron handles background expiry
5. **Static React SPA** served via Nginx or CDN; API is a separate origin with CORS

---

## 3. NestJS Module Breakdown

### Module Registry

| Module | Responsibility | Controllers | Services | Guards/Pipes | User Stories |
|--------|---------------|-------------|----------|-------------|-------------|
| **AuthModule** | Registration, login, JWT issue/refresh, password reset | AuthController | AuthService, TokenService, PasswordResetService | JwtAuthGuard, JwtRefreshGuard | US-001 |
| **UserModule** | User CRUD, profile, locale preference | UserController | UserService | -- | US-001, US-006 |
| **AdminModule** | Admin user management: list, role change, deactivate | AdminUserController | AdminUserService | RolesGuard(Admin) | US-006 |
| **TestModule** | Test CRUD, Part scaffolding, Question/Choice/Stimulus CRUD, publish workflow | TestController, QuestionController, StimulusController | TestService, QuestionService, StimulusService, PublishService | RolesGuard(Teacher,Admin) | US-002 |
| **AttemptModule** | Create/resume attempt, save answers, submit, timer queries | AttemptController | AttemptService, AttemptAnswerService, TimerService | RolesGuard(Learner) | US-003, US-004, US-005 |
| **ScoringModule** | Raw score computation, conversion table lookup, score persistence | ScoringController (read-only) | ScoringService, ConversionTableService | -- | US-007 |
| **FileModule** | Upload (stream to S3), pre-signed URL generation, URL refresh | FileController | FileStorageService (abstract), S3StorageAdapter | RolesGuard(Teacher,Admin) for upload | US-002, US-008 |
| **SchedulerModule** | Cron: expire stale attempts, cleanup orphan drafts | -- (no HTTP) | AttemptExpiryJob | -- | US-003 (I-005) |
| **SharedModule** | Guards, interceptors, filters, pipes, DTOs, decorators | -- | -- | JwtAuthGuard, RolesGuard, ValidationPipe, GlobalExceptionFilter, LoggingInterceptor | All |

### Module Dependency Graph

```
SharedModule (imported by all)
     │
     ├── AuthModule ──▶ UserModule (creates users, checks credentials)
     │
     ├── TestModule ──▶ FileModule (upload stimuli)
     │
     ├── AttemptModule ──▶ TestModule (read test structure)
     │                 ──▶ ScoringModule (trigger scoring on submit/expire)
     │                 ──▶ FileModule (pre-signed URLs for audio)
     │
     ├── AdminModule ──▶ UserModule (manage users)
     │
     ├── ScoringModule ──▶ AttemptModule (read answers) [circular avoided via service injection]
     │
     ├── SchedulerModule ──▶ AttemptModule (expire attempts)
     │
     └── FileModule (standalone; injected where needed)
```

**Circular dependency between AttemptModule and ScoringModule:** Resolved by having AttemptService call ScoringService directly (AttemptModule imports ScoringModule). ScoringService receives attempt data as parameters -- it does not import AttemptModule.

### Guards and Middleware Stack

```
Request
  │
  ├─▶ GlobalValidationPipe (class-validator on all DTOs)
  │
  ├─▶ JwtAuthGuard (validates access token; extracts userId, role)
  │     └── Skipped for: POST /auth/register, POST /auth/login,
  │         POST /auth/password-reset-request, POST /auth/password-reset
  │
  ├─▶ RolesGuard (checks @Roles() decorator on handler)
  │     └── @Roles('admin') on AdminUserController
  │     └── @Roles('teacher', 'admin') on TestController, FileController (upload)
  │     └── @Roles('learner') on AttemptController (create/submit)
  │
  ├─▶ LoggingInterceptor (request/response timing, structured log)
  │
  └─▶ GlobalExceptionFilter (catches all exceptions, returns standard error shape)
```

---

## 4. Data Model -- PostgreSQL Schema

### Entity-Relationship Diagram

```
users ──────────────< tests
  │                     │
  │                     ├──< parts
  │                     │      │
  │                     │      ├──< stimuli
  │                     │      │      │
  │                     │      │      └──< questions (via stimulus_id FK)
  │                     │      │
  │                     │      └──< questions (standalone, stimulus_id NULL)
  │                     │             │
  │                     │             └──< choices
  │                     │
  │                     └──< attempts ──< attempt_answers
  │                              │
  │                              ├──< scores
  │                              │
  │                              └──< attempt_audio_plays
  │
  ├──< refresh_tokens
  │
  └──< password_reset_tokens

score_conversion_table (standalone reference table)
```

### DDL Sketches

#### users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'learner'
                    CHECK (role IN ('admin', 'teacher', 'learner')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'deactivated')),
    preferred_locale VARCHAR(5) DEFAULT 'vi',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_users_email ON users (LOWER(email));
-- REQ-008: email normalized to lowercase before uniqueness check
-- NFR-003: DB unique constraint handles race conditions
```

#### refresh_tokens

```sql
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
-- NFR-005: refresh token <= 7 days (expires_at = now() + 7 days)
```

#### password_reset_tokens

```sql
CREATE TABLE password_reset_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,  -- now() + 30 minutes (REQ-006)
    used            BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prt_token_hash ON password_reset_tokens (token_hash);
```

#### tests

```sql
CREATE TABLE tests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(200) NOT NULL,  -- REQ-018
    description         VARCHAR(2000),           -- REQ-018
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published')),
    time_limit_minutes  INT NOT NULL DEFAULT 120
                        CHECK (time_limit_minutes >= 1),  -- EC-012
    created_by          UUID NOT NULL REFERENCES users(id),
    version             INT NOT NULL DEFAULT 1,  -- optimistic locking for edit-published guard
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tests_status ON tests (status);
CREATE INDEX idx_tests_created_by ON tests (created_by);
```

#### parts

```sql
CREATE TABLE parts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id         UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    part_number     INT NOT NULL CHECK (part_number BETWEEN 1 AND 7),
    section         VARCHAR(10) NOT NULL
                    CHECK (section IN ('listening', 'reading')),
    target_question_count INT NOT NULL,
    -- target counts: P1=6, P2=25, P3=39, P4=30, P5=30, P6=16, P7=54
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (test_id, part_number)
);

CREATE INDEX idx_parts_test_id ON parts (test_id);
```

#### stimuli

```sql
CREATE TABLE stimuli (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id         UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('audio', 'image', 'passage')),
    storage_key     VARCHAR(500),   -- S3 object key (audio/image files)
    passage_text    TEXT,           -- for text/passage stimuli (Parts 6, 7)
    original_filename VARCHAR(255), -- REQ-019: preserved original name
    mime_type       VARCHAR(50),
    file_size_bytes BIGINT,
    sequence        INT NOT NULL DEFAULT 0, -- ordering within a part
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stimuli_part_id ON stimuli (part_id);
```

#### questions

```sql
CREATE TABLE questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id         UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    stimulus_id     UUID REFERENCES stimuli(id) ON DELETE SET NULL,
    -- NULL = standalone question (Parts 1, 2, 5 standalone)
    -- non-NULL = grouped under stimulus (Parts 3, 4, 6, 7)
    sequence        INT NOT NULL,  -- ordering within a part
    question_text   TEXT,          -- may be NULL for pure-audio questions (Part 2)
    explanation_vi  VARCHAR(5000), -- REQ-020: nullable Vietnamese explanation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_questions_part_id ON questions (part_id);
CREATE INDEX idx_questions_stimulus_id ON questions (stimulus_id);
CREATE UNIQUE INDEX uq_questions_part_sequence ON questions (part_id, sequence);
```

#### choices

```sql
CREATE TABLE choices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    label           CHAR(1) NOT NULL CHECK (label IN ('A', 'B', 'C', 'D')),
    choice_text     TEXT NOT NULL,
    is_correct      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (question_id, label)
);

CREATE INDEX idx_choices_question_id ON choices (question_id);
-- REQ-017: application layer enforces exactly 4 choices, exactly 1 correct per question
```

#### attempts

```sql
CREATE TABLE attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    test_id         UUID NOT NULL REFERENCES tests(id),
    part_id         UUID REFERENCES parts(id),
    -- part_id is non-NULL only for practice attempts (REQ-040)
    mode            VARCHAR(10) NOT NULL CHECK (mode IN ('full', 'practice')),
    status          VARCHAR(15) NOT NULL DEFAULT 'in-progress'
                    CHECK (status IN ('in-progress', 'submitted', 'expired')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    -- computed: started_at + time_limit_minutes (full mode only)
    -- NULL for practice mode (REQ-041: no timer)
    submitted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- REQ-037: max 1 in-progress full attempt per test per learner
CREATE UNIQUE INDEX uq_attempt_in_progress
    ON attempts (user_id, test_id, mode)
    WHERE status = 'in-progress' AND mode = 'full';

CREATE INDEX idx_attempts_user_id ON attempts (user_id);
CREATE INDEX idx_attempts_test_id ON attempts (test_id);
CREATE INDEX idx_attempts_status ON attempts (status);
CREATE INDEX idx_attempts_expires_at ON attempts (expires_at)
    WHERE status = 'in-progress' AND mode = 'full';
-- Used by cron sweep for I-005 attempt expiry
```

**Attempt State Machine (REQ-036):**

```
                ┌──────────────┐
                │  in-progress │
                └──────┬───────┘
                       │
              ┌────────┼────────┐
              │                 │
     manual submit        timer expires
              │                 │
              ▼                 ▼
       ┌────────────┐   ┌───────────┐
       │  submitted  │   │  expired  │
       └────────────┘   └───────────┘

  No other transitions. Both terminal states trigger scoring.
```

#### attempt_answers

```sql
CREATE TABLE attempt_answers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id      UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id     UUID NOT NULL REFERENCES questions(id),
    selected_choice_id UUID REFERENCES choices(id),
    -- NULL if unanswered at submission/expiry time
    is_correct      BOOLEAN,
    -- computed on save: selected_choice.is_correct
    -- NULL if no answer selected
    answered_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (attempt_id, question_id)
);

CREATE INDEX idx_attempt_answers_attempt_id ON attempt_answers (attempt_id);
```

#### attempt_audio_plays (C-003 Resolution)

**Decision: Separate join table, not JSONB on attempt.**

```sql
CREATE TABLE attempt_audio_plays (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id      UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    stimulus_id     UUID NOT NULL REFERENCES stimuli(id),
    played_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (attempt_id, stimulus_id)
    -- One row per stimulus per attempt = "has been played"
    -- Insert on first play; existence check prevents replay in full-test mode
);

CREATE INDEX idx_aap_attempt_id ON attempt_audio_plays (attempt_id);
```

**Justification (C-003):** A join table over JSONB because:
1. The query pattern is simple: `SELECT EXISTS(... WHERE attempt_id=? AND stimulus_id=?)` -- efficient with a unique composite index.
2. JSONB would require array-contains checks and is harder to index for this specific pattern.
3. The join table is append-only (insert on first play, never update), which is ideal for PostgreSQL WAL performance.
4. Maximum rows per attempt: ~100 stimuli in a 200-question test -- negligible storage cost.
5. Foreign key integrity on stimulus_id catches orphan references that JSONB would silently allow.

#### scores

```sql
CREATE TABLE scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id      UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    section         VARCHAR(10) NOT NULL
                    CHECK (section IN ('listening', 'reading', 'total')),
    raw_score       INT NOT NULL,
    scaled_score    INT,  -- NULL if conversion table missing (REQ-073)
    scaled_unavailable BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (attempt_id, section)
);

CREATE INDEX idx_scores_attempt_id ON scores (attempt_id);
```

#### score_conversion_table

```sql
CREATE TABLE score_conversion_table (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section         VARCHAR(10) NOT NULL
                    CHECK (section IN ('listening', 'reading')),
    raw_score       INT NOT NULL CHECK (raw_score BETWEEN 0 AND 100),
    scaled_score    INT NOT NULL CHECK (scaled_score BETWEEN 5 AND 495),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (section, raw_score)
);

-- REQ-075: 101 rows per section (raw 0-100), admin-seeded
-- REQ-072: raw 0 -> scaled 5, raw 100 -> scaled 495
```

### Entity Volume Estimates

| Entity | Rows at launch | Growth rate | Retention |
|--------|---------------|-------------|-----------|
| users | 500 | +100/month | indefinite |
| tests | 10 | +2/month | indefinite |
| parts | 70 (7 per test) | proportional to tests | indefinite |
| stimuli | ~500 | proportional to tests | indefinite |
| questions | 2,000 (200 per test) | proportional to tests | indefinite |
| choices | 8,000 (4 per question) | proportional to questions | indefinite |
| attempts | 1,000 (target metric) | +500/month | indefinite |
| attempt_answers | 200,000 (200 per attempt) | +100k/month | indefinite |
| attempt_audio_plays | ~50,000 | +25k/month | indefinite |
| scores | 3,000 (3 per full attempt) | proportional to attempts | indefinite |
| score_conversion_table | 202 (static) | 0 | permanent |

All volumes are well within single-PostgreSQL capacity. No partitioning needed at MVP.

---

## 5. API Surface

### Auth Endpoints (AuthModule)

| Method | Path | Auth | Role | Purpose | REQs |
|--------|------|------|------|---------|------|
| POST | `/api/v1/auth/register` | None | -- | Self-register; returns JWT pair | REQ-001..003, 008, 009 |
| POST | `/api/v1/auth/login` | None | -- | Login; returns JWT pair | REQ-004, 005 |
| POST | `/api/v1/auth/refresh` | Refresh token | Any | Issue new access token | REQ-004, NFR-005 |
| POST | `/api/v1/auth/logout` | JWT | Any | Revoke refresh token | -- |
| POST | `/api/v1/auth/password-reset-request` | None | -- | Send reset email | REQ-006 |
| POST | `/api/v1/auth/password-reset` | None (token in body) | -- | Set new password | REQ-007 |

### User Endpoints (UserModule)

| Method | Path | Auth | Role | Purpose | REQs |
|--------|------|------|------|---------|------|
| GET | `/api/v1/users/me` | JWT | Any | Get current user profile | -- |
| PATCH | `/api/v1/users/me` | JWT | Any | Update profile (display name, locale) | REQ-024 |

### Test Authoring Endpoints (TestModule)

| Method | Path | Auth | Role | Purpose | REQs |
|--------|------|------|------|---------|------|
| POST | `/api/v1/tests` | JWT | Teacher, Admin | Create draft test (auto-scaffolds 7 parts) | REQ-010, 018 |
| GET | `/api/v1/tests` | JWT | Any | List tests (published for Learner; all for Teacher/Admin). **Paginated** | REQ-014 |
| GET | `/api/v1/tests/:testId` | JWT | Any | Get test detail with parts summary | -- |
| PATCH | `/api/v1/tests/:testId` | JWT | Teacher, Admin | Update test title/description/timeLimit | REQ-018 |
| POST | `/api/v1/tests/:testId/publish` | JWT | Teacher, Admin | Publish draft test | REQ-015 |
| POST | `/api/v1/tests/:testId/unpublish` | JWT | Teacher, Admin | Unpublish (if no in-progress attempts) | I-003 |
| DELETE | `/api/v1/tests/:testId` | JWT | Teacher, Admin | Delete draft test only | -- |
| GET | `/api/v1/tests/:testId/parts` | JWT | Any | List parts for a test | -- |
| GET | `/api/v1/tests/:testId/parts/:partId/questions` | JWT | Teacher, Admin | List questions in a part (authoring view) | -- |
| POST | `/api/v1/tests/:testId/parts/:partId/questions` | JWT | Teacher, Admin | Add question to a part | REQ-011, 017, 020 |
| PATCH | `/api/v1/questions/:questionId` | JWT | Teacher, Admin | Update question text/explanation/choices | REQ-011, 020 |
| DELETE | `/api/v1/questions/:questionId` | JWT | Teacher, Admin | Delete question | -- |
| POST | `/api/v1/tests/:testId/parts/:partId/stimuli` | JWT | Teacher, Admin | Create stimulus (upload file or text passage) | REQ-012, 013 |
| PATCH | `/api/v1/stimuli/:stimulusId` | JWT | Teacher, Admin | Update stimulus | -- |
| DELETE | `/api/v1/stimuli/:stimulusId` | JWT | Teacher, Admin | Delete stimulus and cascade to questions | -- |

### Attempt Endpoints (AttemptModule)

| Method | Path | Auth | Role | Purpose | REQs |
|--------|------|------|------|---------|------|
| POST | `/api/v1/attempts` | JWT | Learner | Start or resume attempt (body: testId, mode, partId?) | REQ-030, 037, 040 |
| GET | `/api/v1/attempts/:attemptId` | JWT | Learner | Get attempt state (status, timer remaining) | REQ-031 |
| GET | `/api/v1/attempts/:attemptId/questions` | JWT | Learner | Get questions for the attempt (with pre-signed audio URLs). **Paginated** by question group | REQ-080..085 |
| POST | `/api/v1/attempts/:attemptId/answers` | JWT | Learner | Save/update an answer (body: questionId, choiceId) | REQ-035, 043 |
| POST | `/api/v1/attempts/:attemptId/submit` | JWT | Learner | Submit attempt; triggers scoring | REQ-033..035 |
| GET | `/api/v1/attempts/:attemptId/timer` | JWT | Learner | Get server time remaining (lightweight poll) | REQ-031 |
| GET | `/api/v1/attempts/me` | JWT | Learner | List my past attempts. **Paginated**, most recent first | REQ-050 |
| GET | `/api/v1/attempts/:attemptId/review` | JWT | Learner | Get full review data (questions + answers + correct + explanations). Query: `?wrongOnly=true` | REQ-051, 052, 054 |

### Audio/File Endpoints (FileModule)

| Method | Path | Auth | Role | Purpose | REQs |
|--------|------|------|------|---------|------|
| POST | `/api/v1/files/upload` | JWT | Teacher, Admin | Upload audio/image; stream to S3 | REQ-013, 086, NFR-006 |
| GET | `/api/v1/files/:storageKey/url` | JWT | Learner, Teacher, Admin | Get fresh pre-signed URL for a file | REQ-083, 084 |

### Audio Play Tracking (AttemptModule)

| Method | Path | Auth | Role | Purpose | REQs |
|--------|------|------|------|---------|------|
| POST | `/api/v1/attempts/:attemptId/audio-played` | JWT | Learner | Record that a stimulus was played (body: stimulusId) | REQ-080, 081 |
| GET | `/api/v1/attempts/:attemptId/audio-played` | JWT | Learner | Get list of played stimuli IDs for this attempt | REQ-081 |

### Scoring Endpoints (ScoringModule)

| Method | Path | Auth | Role | Purpose | REQs |
|--------|------|------|------|---------|------|
| GET | `/api/v1/attempts/:attemptId/scores` | JWT | Learner | Get scores for a completed attempt | REQ-070..074 |

### Admin Endpoints (AdminModule)

| Method | Path | Auth | Role | Purpose | REQs |
|--------|------|------|------|---------|------|
| GET | `/api/v1/admin/users` | JWT | Admin | List users. **Paginated**. Query: `?search=email&role=teacher` | REQ-060, 065 |
| PATCH | `/api/v1/admin/users/:userId/role` | JWT | Admin | Change role | REQ-061, 063 |
| POST | `/api/v1/admin/users/:userId/deactivate` | JWT | Admin | Deactivate user | REQ-062, 063 |
| POST | `/api/v1/admin/users/:userId/reactivate` | JWT | Admin | Reactivate user | REQ-064 |
| POST | `/api/v1/admin/score-conversion-table` | JWT | Admin | Seed/replace conversion table | REQ-075 |

### Pagination Convention

All paginated endpoints accept:
- `?page=1&limit=20` (default page=1, limit=20, max limit=100)
- Response shape: `{ data: [...], meta: { page, limit, total, totalPages } }`

### Standard Error Response Shape

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Exactly 4 choices required",
  "path": "/api/v1/tests/.../parts/.../questions",
  "timestamp": "2026-06-07T10:30:00.000Z"
}
```

---

## 6. Auth & RBAC Design

### JWT Strategy

```
┌────────────────────────────────────────────────────────────────────┐
│ 1. User POSTs /auth/login with email + password                   │
│ 2. Server validates credentials (bcrypt compare, cost >= 10)      │
│    - If user.status = 'deactivated': return 403                   │
│ 3. Server issues:                                                  │
│    - Access token (JWT, HS256, 15-min expiry) -- NFR-005           │
│      Payload: { sub: userId, role, iat, exp }                     │
│    - Refresh token (opaque UUID, hashed in DB, 7-day expiry)      │
│ 4. Access token returned in response body (frontend stores in     │
│    memory -- NOT localStorage)                                     │
│ 5. Refresh token returned as HttpOnly, Secure, SameSite=Strict    │
│    cookie -- browser sends automatically on /auth/refresh          │
└────────────────────────────────────────────────────────────────────┘
```

**Why HS256 for MVP:** Single server; no need to distribute public keys. Upgrade to RS256 if/when we add a second service that validates tokens independently.

### Access Token Payload

```json
{
  "sub": "uuid-of-user",
  "role": "learner",
  "iat": 1717750200,
  "exp": 1717751100
}
```

No user status in the token -- checked via DB lookup only on refresh (REQ-062: deactivated user's tokens invalidated means we revoke all refresh tokens and let access tokens expire naturally within 15 min, per EC-009).

### Refresh Token Flow

```
Client                          Server
  │                                │
  │── POST /auth/refresh ──────▶  │
  │   (HttpOnly cookie)           │
  │                                │── Lookup refresh_token by hash
  │                                │── Check: not revoked, not expired
  │                                │── Check: user.status = 'active'
  │                                │── Check: user.role (may have changed -- REQ-061)
  │                                │── Issue new access token with CURRENT role
  │                                │
  │◀── 200 { accessToken } ───── │
```

**Token invalidation on deactivation (REQ-062):** Admin deactivation sets `user.status = 'deactivated'` AND sets `revoked = true` on all refresh_tokens for that user. The user's current access token remains valid until it expires (max 15 min -- NFR-005). After that, refresh fails, and the user is locked out.

**Role change propagation (REQ-061):** Role changes take effect on next token refresh. The new access token carries the updated role.

### Password Hashing

- Algorithm: bcrypt with cost factor 12 (exceeds NFR-004 minimum of 10)
- Implementation: `bcrypt` npm package
- Plaintext password never stored, never logged

### Password Reset Flow

```
1. POST /auth/password-reset-request { email }
   - Always returns 200 "If that email is registered..." (no leak -- REQ-006)
   - If user exists: generate UUID token, hash it, store in password_reset_tokens
     with expires_at = now() + 30 min
   - Send email with link: {FRONTEND_URL}/reset-password?token={raw-uuid}

2. POST /auth/password-reset { token, newPassword }
   - Hash the token, look up in DB
   - If not found or used or expired: return 410 (REQ-007)
   - If valid: hash new password, update user, mark token used,
     revoke all refresh tokens for user (force re-login)
```

### RBAC Guard

```typescript
// Decorator
@Roles('teacher', 'admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tests')
export class TestController { ... }

// Guard implementation
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true; // no @Roles = public (but still needs JWT)
    const user = context.switchToHttp().getRequest().user;
    return requiredRoles.includes(user.role);
  }
}
```

### Self-Protection (REQ-063)

AdminUserService checks `if (targetUserId === currentUserId) throw ForbiddenException` on role change and deactivation.

---

## 7. Scoring Subsystem

### Architecture

```
AttemptService.submit(attemptId)
       │
       ▼
ScoringService.computeAndPersist(attemptId)
       │
       ├── 1. Count correct answers per section
       │      SELECT COUNT(*) FROM attempt_answers aa
       │      JOIN questions q ON aa.question_id = q.id
       │      JOIN parts p ON q.part_id = p.id
       │      WHERE aa.attempt_id = ? AND aa.is_correct = true
       │      GROUP BY p.section
       │
       ├── 2. Lookup conversion table (full mode only)
       │      ConversionTableService.convert(section, rawScore)
       │
       ├── 3. Persist scores (listening, reading, total)
       │      INSERT INTO scores (attempt_id, section, raw_score, scaled_score, scaled_unavailable)
       │
       └── 4. Return scores to caller (synchronous)
```

### Swappable Conversion Strategy (I-001 / OQ-1)

```typescript
// Strategy interface
interface ScoreConversionStrategy {
  convert(section: 'listening' | 'reading', rawScore: number): ConversionResult;
}

type ConversionResult =
  | { scaled: number; unavailable: false }
  | { scaled: null; unavailable: true; message: string };

// Implementation 1: Database lookup (default)
class DatabaseConversionStrategy implements ScoreConversionStrategy {
  convert(section, rawScore) {
    const entry = this.repo.findOne({ section, rawScore });
    if (!entry) {
      this.logger.error(`Missing conversion entry: section=${section}, raw=${rawScore}`);
      // REQ-073: admin alert + learner message
      return { scaled: null, unavailable: true, message: 'Scaled score temporarily unavailable' };
    }
    return { scaled: entry.scaledScore, unavailable: false };
  }
}

// Implementation 2: Approximate formula (fallback if ETS table unavailable)
class ApproximateConversionStrategy implements ScoreConversionStrategy {
  convert(section, rawScore) {
    // Linear approximation: scaled = 5 + (rawScore / 100) * 490
    // REQ-072: raw 0 -> 5, raw 100 -> 495
    const scaled = Math.round(5 + (rawScore / 100) * 490);
    return { scaled, unavailable: false };
  }
}
```

**Which strategy is active** is determined by configuration (`SCORE_CONVERSION_STRATEGY=database|approximate`). This unblocks I-001: if ETS copyright prevents using the official table, we ship with the approximate strategy and swap in the database strategy when the table is seeded.

### Practice Mode Scoring (REQ-074)

Practice mode skips conversion entirely:
```
ScoringService.computeRaw(attemptId)
  -> { rawCorrect: 18, totalQuestions: 30 }
  -> No score_conversion_table lookup
  -> No scores table entry (or entry with scaled_score = NULL, section = part's section only)
```

### Score Display Timing (NFR-002 / REQ-039)

Scoring is synchronous within the submit request. At MVP load (200 concurrent users), the COUNT query + conversion lookup + INSERT completes in < 100ms. The 5-second target is easily met.

If scoring ever becomes expensive (e.g., complex analytics), we would move to async with a polling endpoint. Not needed now.

---

## 8. File & Audio Subsystem

### Storage Abstraction (I-002 / OQ-2)

```typescript
// Abstract interface -- swappable provider
interface FileStorageAdapter {
  upload(key: string, stream: Readable, metadata: FileMetadata): Promise<void>;
  getPresignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

// S3 implementation (default)
class S3StorageAdapter implements FileStorageAdapter {
  constructor(private s3Client: S3Client, private bucket: string) {}

  async upload(key, stream, metadata) {
    await this.s3Client.send(new Upload({
      Bucket: this.bucket,
      Key: key,
      Body: stream,
      ContentType: metadata.mimeType,
      Metadata: { originalFilename: metadata.originalFilename },
    }));
  }

  async getPresignedUrl(key, expiresInSeconds) {
    return getSignedUrl(this.s3Client, new GetObjectCommand({
      Bucket: this.bucket, Key: key,
    }), { expiresIn: expiresInSeconds });
  }
}

// Local filesystem implementation (development)
class LocalStorageAdapter implements FileStorageAdapter { ... }

// GCS / R2 implementations can be added without changing callers
```

### Upload Flow (REQ-013, NFR-006)

```
Teacher Browser                NestJS                     S3
     │                           │                         │
     │── POST /files/upload ───▶│                         │
     │   (multipart/form-data)  │                         │
     │                           │── Validate MIME + size  │
     │                           │   (REQ-086: audio/mpeg, │
     │                           │    audio/aac <=20MB;    │
     │                           │    image/jpeg, image/png│
     │                           │    <=5MB)               │
     │                           │                         │
     │                           │── Generate storage key  │
     │                           │   {type}/{uuid}.{ext}   │
     │                           │                         │
     │                           │── Stream upload ───────▶│  (NFR-006: no full buffering)
     │                           │                         │── Store object
     │                           │◀── 200 ────────────────│
     │                           │                         │
     │◀── 201 { storageKey,     │                         │
     │         originalFilename, │                         │
     │         mimeType,         │                         │
     │         fileSize }        │                         │
```

**Streaming:** NestJS uses `@UseInterceptors(FileInterceptor)` with multer configured for streaming (disk storage or passthrough) -- file bytes are piped directly to S3 via `@aws-sdk/lib-storage` Upload. Maximum memory footprint: ~1MB buffer regardless of file size.

**Filename sanitization (REQ-019):** Server sanitizes the filename to `[a-zA-Z0-9._-]`, stores original in stimulus.original_filename metadata.

**Storage key format:** `audio/{uuid}.mp3` or `images/{uuid}.png` -- no user-supplied path components.

### Pre-Signed URL Generation (REQ-083, 084)

```
Learner Browser              NestJS                        S3
     │                          │                            │
     │── GET /attempts/:id/     │                            │
     │   questions?page=1 ─────▶│                            │
     │                          │── For each audio stimulus: │
     │                          │   getPresignedUrl(key, 900)│ (15 min = 900s -- REQ-083)
     │                          │                            │
     │◀── 200 { questions: [    │                            │
     │     { ..., audioUrl:     │                            │
     │       "https://s3...     │                            │
     │        ?X-Amz-Expires=   │                            │
     │        900&..." }        │                            │
     │   ]}                     │                            │
```

### Pre-Signed URL Refresh (REQ-084)

```
Learner Browser              NestJS                        S3
     │                          │                            │
     │── <audio src="..."> ────────────────────────────────▶│
     │                          │                    ◀── 403 │ (URL expired)
     │◀── 403 ─────────────────────────────────────────────│
     │                          │                            │
     │── GET /files/{key}/url ─▶│                            │
     │                          │── getPresignedUrl(key, 900)│
     │                          │                            │
     │◀── 200 { url: "new..." }│                            │
     │                          │                            │
     │── <audio src="new..."> ─────────────────────────────▶│
     │                          │                    ◀── 200 │
     │◀── audio stream ────────────────────────────────────│
```

**Frontend retry logic (SC-104):**
1. Audio element fires `error` event
2. If error is 403 and retry count < 2: call `GET /files/{key}/url` for fresh URL
3. Set new URL on audio element, play
4. If retry fails or error is not 403: show "Audio unavailable" message (REQ-085)

### Audio-Played Tracking (C-003, REQ-080, 081)

**Full-test mode only:**

```
1. Frontend loads question with audio stimulus
2. Frontend checks local played-set (in-memory Set<stimulusId>)
   AND calls GET /attempts/:id/audio-played on session start to seed the set
3. If stimulus NOT in played-set:
   a. Play audio
   b. POST /attempts/:id/audio-played { stimulusId }
   c. Server inserts into attempt_audio_plays (UNIQUE constraint = idempotent)
   d. Add to local played-set
4. If stimulus IS in played-set:
   a. Do NOT play audio (REQ-081)
   b. Show question without audio controls

Practice mode: No tracking needed. Unlimited replays (REQ-082).
Review mode: Audio always playable (REQ-053). No tracking.
```

**Server backstop:** Even if the client is manipulated, the server records plays. On a subsequent request, if `attempt_audio_plays` already has a row for (attempt_id, stimulus_id), the server can return `audioAlreadyPlayed: true` in the question response, and the frontend honors it.

---

## 9. Timer & Attempt Lifecycle (I-005 Resolution)

### The Problem

When a learner starts a full-test attempt, the server records `started_at` and computes `expires_at = started_at + time_limit_minutes`. If the learner closes their browser or loses connectivity, no client-side event fires. The attempt stays `in-progress` indefinitely unless the server acts.

### Decision: Hybrid -- Lazy Evaluation + Cron Sweep

**ADR-001: Attempt Expiry Mechanism**

| Approach | Pros | Cons |
|----------|------|------|
| **Cron poll** (e.g., every 60s) | Simple; batch-efficient | Up to 60s delay before expiry detected; wastes cycles checking mostly-unexpired rows |
| **Per-attempt scheduled job** (e.g., `setTimeout` or Bull queue) | Precise timing; fires exactly at expiry | Requires a job queue (Redis/Bull); jobs lost on restart unless persistent; operational complexity |
| **Lazy evaluation on access** | Zero background cost; immediate on next access | Never fires if no one accesses the attempt again; stale in-progress forever |
| **Hybrid: lazy + cron** | Immediate on access; cron catches abandoned ones; no extra infrastructure | Slightly more code; cron interval is acceptable for non-accessed attempts |

**Chosen: Hybrid (lazy evaluation + cron sweep)**

**Rationale:**
- Lazy evaluation handles the common case (learner returns, or timer fires client-side and calls submit). Zero latency.
- Cron sweep (every 60 seconds) catches the edge case where no one ever accesses the attempt again (EC-004: browser closed). At MVP scale (200 concurrent users), scanning `attempts WHERE status = 'in-progress' AND mode = 'full' AND expires_at < now()` hits a small, indexed result set.
- No external infrastructure (no Redis, no Bull queue). The NestJS `@Cron()` decorator (from `@nestjs/schedule`) runs in-process.
- Precision: worst-case 60-second delay for abandoned attempts is acceptable. The test has already expired by the time the cron runs; the learner is gone.

### Implementation

#### Lazy evaluation (on every attempt access)

```typescript
// AttemptService -- called on GET /attempts/:id, POST /answers, POST /submit
async ensureNotExpired(attempt: Attempt): Promise<Attempt> {
  if (
    attempt.status === 'in-progress' &&
    attempt.mode === 'full' &&
    attempt.expiresAt &&
    attempt.expiresAt <= new Date()
  ) {
    return this.expireAttempt(attempt);
  }
  return attempt;
}

async expireAttempt(attempt: Attempt): Promise<Attempt> {
  // Atomic CAS to prevent double-expiry
  const result = await this.attemptRepo
    .createQueryBuilder()
    .update(Attempt)
    .set({ status: 'expired', submittedAt: attempt.expiresAt })
    .where('id = :id AND status = :status', { id: attempt.id, status: 'in-progress' })
    .execute();

  if (result.affected === 1) {
    await this.scoringService.computeAndPersist(attempt.id);
  }
  return this.attemptRepo.findOneOrFail({ where: { id: attempt.id } });
}
```

#### Cron sweep (catches abandoned attempts)

```typescript
@Injectable()
export class AttemptExpiryJob {
  private readonly logger = new Logger(AttemptExpiryJob.name);

  constructor(private attemptService: AttemptService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleAttempts() {
    const stale = await this.attemptRepo.find({
      where: {
        status: 'in-progress',
        mode: 'full',
        expiresAt: LessThan(new Date()),
      },
      take: 100, // batch limit to avoid long transactions
    });

    for (const attempt of stale) {
      try {
        await this.attemptService.expireAttempt(attempt);
        this.logger.log(`Expired abandoned attempt: ${attempt.id}`);
      } catch (err) {
        this.logger.error(`Failed to expire attempt ${attempt.id}`, err.stack);
        // Will retry next minute
      }
    }
  }
}
```

#### Race condition safety (EC-001)

The `WHERE status = 'in-progress'` in the UPDATE acts as an optimistic lock. If two processes (cron + lazy) try to expire the same attempt simultaneously, only one succeeds (`affected === 1`); the other is a no-op. Scoring is triggered only by the winner.

### Timer Display (Client Side)

```
1. On attempt load, server returns:
   { startedAt, expiresAt, serverTime }

2. Client computes offset:
   offset = serverTime - Date.now()  // clock skew compensation

3. Client displays countdown:
   remaining = expiresAt - (Date.now() + offset)

4. Client polls GET /attempts/:id/timer every 30 seconds
   to re-sync (handles drift, network delays)

5. When client timer hits 0:
   - Client calls POST /attempts/:id/submit (auto-submit)
   - If submit fails (already expired by server), redirect to results

6. Server is authoritative: even if client never submits,
   cron or lazy eval will expire the attempt (REQ-031, SC-050)
```

### Attempt Start Logic (REQ-037)

```typescript
async startOrResume(userId, testId, mode, partId?): Promise<Attempt> {
  if (mode === 'full') {
    // Check for existing in-progress attempt (REQ-037)
    const existing = await this.attemptRepo.findOne({
      where: { userId, testId, mode: 'full', status: 'in-progress' },
    });
    if (existing) {
      return this.ensureNotExpired(existing); // resume, not duplicate
    }
  }

  const test = await this.testService.findPublishedOrFail(testId);
  const attempt = this.attemptRepo.create({
    userId, testId, mode,
    partId: mode === 'practice' ? partId : null,
    status: 'in-progress',
    startedAt: new Date(),
    expiresAt: mode === 'full'
      ? new Date(Date.now() + test.timeLimitMinutes * 60 * 1000)
      : null,  // practice mode: no expiry (REQ-041)
  });
  return this.attemptRepo.save(attempt);
}
```

---

## 10. Frontend Architecture

### React App Structure

```
src/
├── main.tsx                          -- entry point, providers
├── App.tsx                           -- router outlet
│
├── routes/                           -- page-level components (one per route)
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   └── PasswordResetPage.tsx
│   ├── tests/
│   │   ├── TestLibraryPage.tsx       -- learner: published tests
│   │   └── TestDetailPage.tsx        -- test info + start/practice buttons
│   ├── authoring/
│   │   ├── TestEditorPage.tsx        -- teacher: test CRUD
│   │   ├── PartEditorPage.tsx        -- teacher: add questions/stimuli
│   │   └── QuestionEditorPage.tsx
│   ├── exam/
│   │   ├── ExamRunnerPage.tsx        -- full test or practice runner
│   │   └── ExamCompletePage.tsx      -- score display
│   ├── review/
│   │   ├── MyResultsPage.tsx         -- attempt list
│   │   └── AttemptReviewPage.tsx     -- question-by-question review
│   └── admin/
│       └── UserManagementPage.tsx
│
├── components/                       -- reusable UI components
│   ├── layout/
│   │   ├── Header.tsx                -- nav, locale switcher, user menu
│   │   └── PageLayout.tsx
│   ├── exam/
│   │   ├── QuestionCard.tsx          -- renders question + choices
│   │   ├── AudioPlayer.tsx           -- wraps <audio>, handles mode rules
│   │   ├── ExamTimer.tsx             -- countdown display
│   │   ├── QuestionNav.tsx           -- question number grid/navigator
│   │   └── StimulusDisplay.tsx       -- renders stimulus (audio/image/passage)
│   ├── review/
│   │   ├── ReviewQuestionCard.tsx    -- question + answer + explanation
│   │   └── WrongOnlyToggle.tsx
│   └── common/
│       ├── Pagination.tsx
│       ├── ConfirmDialog.tsx
│       └── LocaleSwitcher.tsx
│
├── hooks/                            -- custom React hooks
│   ├── useAuth.ts                    -- login, register, logout, token refresh
│   ├── useAttempt.ts                 -- attempt state, answer submission
│   ├── useTimer.ts                   -- countdown logic with server sync
│   ├── useAudioPlayer.ts            -- play, replay, error handling, URL refresh
│   └── usePagination.ts
│
├── api/                              -- API client layer
│   ├── client.ts                     -- axios instance with interceptors
│   ├── auth.api.ts
│   ├── tests.api.ts
│   ├── attempts.api.ts
│   ├── files.api.ts
│   └── admin.api.ts
│
├── store/                            -- global state (minimal)
│   └── authStore.ts                  -- Zustand: user, accessToken, isAuthenticated
│
├── i18n/                             -- internationalization
│   ├── i18n.ts                       -- i18next config
│   ├── locales/
│   │   ├── en/
│   │   │   ├── common.json           -- shared strings (nav, buttons, errors)
│   │   │   ├── auth.json             -- login/register strings
│   │   │   ├── test.json             -- test library, authoring
│   │   │   ├── exam.json             -- exam runner, timer, submit
│   │   │   ├── review.json           -- results, review
│   │   │   └── admin.json            -- user management
│   │   └── vi/
│   │       ├── common.json
│   │       ├── auth.json
│   │       ├── test.json
│   │       ├── exam.json
│   │       ├── review.json
│   │       └── admin.json
│   └── README.md                     -- naming conventions for i18n keys
│
├── types/                            -- shared TypeScript interfaces
│   ├── user.ts
│   ├── test.ts
│   ├── attempt.ts
│   └── api.ts                        -- PaginatedResponse, ErrorResponse, etc.
│
└── utils/
    ├── formatters.ts                 -- date, score formatting
    └── validators.ts                 -- client-side validation (mirrors server)
```

### Routing

```typescript
const routes = [
  // Public
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/reset-password', element: <PasswordResetPage /> },

  // Authenticated (any role)
  { path: '/', element: <ProtectedRoute />, children: [
    { path: 'tests', element: <TestLibraryPage /> },
    { path: 'tests/:testId', element: <TestDetailPage /> },
  ]},

  // Learner
  { path: '/exam', element: <ProtectedRoute roles={['learner']} />, children: [
    { path: ':attemptId', element: <ExamRunnerPage /> },
    { path: ':attemptId/complete', element: <ExamCompletePage /> },
  ]},
  { path: '/results', element: <ProtectedRoute roles={['learner']} />, children: [
    { index: true, element: <MyResultsPage /> },
    { path: ':attemptId', element: <AttemptReviewPage /> },
  ]},

  // Teacher
  { path: '/authoring', element: <ProtectedRoute roles={['teacher', 'admin']} />, children: [
    { index: true, element: <TestEditorPage /> },
    { path: ':testId', element: <TestEditorPage /> },
    { path: ':testId/parts/:partId', element: <PartEditorPage /> },
  ]},

  // Admin
  { path: '/admin', element: <ProtectedRoute roles={['admin']} />, children: [
    { path: 'users', element: <UserManagementPage /> },
  ]},
];
```

### State Management

**Decision: Zustand for auth state only; React Query (TanStack Query) for server state.**

- **Zustand store** (`authStore`): holds `user`, `accessToken`, `isAuthenticated`. Updated on login/logout/refresh. Lightweight, no boilerplate.
- **TanStack Query**: all API data (tests, attempts, questions, scores) are server-state managed by TanStack Query. Provides caching, background refetch, pagination helpers, optimistic updates.
- **No Redux:** Overkill for this app's state complexity. Two or three global values (auth + locale) do not justify Redux's ceremony.

### i18n Setup (REQ-023..027, GAP-002)

```typescript
// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',            // REQ-025: missing VI -> fall back to EN
    defaultNS: 'common',
    ns: ['common', 'auth', 'test', 'exam', 'review', 'admin'],
    interpolation: { escapeValue: false },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    // REQ-025: never show raw key
    parseMissingKeyHandler: (key, defaultValue) => defaultValue || key,
    saveMissing: process.env.NODE_ENV === 'development', // log missing keys in dev
  });
```

**Locale persistence (REQ-024):**
- Authenticated users: `preferred_locale` stored in `users` table; sent to API on change via `PATCH /users/me`
- Unauthenticated visitors: stored in `localStorage`; default = 'vi' (REQ-026)
- On login: if user has `preferred_locale`, use it; otherwise use the localStorage value

**Content vs. UI string distinction (REQ-027):**
- TOEIC question text, choice text, passage text, audio: always rendered as-is (English content from DB)
- `explanation_vi`: always rendered as-is (Vietnamese content from DB) -- not through i18n
- UI chrome (labels like "Explanation:", buttons, nav): rendered through `t()` function with locale switching

**Translation file structure:**
```
locales/
  en/
    common.json    -- "submit": "Submit", "cancel": "Cancel", ...
    exam.json      -- "timer.remaining": "Time remaining", ...
  vi/
    common.json    -- "submit": "Nop bai", "cancel": "Huy", ...
    exam.json      -- "timer.remaining": "Thoi gian con lai", ...
```

### Exam Runner Component Architecture

```
ExamRunnerPage
├── ExamTimer (full mode only)
│   └── useTimer(attemptId)              -- server-synced countdown
├── QuestionNav                          -- question number grid
├── StimulusDisplay                      -- renders audio/image/passage for current group
│   └── AudioPlayer
│       └── useAudioPlayer(stimulusId, mode, attemptId)
│           ├── Handles auto-play on mount
│           ├── Checks played-set (full mode: play once)
│           ├── Handles 403 retry (REQ-084)
│           └── Shows error state (REQ-085)
├── QuestionCard
│   ├── Choice buttons (A/B/C/D)
│   ├── Confirm button (practice mode -- REQ-043)
│   └── Feedback section (practice mode -- REQ-042)
│       ├── Correct/incorrect indicator
│       ├── Correct answer highlight
│       └── explanation_vi display (REQ-021)
└── Submit button / auto-submit handler
```

**Audio-once enforcement (client + server backstop):**
```typescript
// useAudioPlayer.ts
function useAudioPlayer(stimulusId: string, mode: 'full' | 'practice', attemptId: string) {
  const [playedSet] = useState(() => new Set<string>()); // hydrated on mount from server
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (mode === 'full') {
      // Hydrate played set from server on first load
      api.getAudioPlayed(attemptId).then(ids => ids.forEach(id => playedSet.add(id)));
    }
  }, [attemptId]);

  const play = useCallback(() => {
    if (mode === 'full' && playedSet.has(stimulusId)) return; // already played

    audioRef.current?.play().catch(() => setError(true));

    if (mode === 'full') {
      playedSet.add(stimulusId);
      api.recordAudioPlayed(attemptId, stimulusId); // fire-and-forget POST
    }
  }, [stimulusId, mode]);

  // ... error handling, 403 retry ...
}
```

---

## 11. Cross-Cutting NFRs

### Security

| Concern | Approach | REQs |
|---------|---------|------|
| Authentication | JWT HS256, 15-min access, 7-day refresh (HttpOnly cookie) | NFR-004, NFR-005 |
| Authorization | RolesGuard on every route; ownership checks in service layer | NFR-007 |
| Password storage | bcrypt, cost factor 12 | NFR-004 |
| Input validation | class-validator on all DTOs; NestJS ValidationPipe global | REQ-003, 009, 017, 018, 086 |
| SQL injection | TypeORM parameterized queries -- no raw string concatenation | -- |
| XSS | React's default JSX escaping; no dangerouslySetInnerHTML on user content | EC-011 |
| CSRF | SameSite=Strict on refresh token cookie; access token not in cookie | -- |
| File upload | Server-side MIME + size validation before S3 write; sanitized filenames | REQ-013, 086, 019 |
| Secrets | Environment variables; .env excluded from git; no secrets in source | -- |
| CORS | Whitelist frontend origin only | -- |
| Rate limiting | `@nestjs/throttler` on auth endpoints (10 req/min per IP) | -- |
| Audit logging | Structured logs for auth events, role changes, deactivations | REQ-062, 073 |

### Performance (NFR-001, NFR-002)

| Target | How addressed |
|--------|--------------|
| API p95 < 500ms at 200 concurrent | Single-process NestJS; PostgreSQL with proper indexes; no inter-service hops |
| Score < 5s post-submit | Synchronous scoring; simple COUNT + lookup; no queuing |
| Pre-signed URL generation | S3 SDK generates URLs locally (no S3 roundtrip) -- ~1ms |
| Question fetch with audio URLs | Batch URL generation; paginated response to avoid large payloads |

**Database indexes** (listed above with each table) cover all query paths.

**Connection pooling:** TypeORM + `pg` driver with pool size 10 (tunable). At 200 concurrent users, most requests are stateless reads; 10 pool connections suffice with short query times.

### Scalability Path

```
Current design ceiling:  ~500 concurrent users (single NestJS + single PostgreSQL)

To scale beyond:
1. Add NestJS replicas behind a load balancer (stateless -- JWT, no sessions)
2. Add PostgreSQL read replica for read-heavy endpoints (test listing, review)
3. Move cron job to a dedicated worker if overlap becomes an issue
4. Add Redis for rate limiting if @nestjs/throttler in-memory store is insufficient
5. CDN for React static assets (already the default -- Nginx/CloudFront)
6. S3 + CloudFront for audio delivery at high concurrency
```

### Observability

| Pillar | Implementation |
|--------|---------------|
| **Logging** | `@nestjs/common` Logger + pino for structured JSON in production. Log: request method, path, status, duration, userId. Never log: passwords, tokens, PII in body |
| **Health check** | `GET /api/v1/health` -- checks DB connection, S3 reachability. Used by container orchestrator. |
| **Error tracking** | Global exception filter logs all unhandled errors with stack trace. Optionally integrate Sentry. |
| **Metrics** | At MVP: request count + latency via logging. Future: Prometheus metrics via `@willsoto/nestjs-prometheus`. |
| **Audio error rate** (NFR-008) | Frontend logs audio play errors to `POST /api/v1/telemetry/audio-error` (fire-and-forget); server aggregates in logs for 7-day window monitoring. |

### Error Handling

**Global exception filter:**
```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = 500;
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message;
    }

    // Never expose stack trace to client
    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status],
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });

    // Log full error server-side
    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception);
    }
  }
}
```

---

## 12. Architectural Decision Records

### ADR-001: Attempt Expiry Mechanism (I-005)

- **Decision:** Hybrid lazy evaluation + cron sweep (every 60s)
- **Rationale:** Handles both the common case (learner returns) and edge case (browser closed, EC-004) without external infrastructure. Precision within 60s is acceptable for expired exams.
- **Alternatives rejected:**
  - Per-attempt scheduled job (Bull/Redis): adds infrastructure complexity for a low-volume background task
  - Lazy-only: leaves abandoned attempts in-progress forever; corrupts data
  - Cron-only: up to 60s delay on every expiry, including when learner is present
- **Trade-offs:** 60s worst-case delay for abandoned attempts; acceptable.

### ADR-002: Audio-Played Tracking (C-003)

- **Decision:** Separate `attempt_audio_plays` join table (not JSONB on attempt row)
- **Rationale:** Simple existence check via unique index; FK integrity on stimulus_id; append-only writes are PostgreSQL-friendly; avoids JSONB array manipulation in concurrent writes.
- **Alternatives rejected:**
  - JSONB array on attempt: concurrent-write safety requires row-level locking; harder to index for single-stimulus lookup
  - Client-only tracking: violates REQ-081 (server must enforce); spoofable
- **Trade-offs:** Extra table; negligible storage overhead (~100 rows per full-test attempt).

### ADR-003: Modular Monolith (Architecture Style)

- **Decision:** Single NestJS process with domain modules
- **Rationale:** Small team; bounded contexts are clear but simple; no independent scaling needed at 200 concurrent users; minimizes latency (no inter-service calls); one deployment unit.
- **Alternatives rejected:**
  - Microservices: operational overhead (service mesh, distributed tracing, separate DBs) unjustified for team size and load
  - Serverless functions: cold starts harm NFR-001; stateful timer logic needs persistent process
- **Trade-offs:** Cannot scale modules independently; acceptable at MVP load.

### ADR-004: No Redis at MVP

- **Decision:** PostgreSQL as the sole data store; no Redis cache
- **Rationale:** At 200 concurrent users, query load is well within PostgreSQL capability. Adding Redis would increase operational complexity (another service to deploy, monitor, handle failures) for minimal latency benefit.
- **Revisit trigger:** If p95 > 500ms under load test, add Redis for hot read paths (test listing, conversion table).

### ADR-005: Zustand + TanStack Query (Frontend State)

- **Decision:** Zustand for auth; TanStack Query for server state
- **Rationale:** Minimal boilerplate; TanStack Query handles caching, refetch, pagination natively; no Redux reducer ceremony for a CRUD app with ~3 global state values.
- **Alternatives rejected:**
  - Redux Toolkit: heavy for this app's complexity
  - React Context only: lacks caching, background refetch, optimistic updates

### ADR-006: Storage Adapter Abstraction (I-002)

- **Decision:** `FileStorageAdapter` interface with S3 implementation; swappable to GCS/R2/local
- **Rationale:** OQ-2 not finalized. Design the interface once; swap implementation via DI. Development uses local adapter; production uses S3 (or confirmed alternative).
- **Trade-offs:** Slight over-engineering if S3 is confirmed; but the abstraction is thin (3 methods) and costs nothing at runtime.

### ADR-007: Swappable Score Conversion Strategy (I-001)

- **Decision:** Strategy pattern for score conversion (database lookup vs. approximate formula)
- **Rationale:** OQ-1 copyright issue may prevent seeding the official ETS table. The approximate strategy lets us ship scoring (REQ-070..074) regardless. The database strategy activates when/if the table is seeded.
- **Trade-offs:** Approximate scores may not perfectly match ETS; documented in learner-facing UI as "estimated."

### ADR-008: JWT HS256 for MVP

- **Decision:** HS256 symmetric signing for JWT access tokens
- **Rationale:** Single API server; no token validation by third parties; HS256 is faster than RS256. Secret managed via environment variable.
- **Revisit trigger:** If a second backend service needs to validate tokens independently, migrate to RS256 with JWKS endpoint.

### ADR-009: Published Test Edit Policy (I-003)

- **Decision (recommendation to product):** Unpublish-first before editing. A version column on tests enables optimistic locking.
- **Rationale:** Editing a published test while learners have in-progress attempts risks inconsistency (e.g., changing the correct answer mid-exam). Unpublish + version increment + re-publish is safer. Active in-progress attempts continue against the version they started; new attempts see the updated version.
- **If product decides edit-in-place:** Add a `test_version` FK to attempts so each attempt is tied to a snapshot. This is more complex and deferred unless explicitly requested.
- **Status:** Recommendation; awaiting OQ-4 decision.

### ADR-010: Pre-signed URL Validity and Refresh

- **Decision:** 15-minute validity (REQ-083); frontend retries on 403 with fresh URL request
- **Rationale:** 15 minutes covers the expected interaction time per question/group. If the learner idles longer, the transparent refresh flow (REQ-084) handles it without user disruption. Shorter URLs (e.g., 5 min) would cause more refresh roundtrips; longer (e.g., 60 min) increases the window for URL sharing.

### ADR-011: Refresh Token as HttpOnly Cookie

- **Decision:** Refresh token delivered as HttpOnly, Secure, SameSite=Strict cookie; access token in response body (stored in JS memory)
- **Rationale:** Refresh token in HttpOnly cookie is not accessible to JS (XSS-safe). Access token in memory (not localStorage) avoids persistent XSS exposure. SameSite=Strict prevents CSRF.
- **Trade-offs:** Access token lost on page refresh; recovered via silent refresh call. Minor UX cost (one extra request on page load).

---

## 13. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R-001 | ETS conversion table unavailable (I-001) | Medium | Medium | Swappable strategy (ADR-007); ship with approximate formula |
| R-002 | S3 provider not confirmed (I-002) | Low | Medium | Storage abstraction (ADR-006); develop against local adapter |
| R-003 | Edit-published-test policy unclear (I-003) | Medium | High | Recommend unpublish-first (ADR-009); block editing until decision |
| R-004 | Max concurrent users unknown (I-004) | Medium | Low | Design for 200 (NFR-001); document scaling path; load test before launch |
| R-005 | Audio playback unreliable on mobile browsers | Medium | Medium | Test on Chrome Mobile, Safari; fallback message (REQ-085); NFR-008 monitoring |
| R-006 | Single PostgreSQL instance is SPOF | Low | High | Automated backups; document failover procedure; add read replica if SLA requires |
| R-007 | Cron sweep misses attempt expiry in clustered deployment | Low | Medium | At MVP: single instance, no issue. Multi-instance: use pg_advisory_lock in cron job to ensure only one instance sweeps |
| R-008 | Large audio files causing slow uploads | Low | Low | Stream to S3 (NFR-006); show upload progress in UI; reject > 20MB server-side |
| R-009 | Clock skew between client and server affects timer | Low | Low | Server-authoritative timer (REQ-031); client syncs offset on load and every 30s |
| R-010 | i18n key coverage drift (VI translations lag behind EN) | Medium | Low | CI check: compare EN and VI key sets; warn on missing VI keys in build |

### Feedback to Product/Requirements

1. **I-003 (OQ-4) must be decided before Sprint 2.** The recommended approach (unpublish-first) is simpler and safer. If edit-in-place is chosen, the data model needs a test versioning layer that adds 2-3 days of work.

2. **I-001 (OQ-1) does not block Sprint 1-2 implementation** but blocks data seeding. The approximate formula is a viable permanent fallback if ETS copyright cannot be resolved.

3. **I-004 (OQ-5) is non-blocking for architecture** (design handles 200 concurrent per NFR-001) but blocks infrastructure procurement. A concrete number is needed before production deployment for pool sizing and instance count.

4. **REQ-046 (practice session resume):** Currently SHOULD priority. The architecture supports it (attempt + answers persisted server-side). The frontend needs a "resume" UX flow; recommend including in Sprint 2.

5. **Email delivery for password reset (REQ-006):** No email service is specified in the stack. Recommend Resend, SendGrid, or AWS SES. This is a new infrastructure dependency that should be confirmed alongside OQ-2.

---

## Decisions Log

| D-ID | Decision | Chosen | Rejected | Date |
|------|---------|--------|---------|------|
| D-001 | Attempt expiry mechanism | Hybrid: lazy + cron (60s) | Per-attempt job queue; lazy-only; cron-only | 2026-06-07 |
| D-002 | Audio-played tracking | Join table (attempt_audio_plays) | JSONB on attempt; client-only | 2026-06-07 |
| D-003 | Architecture style | Modular monolith (NestJS modules) | Microservices; serverless | 2026-06-07 |
| D-004 | Caching layer | None (PostgreSQL only at MVP) | Redis | 2026-06-07 |
| D-005 | Frontend state management | Zustand + TanStack Query | Redux; Context-only | 2026-06-07 |
| D-006 | File storage abstraction | FileStorageAdapter interface | Direct S3 SDK coupling | 2026-06-07 |
| D-007 | Score conversion | Swappable strategy (DB or approximate) | DB-only (blocks on I-001) | 2026-06-07 |
| D-008 | JWT signing algorithm | HS256 | RS256 | 2026-06-07 |
| D-009 | Published test edit policy | Unpublish-first (recommended) | Edit-in-place | 2026-06-07 |
| D-010 | Pre-signed URL validity | 15 min + frontend 403-retry | 60 min (long-lived); 5 min (frequent refresh) | 2026-06-07 |
| D-011 | Refresh token delivery | HttpOnly cookie | Response body + localStorage | 2026-06-07 |
