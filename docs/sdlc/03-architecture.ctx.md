---
doc: 03-architecture
agent: architect
phase: 2
status: complete
updated: 2026-06-07
human_doc: 03-architecture.md
source: 02-requirements
next: [estimator]
note: "ctx handoff authored by orchestrator after architect agent completed 03-architecture.md but hit session limit before writing this file; main doc is complete (12 sections, 11 ADRs)."
stack:
  backend: "NestJS (TypeScript), modular monolith"
  frontend: "React (TypeScript) SPA, Zustand + TanStack Query, react-i18next (EN+VI)"
  db: "PostgreSQL (single instance at MVP, no Redis)"
  storage: "FileStorageAdapter abstraction; S3 default, local adapter for dev"
  auth: "JWT HS256 access token + refresh token in HttpOnly cookie; bcrypt password hashing; RBAC role guard (Admin/Teacher/Learner)"
modules:
  - "AuthModule — register/login/refresh/password-reset, JWT strategy, guards"
  - "UserModule — profile, self-service"
  - "TestModule — test authoring (Parts 1-7 scaffold), questions, stimulus/groups, publish lifecycle"
  - "AttemptModule — attempt lifecycle, answers, timer, audio-play tracking, expiry"
  - "FileModule — upload, pre-signed URL gen + refresh"
  - "ScoringModule — raw->scaled conversion (swappable strategy), result review"
  - "AdminModule — user management, role assignment, self-protection"
key_decisions:
  D-001: "Attempt expiry = HYBRID lazy-eval-on-access + 60s cron sweep (resolves I-005). Server-authoritative timer; client syncs offset every 30s."
  D-002: "Audio-played tracking = join table attempt_audio_plays (resolves C-003). Strict mode blocks replay on revisit server-side."
  D-003: "Modular monolith, not microservices."
  D-004: "No Redis at MVP — PostgreSQL only."
  D-005: "Frontend state = Zustand + TanStack Query."
  D-006: "FileStorageAdapter interface decouples from S3 (resolves I-002/OQ-2 — design unaffected by provider choice)."
  D-007: "Score conversion = swappable strategy: DB table when ETS resolved, approximate formula fallback (resolves I-001/OQ-1 for build; data seeding still blocked)."
  D-008: "JWT HS256 at MVP (RS256 deferred)."
  D-009: "Published test edit = unpublish-first (RECOMMENDED resolution for I-003/OQ-4 — needs product sign-off)."
  D-010: "Pre-signed URL = 15 min validity + frontend 403-retry refresh flow (resolves REQ-084)."
  D-011: "Refresh token delivered as HttpOnly cookie."
data_model_highlights:
  - "explanation_vi column on question (GAP-001) — Vietnamese rationale, shown in practice feedback + result review"
  - "Attempt state machine: in_progress -> submitted | expired"
  - "Question-group modeling via stimulus entity + question.stimulus_id FK"
  - "attempt_audio_plays join table for strict-mode single-play enforcement"
  - "Full DDL sketches in 03-architecture.md section 4 (lines ~271-561)"
open_issues_status:
  I-001_OQ-1: "ETS table — architecture unblocked via swappable strategy; data seeding still blocked. Before Sprint 2."
  I-002_OQ-2: "Storage provider — architecture unblocked via adapter; confirm provider before prod. Also: email service (Resend/SendGrid/SES) needed for password reset — NEW dependency."
  I-003_OQ-4: "Edit published test — architect recommends unpublish-first (ADR-009/D-009). Needs product decision before Sprint 2; edit-in-place adds 2-3 days versioning."
  I-004_OQ-5: "Max concurrent users — non-blocking for architecture (designed for 200 per NFR-001); needed before prod for pool/instance sizing."
feedback_to_product:
  - "Email delivery service for password reset (REQ-006) not in stack — recommend Resend/SendGrid/SES; confirm with OQ-2."
  - "REQ-046 practice session resume — architecture supports it; recommend Sprint 2 with a resume UX flow."
top_risks:
  - "R-007: cron sweep in clustered deploy needs pg_advisory_lock (non-issue at single-instance MVP)."
  - "R-005: mobile browser audio reliability — test Chrome Mobile + Safari."
  - "R-010: VI translation key drift — add CI check comparing EN/VI key sets."
next_agent_instructions:
  - "PIPELINE_DOCS = /Users/pvthuan/work/toeic_app/docs/sdlc"
  - "Read 03-architecture.ctx.md (this file) + 02-requirements.ctx.md for REQ-IDs/NFRs."
  - "Pull 03-architecture.md only for detail behind a referenced section (module breakdown, DDL, API surface, ADRs)."
  - "Estimate effort per user story / module; decompose into tasks with story points; identify Sprint 1 vs Sprint 2 split."
  - "Account for NEW scope: explanation_vi authoring+display, bilingual i18n, email service dependency, swappable scoring + storage adapters."
  - "Write output to 04-estimates.md (+ .ctx.md handoff)."
pull_hint: "Full ER diagram + DDL, API endpoint table, ADR rationale, frontend component structure, scoring/file/timer subsystem detail -> 03-architecture.md"
---
