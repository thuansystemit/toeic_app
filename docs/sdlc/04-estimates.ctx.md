---
doc: 04-estimates
agent: estimator
phase: 3
status: complete
updated: 2026-06-07
human_doc: 04-estimates.md
source: [02-requirements, 03-architecture]
next: [planner]
provides:
  tasks:
    # Module 0 — Setup & Shared Infra (23pt)
    - "T-001 NestJS scaffold (tsconfig/ESLint/Jest/env) 2pt deps:[] → All"
    - "T-002 docker-compose dev stack (PG + MinIO) 2pt deps:[T-001] → All"
    - "T-003 TypeORM config + migrations runner 2pt deps:[T-002] → All"
    - "T-004 Shared NestJS: ValidationPipe/ExceptionFilter/Guards skeleton 3pt deps:[T-001] → All"
    - "T-005 React SPA scaffold (Vite/Router/TanStack/Zustand/Axios) 3pt deps:[] → All"
    - "T-006 i18n scaffold (react-i18next, 6 NS, LocaleSwitcher, locale persistence) 3pt deps:[T-005] → REQ-023..027"
    - "T-007 CI pipeline: lint/test/build + EN vs VI key-drift check 3pt deps:[T-005,T-006] → REQ-023"
    - "T-008 Full EN+VI locale files (6 namespaces × 2 langs) 5pt deps:[T-006] → REQ-023..027"
    # Module 1 — Auth (30pt)
    - "T-101 DB migration: users/refresh_tokens/password_reset_tokens 2pt deps:[T-003] → US-001"
    - "T-102 AuthModule+UserModule scaffold 2pt deps:[T-004,T-101] → US-001"
    - "T-103 POST /auth/register (email norm, bcrypt, JWT pair) 3pt deps:[T-102] → REQ-001..005,008,009"
    - "T-104 POST /auth/login + /refresh + /logout 3pt deps:[T-103] → REQ-004,005,NFR-005"
    - "T-105 Password reset endpoints (30-min token, 410 expired/used) 3pt deps:[T-104] → REQ-006,007"
    - "T-106 Email service integration (Resend/SendGrid/SES; OQ-2 blocks) 3pt deps:[T-105] → REQ-006"
    - "T-107 JwtAuthGuard+JwtStrategy+RolesGuard fully wired 2pt deps:[T-104] → NFR-007"
    - "T-108 GET+PATCH /users/me (profile, locale pref) 2pt deps:[T-102] → REQ-024"
    - "T-109 Auth backend unit tests 3pt deps:[T-108] → US-001"
    - "T-110 Frontend: Login/Register/PasswordReset pages + authStore 5pt deps:[T-005,T-006,T-104] → US-001"
    - "T-111 Frontend: ProtectedRoute + Header + locale switcher 2pt deps:[T-110] → US-001"
    # Module 2 — Test Authoring (33pt)
    - "T-201 DB migration: tests/parts/stimuli/questions/choices 3pt deps:[T-003] → US-002"
    - "T-202 TestModule scaffold (entities, repos) 2pt deps:[T-004,T-201] → US-002"
    - "T-203 POST /tests (draft + 7-part scaffold) 2pt deps:[T-202] → REQ-010,018"
    - "T-204 GET/PATCH/DELETE /tests + list (role-filtered) 3pt deps:[T-203] → REQ-014,018"
    - "T-205 Question CRUD (4 choices, 1 correct, explanation_vi) 3pt deps:[T-202] → REQ-011,017,020"
    - "T-206 Stimulus CRUD + question.stimulus_id wiring 3pt deps:[T-202,T-301] → REQ-012,013"
    - "T-207 Publish/unpublish workflow (0-question guard, no-attempts guard) 3pt deps:[T-204,T-205] → REQ-015"
    - "T-208 Authoring backend tests 3pt deps:[T-207] → US-002"
    - "T-209 Frontend: TestEditorPage 3pt deps:[T-005,T-006,T-204] → US-002"
    - "T-210 Frontend: PartEditorPage + QuestionEditorForm (explanation_vi) 5pt deps:[T-209,T-205] → REQ-020"
    - "T-211 Frontend: stimulus upload UI (audio/image + passage) 3pt deps:[T-210,T-303] → REQ-012,013"
    # Module 3 — File & Audio Storage (21pt)
    - "T-301 FileStorageAdapter interface + LocalStorageAdapter 3pt deps:[T-004] → US-002"
    - "T-302 S3StorageAdapter (streaming upload, presign, delete) 3pt deps:[T-301] → REQ-013,086,NFR-006"
    - "T-303 POST /files/upload (MIME/size validation, key gen, filename sanitize) 3pt deps:[T-302] → REQ-086,019"
    - "T-304 GET /files/:key/url (fresh presign for 403-retry) 2pt deps:[T-302] → REQ-083,084"
    - "T-305 Frontend: useAudioPlayer (auto-play, played-set, 403-retry, error state) 5pt deps:[T-304] → REQ-080..085"
    - "T-306 Frontend: AudioPlayer+StimulusDisplay+Replay button 3pt deps:[T-305] → REQ-080..082,085"
    - "T-307 File module backend tests 2pt deps:[T-303,T-304] → US-008"
    # Module 4 — Full Test Taking (36pt)
    - "T-401 DB migration: attempts/attempt_answers/attempt_audio_plays 2pt deps:[T-201] → US-003"
    - "T-402 AttemptModule scaffold 2pt deps:[T-004,T-401] → US-003"
    - "T-403 POST /attempts (start/resume, uniqueness, expiresAt, lazy-expire) 3pt deps:[T-402,T-202] → REQ-030,036,037"
    - "T-404 GET /attempts/:id + /timer (server-time offset) 2pt deps:[T-403] → REQ-031"
    - "T-405 GET /attempts/:id/questions (paginated, presigned URLs, audioAlreadyPlayed) 3pt deps:[T-403,T-304] → REQ-080,081"
    - "T-406 POST /answers + audio-played record/list 3pt deps:[T-403] → REQ-035,043,080,081"
    - "T-407 POST /attempts/:id/submit + trigger ScoringService 3pt deps:[T-403,T-501] → REQ-033..035,NFR-002"
    - "T-408 AttemptExpiryJob cron (60s sweep, CAS update) 3pt deps:[T-407] → D-001"
    - "T-409 Attempt backend tests (expiry CAS, timer, double-expiry, answer-after-submit) 5pt deps:[T-408] → US-003"
    - "T-410 Frontend: ExamRunnerPage (nav grid, question/stimulus render, answer select) 5pt deps:[T-005,T-306,T-405] → US-003"
    - "T-411 Frontend: useTimer (30s poll, offset, auto-submit at 0) + ExamTimer 3pt deps:[T-404,T-410] → REQ-031,033"
    - "T-412 Frontend: submit flow (confirmation dialog, ExamCompletePage, score display) 2pt deps:[T-411,T-601] → REQ-034,039"
    # Module 5 — Scoring (15pt)
    - "T-501 DB migration: scores + score_conversion_table 2pt deps:[T-401] → US-007"
    - "T-502 ScoringModule scaffold + ConversionStrategy interface + DB + Approx implementations 3pt deps:[T-004,T-501] → REQ-070..074"
    - "T-503 ScoringService.computeAndPersist (raw count, convert, persist, missing-entry handling) 3pt deps:[T-502] → REQ-070..074"
    - "T-504 GET /attempts/:id/scores endpoint 1pt deps:[T-503] → REQ-070"
    - "T-505 POST /admin/score-conversion-table (bulk seed/replace, boundary validation) 3pt deps:[T-502] → REQ-075"
    - "T-506 Scoring backend tests (boundaries, missing entry, practice skip) 3pt deps:[T-505] → US-007"
    # Module 6 — Practice Mode (13pt)
    - "T-601 Practice attempt creation path (mode=practice, partId, no expiresAt) 2pt deps:[T-403] → REQ-040,041"
    - "T-602 Instant feedback on confirm (is_correct, correct_choice_id, explanation_vi) 2pt deps:[T-406] → REQ-042,043"
    - "T-603 Practice raw-score completion (no scaled lookup) 1pt deps:[T-503] → REQ-044,074"
    - "T-604 Frontend: practice mode variant (no timer, confirm, feedback panel, explanation_vi) 5pt deps:[T-306,T-410,T-602] → REQ-021,041..043,045"
    - "T-605 Frontend: answer-locked back-nav state 2pt deps:[T-604] → REQ-043"
    - "T-606 Frontend: practice raw-score completion screen 1pt deps:[T-604] → REQ-044"
    - "T-607 Frontend: practice session resume UX (SHOULD, Sprint 2) 2pt deps:[T-601,T-604] → REQ-046"
    # Module 7 — Result Review (15pt)
    - "T-701 GET /attempts/me (paginated, completed only, most-recent-first) 2pt deps:[T-403] → REQ-050"
    - "T-702 GET /attempts/:id/review (grouped stimulus, wrongOnly filter, explanation_vi) 3pt deps:[T-405,T-503] → REQ-051,052,054"
    - "T-703 Review backend tests 2pt deps:[T-702] → US-005"
    - "T-704 Frontend: MyResultsPage (attempt list, score card, link to review) 2pt deps:[T-005,T-701] → REQ-050"
    - "T-705 Frontend: AttemptReviewPage (ReviewQuestionCard, WrongOnlyToggle, stimulus grouped) 5pt deps:[T-704,T-306,T-702] → REQ-021,022,051..054"
    - "T-706 Frontend: audio replay in review mode (always enabled) 1pt deps:[T-305,T-705] → REQ-053"
    # Module 8 — Admin (12pt)
    - "T-801 AdminModule scaffold + RolesGuard(Admin) 1pt deps:[T-107] → US-006"
    - "T-802 GET /admin/users (paginated, search by email, filter by role) 2pt deps:[T-801] → REQ-060,065"
    - "T-803 PATCH role + POST deactivate/reactivate + self-protection 3pt deps:[T-802] → REQ-061..064"
    - "T-804 Admin backend tests (self-deactivation 403, revoke refresh tokens) 3pt deps:[T-803] → US-006"
    - "T-805 Frontend: UserManagementPage (paginated table, search, role change, deactivate) 3pt deps:[T-005,T-006,T-803] → REQ-060..065"
    # Module 9 — Cross-Cutting / NFRs (14pt)
    - "T-901 Throttler on auth endpoints + CORS whitelist 2pt deps:[T-101] → NFR"
    - "T-902 Health check + pino structured logging 2pt deps:[T-302] → NFR"
    - "T-903 Audio-error telemetry endpoint + frontend fire-and-forget 2pt deps:[T-306] → NFR-008"
    - "T-904 E2E test suite (Playwright/Cypress: auth+test+attempt+score happy path) 5pt deps:[T-412] → All"
    - "T-905 Load test script (k6/Artillery, 200 concurrent, verify p95 <500ms) 3pt deps:[T-405] → NFR-001"
    # Spikes
    - "SP-001 Mobile timer throttling (Safari setInterval) 2pt deps:[] → T-411"
    - "SP-002 Dual-tab audio-once enforcement edge case 1pt deps:[] → T-305,T-406"
    - "SP-003 Email provider selection + dev sandbox (Resend/SES/SendGrid) 2pt deps:[] → T-106"

  total_points: 217
  calendar_days: 54  # 2 devs, 20pt/dev/sprint, ~80% focus, 3 sprints + polish
  critical_path: [T-001, T-003, T-004, T-101, T-102, T-103, T-104, T-107, T-201, T-401, T-501, T-402, T-403, T-407, T-503, T-301, T-303, T-304, T-405, T-410, T-411, T-412]
  sprint_targets:
    sprint1: [T-001..T-004, T-005..T-007, SP-001..SP-003, T-101..T-104, T-107, T-110, T-111]
    sprint2: [T-201..T-210, T-301..T-304, T-401, T-402, T-403, T-501..T-503]
    sprint3: [T-404..T-412, T-601..T-606, T-504, T-506]
    sprint4: [T-105, T-106, T-701..T-706, T-801..T-805, T-901..T-905, T-008, T-007, T-208, T-703, T-804, T-505, T-607]

spikes:
  - "SP-001: mobile Safari setInterval throttling impact on countdown timer (1 day)"
  - "SP-002: dual-tab audio-once enforcement edge case (0.5 day)"
  - "SP-003: email provider selection + sandbox setup — required before T-106 (0.5 day)"

risks:
  - "OQ-2 email provider unresolved blocks T-106 (REQ-006 password reset) — spike SP-003 week 1"
  - "OQ-2 S3 provider unresolved blocks T-302 prod deploy — LocalAdapter (T-301) unblocks dev"
  - "OQ-4 edit-published-test policy: if edit-in-place chosen adds ~10pt versioning epic before Sprint 4"
  - "Mobile Safari timer throttling may make client auto-submit unreliable — server cron (T-408) is authoritative backstop"
  - "Audio-once dual-tab enforcement: server played-set is authoritative but window exists (~100ms) between play and POST"
  - "VI translation quality requires native speaker review — T-008 is content work not just copy"

open:
  - "OQ-1: ETS table seeding blocked (approximate strategy ships); T-505 endpoint ready"
  - "OQ-2: email provider must be decided before Sprint 1 week 2 (blocks T-106)"
  - "OQ-2: storage provider must be decided before Sprint 2 staging deploy (blocks T-302)"
  - "OQ-4: edit-in-place vs unpublish-first must be decided before Sprint 4"
  - "OQ-5: max concurrent users needed before production provisioning"

pull_hint: "full task descriptions, inflation factors, sprint rationale, risk register detail, confidence ranges, assumptions → 04-estimates.md"
---
