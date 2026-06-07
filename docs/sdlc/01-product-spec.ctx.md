---
doc: 01-product-spec
agent: product-manager
phase: 1
status: complete
updated: 2026-06-07
human_doc: 01-product-spec.md
next: [requirements-analyst]
feature: toeic-platform
stack:
  backend: "NestJS (TypeScript) + PostgreSQL"
  frontend: "React (TypeScript)"
  auth: "JWT access + refresh tokens; NestJS RBAC Guards"
  storage: "AWS S3 recommended (pre-signed URLs); confirmed via OQ-2"
provides:
  stories:
    US-001: "Open self-registration (email+password, no admin approval) + JWT login + password reset"
    US-002: "Teacher creates a TOEIC test — all 7 parts, audio/image upload to S3, publish/draft"
    US-003: "Learner takes a full timed test — strict exam fidelity: hard timer no-pause, audio plays once only, auto-submit on expiry"
    US-004: "Learner practices by part — lenient: no timer, unlimited audio replay, instant per-question feedback, raw score only"
    US-005: "Learner reviews past attempt — all Qs, correct/wrong, filter wrong-only, explanations shown"
    US-006: "Admin manages user roles — paginated list, change role, deactivate"
    US-007: "Score calculation — raw count → ETS scaled score (L 5-495, R 5-495, Total 10-990); blocked on OQ-1 (copyright)"
    US-008: "Audio playback — full-test: auto-play once, no replay button, no controls; practice: auto-play + Replay button; served via pre-signed URLs"
  metric: "1,000 full-test attempts completed within 3 months of launch"
mvp: "Open-registration auth (NestJS/JWT/PG) + test authoring (7 parts + S3 audio/image) + full timed test (strict fidelity) + practice mode (lenient) + scaled scoring + result review + basic admin"
out_of_scope:
  - Social login (Google/Facebook)
  - Question bank / cross-test reuse
  - Spaced repetition / adaptive learning
  - TOEIC Speaking & Writing module
  - Native iOS/Android apps
  - LMS integrations
  - Section-level independent timers (Listening vs. Reading)
  - Leaderboards / gamification
  - Bulk CSV question import
  - Email verification gating (deferred to v1.1)
  - Admin-driven enrollment / invite codes
users: [admin, teacher, learner]
top_rice: "US-001 Learner Self-Registration and Login (score 6000)"
constraints:
  - TOEIC L&R format only (Parts 1-7, 200 Qs fixed structure)
  - Web-first; mobile via responsive design only
  - Pre-uploaded audio only (no live recording)
  - 4-choice single-correct-answer format throughout
  - Full-test mode is strict — hard timer (no pause), audio once, no replay; non-configurable
  - Practice mode is lenient — no timer, unlimited audio replay, instant feedback; non-configurable
  - Stack fixed: NestJS + React (TypeScript) + PostgreSQL
  - Signup is open: no admin approval or invite required
  - UI is bilingual EN+VI (react-i18next from day one); answer/question EXPLANATIONS are in Vietnamese, TOEIC question content stays English
open:
  - "OQ-1: ETS score conversion table copyright — use official table or approximation? Legal review needed before Sprint 2 (blocks US-007 data seeding)"
  - "OQ-2: File storage provider — S3 recommended; confirm S3 vs GCS/R2/local before Sprint 1 (blocks US-002 upload, US-008 delivery)"
  - "OQ-4: Teacher editing a published test — allow in-place or require unpublish first? Before Sprint 2 (affects US-002 AC)"
  - "OQ-5: Max concurrent users at launch — needed for PG pool sizing and infra planning before Sprint 1"
resolved_since_v1:
  - "Tech stack — DECIDED: NestJS + React (TypeScript) + PostgreSQL"
  - "Signup model — DECIDED: Open self-registration, no admin approval"
  - "Audio replay in full-test mode — DECIDED: single play, no replay, no pause (strict exam fidelity)"
  - "UI language — DECIDED: bilingual EN+VI; explanations in Vietnamese, question content English (react-i18next day one)"
pull_hint: "RICE math, full ACs (incl. strict exam fidelity rules), TOEIC domain table, data entities, tech stack table, phased roadmap → 01-product-spec.md"
---
