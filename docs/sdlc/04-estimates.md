# Estimates — TOEIC Learning Platform
**Date:** 2026-06-07  **Author:** @estimator  **Status:** REVIEWED
**Sources:** `docs/sdlc/01-product-spec.md`, `docs/sdlc/02-requirements.md`, `docs/sdlc/03-architecture.md`

---

## Estimation Conventions

| Points | Days (1 dev) | Meaning |
|--------|-------------|---------|
| 1 | < 0.5 | Trivial — mechanical, no unknowns |
| 2 | ~1 | Simple — clear path, minimal risk |
| 3 | ~2 | Medium — some complexity or cross-cutting |
| 5 | ~3-4 | Complex — significant unknowns or integration |
| 8 | ~1 week | Very complex — needs discovery/spike |
| 13 | > 1 week | Must be decomposed further (not used here) |

**Inflation factors applied where noted:**
- Unfamiliar or new library: ×1.5
- External dependency (email provider, S3 SDK): ×1.5
- No existing test harness for area: ×1.3
- Ambiguous requirement: ×1.5

**Team assumption:** 2 full-stack engineers. Velocity: ~20 story points per engineer per 2-week sprint (100% focused; no support load). A two-person sprint delivers ~40 points. Estimates are for a fully focused engineer without context-switching overhead; pad the sprint plan for 20% slack.

**What 1 point means here:** approximately 0.5 person-day of focused implementation + basic unit test coverage.

---

## Task Breakdown

### Module 0: Project Setup & Shared Infrastructure
Tasks that unblock all other modules. Must be completed first.

| Task ID | Description | Layer | Story | Points | Days (likely) | Depends on | Risk |
|---------|-------------|-------|-------|--------|--------------|-----------|------|
| T-001 | Scaffold NestJS monorepo: project init, tsconfig, ESLint, Prettier, Jest, env config | infra | All | 2 | ~1 | — | low |
| T-002 | Set up PostgreSQL locally + docker-compose dev stack (Postgres, optional local S3 via LocalStack or MinIO) | infra | All | 2 | ~1 | T-001 | low |
| T-003 | TypeORM config, migrations setup, base entity class (createdAt/updatedAt), migration runner script | backend | All | 2 | ~1 | T-002 | low |
| T-004 | Shared NestJS infrastructure: GlobalValidationPipe, GlobalExceptionFilter (standard error shape), LoggingInterceptor, JwtAuthGuard skeleton, RolesGuard skeleton | backend | All | 3 | ~2 | T-001 | low |
| T-005 | Scaffold React SPA: Vite, TypeScript, React Router v6, TanStack Query setup, Zustand, Axios client with interceptors (401 refresh retry) | infra | All | 3 | ~2 | — | low |
| T-006 | i18n scaffolding: react-i18next + i18next-http-backend, locale file structure (en/vi × 6 namespaces), LocaleSwitcher component, locale persistence in localStorage + Zustand | frontend | REQ-023..027 | 3 | ~2 | T-005 | low |
| T-007 | CI pipeline: GitHub Actions for lint, test, build; add i18n key-drift check (diff EN vs VI key sets, fail on missing VI keys) | infra | REQ-023 | 3 | ~2 | T-005 T-006 | medium |
| T-008 | Write all 12 i18n locale files (en+vi × 6 namespaces) with full UI string coverage; enforce naming convention | frontend | REQ-023..027 | 5 | ~3 | T-006 | medium |

**Module 0 subtotal: 23 points**

Risk note on T-007: CI key-drift check is a custom script; no established NestJS/React pattern to copy — allocate extra time if team is unfamiliar with the toolchain. T-008 is frontend-heavy content work; quality of Vietnamese translations depends on a native speaker being available.

---

### Module 1: Auth (US-001, REQ-001..009, NFR-004/005)

| Task ID | Description | Layer | Story | Points | Days (likely) | Depends on | Risk |
|---------|-------------|-------|-------|--------|--------------|-----------|------|
| T-101 | DB migration: users table + uq_users_email index; refresh_tokens table + indexes; password_reset_tokens table | database | US-001 | 2 | ~1 | T-003 | low |
| T-102 | AuthModule + UserModule scaffold: module files, controllers, services, TypeORM entities | backend | US-001 | 2 | ~1 | T-004 T-101 | low |
| T-103 | Registration endpoint: POST /auth/register — email normalization, password validation (>=8ch, >=1num), bcrypt hash (cost 12), JWT pair issuance; REQ-001..005, 008, 009, NFR-003/004 | backend | US-001 | 3 | ~2 | T-102 | low |
| T-104 | Login endpoint: POST /auth/login — bcrypt compare, status check, JWT pair; refresh endpoint /auth/refresh — HttpOnly cookie extraction, rotation; logout /auth/logout — revoke refresh token; NFR-005 | backend | US-001 | 3 | ~2 | T-103 | low |
| T-105 | Password reset: POST /auth/password-reset-request + POST /auth/password-reset — token generation, 30-min expiry, single-use enforcement, 410 for expired/used; REQ-006, REQ-007 | backend | US-001 | 3 | ~2 | T-104 | medium |
| T-106 | Email service integration: plug in email provider (Resend/SendGrid/SES — OQ-2 must be resolved first); send reset link; abstract behind EmailService interface for testability | backend | US-001 REQ-006 | 3 | ~2 | T-105 | high |
| T-107 | JwtAuthGuard + JwtStrategy (Passport) wired; RolesGuard with @Roles decorator; deactivated-user block on login (status check); REQ-061/062 | backend | US-001 | 2 | ~1 | T-104 | low |
| T-108 | GET /users/me + PATCH /users/me (display name, locale preference); REQ-024 | backend | US-001 | 2 | ~1 | T-102 | low |
| T-109 | Backend unit tests: registration happy path, duplicate email 409, weak password 422, login invalid 401, refresh rotation, reset token expiry 410 | test | US-001 | 3 | ~2 | T-108 | low |
| T-110 | Frontend: LoginPage + RegisterPage + PasswordResetPage; forms with validation, error display; authStore (Zustand) with accessToken; silent refresh on page load | frontend | US-001 | 5 | ~3-4 | T-005 T-006 T-104 | low |
| T-111 | Frontend: ProtectedRoute wrapper (role-aware); Header with user menu + locale switcher; redirect logic on 401 | frontend | US-001 | 2 | ~1 | T-110 | low |

**Module 1 subtotal: 30 points**

Risk note on T-106: email provider must be confirmed (OQ-2) before Sprint 1 file. If provider is not chosen before dev begins, stub the EmailService and mark REQ-006 as integration-pending. High risk of environment-specific issues (DKIM, spam filters, sandbox limits).

---

### Module 2: Test Authoring (US-002, REQ-010..020, REQ-086)

| Task ID | Description | Layer | Story | Points | Days (likely) | Depends on | Risk |
|---------|-------------|-------|-------|--------|--------------|-----------|------|
| T-201 | DB migrations: tests, parts, stimuli, questions, choices tables with all indexes and constraints | database | US-002 | 3 | ~2 | T-003 | low |
| T-202 | TestModule scaffold: entities (Test, Part, Stimulus, Question, Choice), repositories, module wiring | backend | US-002 | 2 | ~1 | T-004 T-201 | low |
| T-203 | POST /tests: create draft + auto-scaffold 7 parts (Part 1-7 with target_question_count); REQ-010, 018 | backend | US-002 | 2 | ~1 | T-202 | low |
| T-204 | GET /tests (paginated, role-filtered: draft invisible to Learner), GET /tests/:id, PATCH /tests/:id, DELETE /tests/:id (draft only); REQ-014, 018 | backend | US-002 | 3 | ~2 | T-203 | low |
| T-205 | Question CRUD: POST parts/:partId/questions (4 choices, exactly 1 correct, explanation_vi nullable <=5000ch), PATCH /questions/:id, DELETE /questions/:id; REQ-011, 017, 020 | backend | US-002 | 3 | ~2 | T-202 | low |
| T-206 | Stimulus CRUD: POST parts/:partId/stimuli (text passage OR reference to uploaded file), PATCH /stimuli/:id, DELETE /stimuli/:id; question.stimulus_id FK wiring; REQ-012, 013 | backend | US-002 | 3 | ~2 | T-202 T-301 | medium |
| T-207 | Publish workflow: POST /tests/:id/publish (reject if any part has 0 questions), POST /tests/:id/unpublish (if no in-progress attempts); REQ-015, I-003/ADR-009 | backend | US-002 | 3 | ~2 | T-204 T-205 | low |
| T-208 | Backend tests: create test+scaffold, question validation (!=4 choices 422, !=1 correct 422), publish rejection, title/description length | test | US-002 | 3 | ~2 | T-207 | low |
| T-209 | Frontend: TestEditorPage — create/edit test metadata, part list with question counts, publish/unpublish button | frontend | US-002 | 3 | ~2 | T-005 T-006 T-204 | low |
| T-210 | Frontend: PartEditorPage — list questions in a part, add/edit/delete question (QuestionEditorForm: text, 4 choices, correct toggle, explanation_vi textarea); REQ-020 | frontend | US-002 | 5 | ~3-4 | T-209 T-205 | low |
| T-211 | Frontend: stimulus authoring UI — upload audio/image (shows progress), attach to part; passage text input for Parts 6/7; REQ-012, 013 | frontend | US-002 | 3 | ~2 | T-210 T-303 | medium |

**Module 2 subtotal: 33 points**

Risk note on T-206/T-211: depends on File module (T-301..T-303) being available for the upload flow. Sequence these so File module is in place before stimulus upload UI is wired. T-210 is the most complex authoring task — 5pt reflects the compound form state (4 choices, correct radio, explanation_vi, sequence reordering).

---

### Module 3: File & Audio Storage (US-002, US-008, REQ-013, 083..086)

| Task ID | Description | Layer | Story | Points | Days (likely) | Depends on | Risk |
|---------|-------------|-------|-------|--------|--------------|-----------|------|
| T-301 | FileStorageAdapter interface + LocalStorageAdapter for dev (store to /tmp, serve via static route); module + DI wiring | backend | US-002 | 3 | ~2 | T-004 | low |
| T-302 | S3StorageAdapter: @aws-sdk/client-s3 + @aws-sdk/lib-storage streaming upload; getPresignedUrl (900s); delete; env vars (bucket, region, credentials) | backend | US-002 | 3 | ~2 | T-301 | medium |
| T-303 | POST /files/upload endpoint: multer FileInterceptor streaming config, MIME validation (audio/mpeg|aac <=20MB, image/jpeg|png <=5MB), storage key generation, filename sanitization; REQ-013, 019, 086, NFR-006 | backend | US-008 | 3 | ~2 | T-302 | low |
| T-304 | GET /files/:key/url endpoint: generate fresh pre-signed URL on demand (for 403-retry flow); REQ-083, 084 | backend | US-008 | 2 | ~1 | T-302 | low |
| T-305 | Frontend: useAudioPlayer hook — auto-play on mount, full-test played-set enforcement (hydrate from server on session start), 403-retry with GET /files/:key/url refresh, error state fallback; REQ-080..085 | frontend | US-008 | 5 | ~3-4 | T-304 | medium |
| T-306 | Frontend: AudioPlayer component wrapping HTML5 <audio>; StimulusDisplay (audio/image/passage variants); Replay button (practice mode only); REQ-080..082, 085 | frontend | US-008 | 3 | ~2 | T-305 | low |
| T-307 | Backend tests: upload MIME rejection 422, oversized file 422, pre-signed URL endpoint, LocalAdapter unit tests | test | US-008 | 2 | ~1 | T-303 T-304 | low |

**Module 3 subtotal: 21 points**

Risk note on T-302: S3 provider must be confirmed (OQ-2) before this can be deployed to staging. Dev proceeds with LocalStorageAdapter. T-305 is medium risk — audio-once enforcement in the browser has subtle edge cases: navigation away and return, concurrent questions in the same stimulus group, race conditions between hydrate and play events.

---

### Module 4: Full Test Taking (US-003, REQ-030..039)

| Task ID | Description | Layer | Story | Points | Days (likely) | Depends on | Risk |
|---------|-------------|-------|-------|--------|--------------|-----------|------|
| T-401 | DB migrations: attempts, attempt_answers, attempt_audio_plays tables with all indexes including partial unique index on in-progress full attempts | database | US-003 | 2 | ~1 | T-201 | low |
| T-402 | AttemptModule scaffold: entities, repositories, module wiring, inject ScoringModule + FileModule + TestModule | backend | US-003 | 2 | ~1 | T-004 T-401 | low |
| T-403 | POST /attempts (start or resume): startOrResume logic, in-progress uniqueness check (REQ-037), expiresAt computation, ensureNotExpired lazy check; REQ-030, 036, 037 | backend | US-003 | 3 | ~2 | T-402 T-202 | low |
| T-404 | GET /attempts/:id (state + timer remaining), GET /attempts/:id/timer (lightweight poll); server time in response for client offset; REQ-031 | backend | US-003 | 2 | ~1 | T-403 | low |
| T-405 | GET /attempts/:id/questions (paginated, pre-signed URLs embedded per audio stimulus, audioAlreadyPlayed flag); REQ-080, 081 | backend | US-003 | 3 | ~2 | T-403 T-304 | low |
| T-406 | POST /attempts/:id/answers: save/upsert answer, compute is_correct, gate on in-progress status; POST /attempts/:id/audio-played + GET played list; REQ-035, 043, 080, 081 | backend | US-003 | 3 | ~2 | T-403 | low |
| T-407 | POST /attempts/:id/submit: state machine transition, trigger ScoringService.computeAndPersist, return scores; REQ-033..035, NFR-002 | backend | US-003 | 3 | ~2 | T-403 T-501 | low |
| T-408 | AttemptExpiryJob (cron sweep every 60s): SchedulerModule with @nestjs/schedule, find expired in-progress full attempts (indexed), expireAttempt with CAS update, trigger scoring; D-001 | backend | US-003 | 3 | ~2 | T-407 | medium |
| T-409 | Backend tests: start attempt, resume existing, timer expiry (lazy + cron), double-expiry CAS safety, answer-after-submit rejection, auto-submit on expiry | test | US-003 | 5 | ~3-4 | T-408 | medium |
| T-410 | Frontend: ExamRunnerPage — question navigator grid, question/stimulus rendering, answer selection; useAttempt hook (answer save, optimistic update) | frontend | US-003 | 5 | ~3-4 | T-005 T-306 T-405 | low |
| T-411 | Frontend: useTimer hook — server-synced countdown (poll every 30s), clock-skew offset, auto-submit when reaches 0; ExamTimer component; REQ-031, 033 | frontend | US-003 | 3 | ~2 | T-404 T-410 | medium |
| T-412 | Frontend: submit flow — unanswered questions confirmation dialog (REQ-034), ExamCompletePage with score display; REQ-039, NFR-002 | frontend | US-003 | 2 | ~1 | T-411 T-601 | low |

**Module 4 subtotal: 36 points**

Risk note on T-408: cron expiry is straightforward at single-instance MVP, but the CAS logic and error handling need solid test coverage. T-411 (timer) has medium risk from browser tab-backgrounding (setInterval throttling in mobile Safari) — spike recommended if mobile is a priority. T-409 is 5pt because the time-dependent tests (expiry) require careful mocking of Date.now() and the cron trigger.

---

### Module 5: Scoring (US-007, REQ-070..075)

| Task ID | Description | Layer | Story | Points | Days (likely) | Depends on | Risk |
|---------|-------------|-------|-------|--------|--------------|-----------|------|
| T-501 | DB migration: scores table, score_conversion_table with unique (section, raw_score) constraint | database | US-007 | 2 | ~1 | T-401 | low |
| T-502 | ScoringModule scaffold: entities, services, ConversionStrategy interface + DatabaseConversionStrategy + ApproximateConversionStrategy; DI via env config; D-007 | backend | US-007 | 3 | ~2 | T-004 T-501 | low |
| T-503 | ScoringService.computeAndPersist: COUNT correct answers per section (listening P1-4, reading P5-7), lookup conversion, persist 3 score rows (L, R, total), missing-table handling + admin alert log; REQ-070..074 | backend | US-007 | 3 | ~2 | T-502 | low |
| T-504 | GET /attempts/:id/scores endpoint: return scores for completed attempt; REQ-070 | backend | US-007 | 1 | ~0.5 | T-503 | low |
| T-505 | POST /admin/score-conversion-table: bulk seed/replace 202 rows (101 per section), validation (0..100 raw, 5..495 scaled, boundaries); REQ-075 | backend | US-007 | 3 | ~2 | T-502 | low |
| T-506 | Backend tests: raw computation accuracy, boundary values (raw 0->5, raw 100->495), missing conversion entry (scaled_unavailable=true + log), practice mode skips conversion | test | US-007 | 3 | ~2 | T-505 | medium |

**Module 5 subtotal: 15 points**

Risk note on T-506: boundary and missing-entry behavior must be tested precisely; the swappable strategy adds a branch to cover for each strategy. T-505 (admin seeding) is blocked by OQ-1 for real ETS data, but the endpoint itself can be built and tested with synthetic data.

---

### Module 6: Practice Mode (US-004, REQ-040..046)

| Task ID | Description | Layer | Story | Points | Days (likely) | Depends on | Risk |
|---------|-------------|-------|-------|--------|--------------|-----------|------|
| T-601 | Practice attempt creation: POST /attempts with mode=practice + partId; no expiresAt; separate path in startOrResume | backend | US-004 | 2 | ~1 | T-403 | low |
| T-602 | Instant feedback on answer confirm: POST /attempts/:id/answers returns is_correct, correct_choice_id, explanation_vi (or null fallback); REQ-042, 043 | backend | US-004 | 2 | ~1 | T-406 | low |
| T-603 | Practice completion: GET /attempts/:id/scores returns raw count only (no scaled); REQ-044, 074 | backend | US-004 | 1 | ~0.5 | T-503 | low |
| T-604 | Frontend: practice mode ExamRunnerPage variant — no timer, confirm button, instant feedback panel (correct/incorrect, correct answer highlight, explanation_vi display or fallback), Replay button visible; REQ-021, 041..043, 045 | frontend | US-004 | 5 | ~3-4 | T-306 T-410 T-602 | low |
| T-605 | Frontend: answer-locked state on back-navigation in practice (locked answer display); REQ-043 | frontend | US-004 | 2 | ~1 | T-604 | low |
| T-606 | Practice raw-score completion screen (raw X of Y); REQ-044 | frontend | US-004 | 1 | ~0.5 | T-604 | low |

**Module 6 subtotal: 13 points**

Note: REQ-046 (practice session resume, SHOULD) is architecture-supported (answers persisted server-side). The backend already handles this via startOrResume logic; the cost is entirely in the frontend "resume" UX prompt. Allocated separately below as T-607 (Sprint 2 optional):

T-607 (Sprint 2, SHOULD): Frontend: detect existing in-progress practice attempt on test start; prompt "resume or restart"; 2 points, ~1 day.

---

### Module 7: Result Review (US-005, REQ-050..054)

| Task ID | Description | Layer | Story | Points | Days (likely) | Depends on | Risk |
|---------|-------------|-------|-------|--------|--------------|-----------|------|
| T-701 | GET /attempts/me: paginated list of learner's completed attempts (submitted + expired), most-recent-first; REQ-050 | backend | US-005 | 2 | ~1 | T-403 | low |
| T-702 | GET /attempts/:id/review: full review payload — all questions with learner answer, correct answer, is_correct, explanation_vi, stimulus grouped once; query param ?wrongOnly=true; REQ-051, 052, 054 | backend | US-005 | 3 | ~2 | T-405 T-503 | low |
| T-703 | Backend tests: review payload shape (stimulus grouped once), wrong-only filter, explanation_vi null fallback | test | US-005 | 2 | ~1 | T-702 | low |
| T-704 | Frontend: MyResultsPage — paginated attempt list, attempt card (date, mode, score), link to review | frontend | US-005 | 2 | ~1 | T-005 T-701 | low |
| T-705 | Frontend: AttemptReviewPage — ReviewQuestionCard (question, choices, learner answer highlighted, correct answer highlighted, explanation_vi or fallback), stimulus rendered once per group (StimulusDisplay), WrongOnlyToggle; REQ-021, 022, 051..054 | frontend | US-005 | 5 | ~3-4 | T-704 T-306 T-702 | low |
| T-706 | Frontend: audio replay in review mode (REQ-053, SHOULD); Replay button always visible, no play-count enforcement in review context | frontend | US-005 | 1 | ~0.5 | T-305 T-705 | low |

**Module 7 subtotal: 15 points**

Note: T-705 is the heaviest frontend task in this module — the compound card state (learner answer, correct answer, explanation_vi, stimulus grouping) requires careful composition.

---

### Module 8: Admin User Management (US-006, REQ-060..065)

| Task ID | Description | Layer | Story | Points | Days (likely) | Depends on | Risk |
|---------|-------------|-------|-------|--------|--------------|-----------|------|
| T-801 | AdminModule scaffold: AdminUserController, AdminUserService, RolesGuard(Admin) wiring | backend | US-006 | 1 | ~0.5 | T-107 | low |
| T-802 | GET /admin/users: paginated user list, search by email, filter by role; REQ-060, 065 | backend | US-006 | 2 | ~1 | T-801 | low |
| T-803 | PATCH /admin/users/:id/role: role change with self-protection; POST /admin/users/:id/deactivate (revoke all refresh tokens); POST /admin/users/:id/reactivate; REQ-061..064 | backend | US-006 | 3 | ~2 | T-802 | low |
| T-804 | Backend tests: self-deactivation 403, self-role-change 403, deactivation revokes refresh tokens, reactivation, role effective on next refresh | test | US-006 | 3 | ~2 | T-803 | low |
| T-805 | Frontend: UserManagementPage — paginated user table with search/role filter, inline role change, deactivate/reactivate buttons, confirmation dialogs | frontend | US-006 | 3 | ~2 | T-005 T-006 T-803 | low |

**Module 8 subtotal: 12 points**

---

### Module 9: Cross-Cutting & NFRs

| Task ID | Description | Layer | Story | Points | Days (likely) | Depends on | Risk |
|---------|-------------|-------|-------|--------|--------------|-----------|------|
| T-901 | @nestjs/throttler rate limiting on auth endpoints (10 req/min per IP); CORS whitelist frontend origin | backend | NFR | 2 | ~1 | T-101 | low |
| T-902 | Health check endpoint GET /api/v1/health (DB ping, S3 reachability); structured pino logging in production | backend | NFR | 2 | ~1 | T-302 | low |
| T-903 | Frontend telemetry: POST /api/v1/telemetry/audio-error (fire-and-forget) — audio play error logging for NFR-008 monitoring | backend+frontend | NFR-008 | 2 | ~1 | T-306 | low |
| T-904 | E2E test suite skeleton (Playwright or Cypress): auth flow, start test, answer questions, submit, view score; covers happy path for Sprint 1 vertical slice | test | All | 5 | ~3-4 | T-412 | medium |
| T-905 | Load test script (k6 or Artillery): 200 concurrent users, verify p95 < 500ms on GET /attempts/:id/questions; NFR-001 | test | NFR-001 | 3 | ~2 | T-405 | medium |

**Module 9 subtotal: 14 points**

---

## Spike Tasks

| Spike ID | Question to answer | Blocking | Time-box |
|----------|--------------------|---------|---------|
| SP-001 | Timer reliability on mobile (Safari/Chrome Mobile): does setInterval throttle when tab is backgrounded? Is 30s server-sync sufficient to prevent > 60s drift? | T-411 | 1 day |
| SP-002 | Audio-once enforcement edge cases: what happens if a learner opens the exam in two browser tabs simultaneously? Does the server-side played-set backstop prevent double play reliably? | T-305 T-406 | 0.5 day |
| SP-003 | Email provider selection and sandbox setup (Resend vs. SendGrid vs. SES): DKIM, deliverability, sandbox limits, pricing; output: provider decision + working dev integration | T-106 | 0.5 day |

---

## Total Estimate

### Points by Module

| Module | Points |
|--------|--------|
| M0: Setup & Shared Infra | 23 |
| M1: Auth | 30 |
| M2: Test Authoring | 33 |
| M3: File & Audio Storage | 21 |
| M4: Full Test Taking | 36 |
| M5: Scoring | 15 |
| M6: Practice Mode | 13 |
| M7: Result Review | 15 |
| M8: Admin | 12 |
| M9: Cross-Cutting / NFRs | 14 |
| Spikes (3 × 1 day avg) | 5 |
| **Total** | **217** |

### Points by User Story

| Story | Points | Sprint target |
|-------|--------|--------------|
| US-001 Auth | 30 | Sprint 1 |
| US-002 Test Authoring | 33 | Sprint 1 |
| US-003 Full Test | 36 | Sprint 1 |
| US-004 Practice | 13 | Sprint 1 |
| US-005 Result Review | 15 | Sprint 2 |
| US-006 Admin | 12 | Sprint 2 |
| US-007 Scoring | 15 | Sprint 1 (thin) + Sprint 2 (seeding) |
| US-008 Audio | 21 | Sprint 1 |
| Infra / NFR / i18n / CI | 37 | Sprint 1 foundation |
| Spikes | 5 | Sprint 1 kickoff |
| **Total** | **217** | |

### Calendar Estimate

| Scenario | Assumptions | Points | Calendar days (2 devs, 20pt/dev/sprint, ~80% focus) | Sprints |
|----------|-------------|--------|------------------------------------------------------|---------|
| Optimistic | No blockers (OQ-2/email/S3 resolved day 1, no rework) | 185 | ~46 working days | 2.5 × 2-week sprints |
| **Likely** | **OQ-2 blocked ~1 week, 1 sprint of rework/polish** | **217** | **~54 working days** | **3 × 2-week sprints** |
| Pessimistic | OQ-1 requires approximate-strategy pivot, OQ-4 unlocks edit-in-place (+10pt), mobile audio spike uncovers platform issues (+1 sprint) | 240 | ~60 working days | 4 × 2-week sprints |

**Confidence: Medium.** The scope is well-defined (57 REQs, 72 Gherkin scenarios), the architecture is decided (11 ADRs), and the data model is sketched in full DDL. Main uncertainty is external dependencies (email, storage provider, ETS table) and mobile audio behavior.

---

## Critical Path

Tasks that, if delayed, delay the whole delivery:

1. **T-001** (NestJS scaffold) → **T-003** (TypeORM + migrations) → **T-004** (shared guards) → **T-101** (auth DB migration) → **T-102** (AuthModule) → **T-103** (register) → **T-104** (login/refresh/JWT) → **T-107** (guards wired)
2. → **T-201** (test authoring DB migrations) → **T-401** (attempt DB migrations) → **T-501** (scoring DB migration)
3. → **T-402** (AttemptModule) → **T-403** (start/resume) → **T-407** (submit + scoring trigger) → **T-501..T-503** (scoring compute)
4. → **T-301..T-303** (file upload — unblocks stimulus attachment + audio URL generation)
5. → **T-405** (questions with audio URLs) → **T-410** (ExamRunnerPage) → **T-411** (timer) → **T-412** (submit + complete screen)

**Critical path length: 15 tasks across Modules 0, 1, 2, 3, 4, 5 — sequential minimum.**

The frontend (T-005, T-006, T-110, T-111) can be developed in parallel to the backend once the API contract is known. Wire-up tasks (T-410, T-411, T-412, T-705) are on the critical path because they integrate both sides.

---

## Sprint Plan Proposal

### Sprint 1 — Thin End-to-End Vertical Slice
**Goal:** A learner can register, a teacher can create and publish a minimal test (at least Part 5 text-only for simplicity), the learner can take the full test and see a raw + scaled score, and a practice attempt works.  
**Points budget: 2 devs × 20pt/sprint = 40pt target (sprint 1 foundation only)**

| Sprint | Tasks | Points | Notes |
|--------|-------|--------|-------|
| Sprint 1, Week 1 | T-001, T-002, T-003, T-004, T-005, T-006, SP-001, SP-002, SP-003 | 13+2.5 spikes | Setup + spike answers |
| Sprint 1, Week 2 | T-101, T-102, T-103, T-104, T-107, T-110, T-111 | 19 | Auth backend + thin auth frontend |
| Sprint 2, Week 1 | T-201, T-202, T-203, T-204, T-205, T-207, T-209, T-210 | 21 | Test authoring backend + basic authoring UI |
| Sprint 2, Week 2 | T-301, T-302, T-303, T-304, T-401, T-402, T-403, T-501, T-502, T-503 | 19 | File adapter + attempt + scoring (backend) |
| Sprint 3, Week 1 | T-404, T-405, T-406, T-407, T-408, T-409 | 19 | Full test backend completion + cron expiry |
| Sprint 3, Week 2 | T-410, T-411, T-412, T-601, T-602, T-603, T-604, T-605, T-606 | 20 | Exam runner + practice mode (frontend) |

At Sprint 3 end: the vertical slice is complete — auth + author test + take full/practice + score.

**Blocker dependencies for Sprint 1:**
- OQ-2 (storage provider): must be resolved before T-302 (S3 adapter). Dev uses LocalAdapter (T-301) — unblocked in Sprint 1.
- OQ-2 (email provider): SP-003 spike in Sprint 1 week 1 must yield a provider decision. T-106 blocked until resolved.
- OQ-5 (max concurrent users): non-blocking for Sprint 1 development; needed before production provisioning.

**After Sprint 3 vertical slice:** Sprint 4 covers M7 (Result Review: T-701..T-706), M8 (Admin: T-801..T-805), M9 (NFRs: T-901..T-905), T-105, T-106 (password reset), T-008 (full i18n files), T-007 (CI key-drift), T-208, T-703, T-804 (tests).

**Blocker for Sprint 4:**
- OQ-1 (ETS table): T-505 (admin seed endpoint) can be built; actual ETS data seeding blocked. Ship with approximate strategy (D-007), swap in when resolved.
- OQ-4 (edit published test): T-207 includes unpublish-first as recommended. If product chooses edit-in-place, add 2-3 days for version-snapshot logic — decide before Sprint 4 test authoring polish.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Email provider not confirmed before Sprint 1 (OQ-2) | Medium | High | SP-003 spike week 1; stub EmailService for dev; T-106 can be integration-tested in Sprint 4. REQ-006 has no functional dependency in the vertical slice. |
| S3 provider not confirmed (OQ-2) | Low | Medium | LocalStorageAdapter (T-301) unblocks all dev; T-302 S3 adapter is self-contained and can be swapped in when provider is confirmed. No architectural rework needed. |
| ETS conversion table copyright (OQ-1) | Medium | Medium | ApproximateConversionStrategy ships by default (D-007). Learner-facing UI labels score as "estimated" until table is seeded. T-505 endpoint ready for seeding when cleared. |
| Edit-published-test policy (OQ-4) | Medium | High | Unpublish-first is the default (ADR-009). If edit-in-place chosen, add T-X01 (test versioning snapshot, ~10pt) before Sprint 4 — must decide before Sprint 4 starts. |
| Mobile browser timer throttling (Safari setInterval) | Medium | Medium | SP-001 spike in Sprint 1. If throttling is confirmed, client auto-submit via timer becomes unreliable — server cron sweep (T-408) and lazy eval (T-403) are the authoritative backstop; this reduces severity. |
| Audio-once enforcement with dual tabs | Low | High | SP-002 spike. The server-side played-set (attempt_audio_plays) is the authoritative source; the second tab hydrates played-set from server before playing, so double-play window is the time between the first tab playing and the server POST completing (~100ms). Acceptable. |
| VI translation quality / completeness | Medium | Low | Native speaker review required for T-008. CI key-drift check (T-007) catches structural gaps but not quality. Plan a dedicated review session before Sprint 1 demo. |
| i18n key drift between EN and VI locales | Medium | Low | T-007 CI check enforces structural parity. Fails the build on missing VI keys. |
| Single PostgreSQL is SPOF | Low | High | Automated backups from day 1 (T-002 docker-compose). Document failover. No architectural change needed for MVP. |
| Audio error rate > 1% on mobile (NFR-008) | Medium | Medium | NFR-008 monitoring via T-903 telemetry. 403-retry refresh flow (T-305) handles expired URLs. Remaining errors are network/codec issues — fallback message (REQ-085) covers UX. |
| Scaled scoring correctness (approximate vs ETS) | Medium | Low | Label approximate scores clearly in UI. Backend strategy is configurable per deployment (SCORE_CONVERSION_STRATEGY env var). |
| Clock skew causing timer drift | Low | Low | Server-authoritative timer; client syncs offset every 30s (T-411). Server-side expiry is the truth. |

---

## Open Items That Must Be Resolved Before Sprint Start

| Item | Decision needed by | Blocks |
|------|--------------------|--------|
| OQ-2: Email provider | Before Sprint 1 week 2 | T-106 (password reset email) |
| OQ-2: Storage provider (S3/GCS/R2) | Before Sprint 2 week 2 | T-302 (S3 adapter production deploy) |
| OQ-5: Max concurrent users | Before production provisioning | PG pool sizing, instance count |
| OQ-1: ETS table copyright decision | Before Sprint 4 | T-505 data seeding (approximate strategy ships regardless) |
| OQ-4: Edit-published-test policy | Before Sprint 4 | T-207 + potential T-X01 versioning epic |

---

## Assumptions

1. Both developers are full-stack capable and can work across backend and frontend.
2. No onboarding time is included (team is already familiar with NestJS and React/TypeScript fundamentals; unfamiliarity with specific libraries such as TypeORM or TanStack Query adds at most ×1.3 to affected tasks).
3. Design/UX mockups are not in scope for these estimates — the estimates cover implementation of the specified behavior. If a designer needs to produce mockups before the authoring or exam runner UI can be built, add 1 week to the schedule for the design phase.
4. explanation_vi content for test questions is authored by the teacher via the UI (T-210/T-211) — no bulk import or migration of existing content is in scope.
5. The "thin vertical slice" in Sprint 1-3 uses text-only questions (Part 5 or 6 passage) to avoid dependency on audio upload for the first demo. Audio integration follows once File module is wired.
6. Practice session resume (REQ-046, SHOULD, T-607) is Sprint 2+ — not in the critical path.
