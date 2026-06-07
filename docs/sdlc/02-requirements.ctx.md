---
doc: 02-requirements
agent: requirements-analyst
phase: 1
status: complete
updated: 2026-06-07
human_doc: 02-requirements.md
source: 01-product-spec
next: [architect]
provides:
  requirements:
    REQ-001: { p: MUST, story: US-001, text: "Self-register with email+password(>=8ch,>=1num)+displayName -> Learner role + JWT" }
    REQ-002: { p: MUST, story: US-001, text: "Reject duplicate email with HTTP 409" }
    REQ-003: { p: MUST, story: US-001, text: "Reject weak password with HTTP 422" }
    REQ-004: { p: MUST, story: US-001, text: "Login returns JWT access+refresh tokens" }
    REQ-005: { p: MUST, story: US-001, text: "Invalid login returns ambiguous 401" }
    REQ-006: { p: MUST, story: US-001, text: "Password reset sends 30-min single-use link" }
    REQ-007: { p: MUST, story: US-001, text: "Reset link sets new password; expired/used link -> 410" }
    REQ-008: { p: MUST, story: US-001, text: "Email normalized to lowercase before uniqueness check" }
    REQ-009: { p: MUST, story: US-001, text: "Display name non-empty, <=100 chars" }
    REQ-010: { p: MUST, story: US-002, text: "Teacher creates draft test; Parts 1-7 auto-scaffolded" }
    REQ-011: { p: MUST, story: US-002, text: "Add question with text, 4 choices, 1 correct, optional explanation_vi" }
    REQ-012: { p: MUST, story: US-002, text: "Create stimulus and attach multiple questions (group)" }
    REQ-013: { p: MUST, story: US-002, text: "Upload audio(MP3/AAC <=20MB) and image(JPEG/PNG <=5MB); reject others 422" }
    REQ-014: { p: MUST, story: US-002, text: "Draft tests invisible to learners" }
    REQ-015: { p: MUST, story: US-002, text: "Publish rejected if any Part has 0 questions" }
    REQ-016: { p: MUST, story: US-002, text: "Save draft allowed with incomplete parts" }
    REQ-017: { p: MUST, story: US-002, text: "Reject question with !=4 choices or !=1 correct" }
    REQ-018: { p: MUST, story: US-002, text: "Title non-empty <=200ch; description <=2000ch" }
    REQ-019: { p: SHOULD, story: US-002, text: "Sanitize upload filenames; preserve original in metadata" }
    REQ-020: { p: MUST, story: US-002, text: "Question.explanation_vi: nullable text field, max 5000ch, Vietnamese" }
    REQ-021: { p: MUST, story: US-004, text: "Practice feedback shows Vietnamese explanation (or fallback msg if null)" }
    REQ-022: { p: MUST, story: US-005, text: "Result review shows Vietnamese explanation per question" }
    REQ-023: { p: MUST, story: All, text: "All UI strings in EN+VI translation files (react-i18next)" }
    REQ-024: { p: MUST, story: All, text: "Locale selector (EN/VI) persistent per user" }
    REQ-025: { p: MUST, story: All, text: "Missing VI key falls back to EN; never show raw key" }
    REQ-026: { p: SHOULD, story: All, text: "Default locale for unauthenticated visitors = VI" }
    REQ-027: { p: MUST, story: All, text: "TOEIC content always EN; only explanations+UI chrome are locale-sensitive" }
    REQ-030: { p: MUST, story: US-003, text: "Start full test creates Attempt(mode=full,status=in-progress); timer starts" }
    REQ-031: { p: MUST, story: US-003, text: "Server-authoritative timer; client syncs display only" }
    REQ-032: { p: MUST, story: US-003, text: "No pause/stop/extend controls in full-test mode" }
    REQ-033: { p: MUST, story: US-003, text: "Timer=0 -> auto-submit + status=expired + trigger scoring" }
    REQ-034: { p: MUST, story: US-003, text: "Manual submit with unanswered Qs shows confirmation dialog" }
    REQ-035: { p: MUST, story: US-003, text: "Post-submit/expiry: no further answers accepted" }
    REQ-036: { p: MUST, story: US-003, text: "State machine: in-progress->{submitted|expired} only" }
    REQ-037: { p: MUST, story: US-003, text: "Max 1 in-progress full attempt per test per learner; resume existing" }
    REQ-038: { p: MUST, story: US-003, text: "Unanswered questions scored as incorrect" }
    REQ-039: { p: SHOULD, story: US-003, text: "Scaled scores displayed within 5 seconds of submission" }
    REQ-040: { p: MUST, story: US-004, text: "Practice by single Part; Attempt mode=practice created" }
    REQ-041: { p: MUST, story: US-004, text: "No timer in practice mode" }
    REQ-042: { p: MUST, story: US-004, text: "Instant feedback on confirm: correct/wrong + correct answer + explanation_vi" }
    REQ-043: { p: MUST, story: US-004, text: "Answer locked after confirm; navigate back shows locked answer" }
    REQ-044: { p: MUST, story: US-004, text: "Practice completion shows raw score only, no scaled" }
    REQ-045: { p: MUST, story: US-004, text: "Practice audio: auto-play + unlimited Replay button" }
    REQ-046: { p: SHOULD, story: US-004, text: "Practice session resumable after browser close" }
    REQ-050: { p: MUST, story: US-005, text: "My Results: paginated attempt list, most-recent-first" }
    REQ-051: { p: MUST, story: US-005, text: "Review shows all Qs with learner answer, correct answer, explanation_vi" }
    REQ-052: { p: MUST, story: US-005, text: "Filter: wrong answers only toggle" }
    REQ-053: { p: SHOULD, story: US-005, text: "Audio replay available in review mode" }
    REQ-054: { p: MUST, story: US-005, text: "Question groups show stimulus once with questions beneath" }
    REQ-060: { p: MUST, story: US-006, text: "Admin paginated user list with email/role/status/dates" }
    REQ-061: { p: MUST, story: US-006, text: "Admin changes user role; effective on next token refresh" }
    REQ-062: { p: MUST, story: US-006, text: "Admin deactivates user; tokens invalidated, login blocked" }
    REQ-063: { p: MUST, story: US-006, text: "Admin cannot self-deactivate or self-role-change" }
    REQ-064: { p: MUST, story: US-006, text: "Admin can reactivate deactivated accounts" }
    REQ-065: { p: SHOULD, story: US-006, text: "User list search by email + filter by role" }
    REQ-070: { p: MUST, story: US-007, text: "Compute raw scores: L=correct in P1-4 (max 100), R=correct in P5-7 (max 100)" }
    REQ-071: { p: MUST, story: US-007, text: "Lookup ScoreConversionTable: raw->scaled per section" }
    REQ-072: { p: MUST, story: US-007, text: "Boundary: raw 0->scaled 5, raw 100->scaled 495" }
    REQ-073: { p: MUST, story: US-007, text: "Missing table entry: show raw + 'scaled unavailable' + admin alert" }
    REQ-074: { p: MUST, story: US-007, text: "Practice mode: raw count only, no conversion lookup" }
    REQ-075: { p: MUST, story: US-007, text: "ConversionTable: 101 rows per section (0-100), admin-seeded" }
    REQ-080: { p: MUST, story: US-008, text: "Full-test: audio auto-plays once, no controls exposed" }
    REQ-081: { p: MUST, story: US-008, text: "Full-test: revisiting played question does NOT re-trigger audio" }
    REQ-082: { p: MUST, story: US-008, text: "Practice: auto-play + visible Replay button, unlimited" }
    REQ-083: { p: MUST, story: US-008, text: "Pre-signed URL validity >= 15 minutes" }
    REQ-084: { p: MUST, story: US-008, text: "Expired URL mid-session: frontend auto-refreshes URL transparently" }
    REQ-085: { p: MUST, story: US-008, text: "Audio load failure: show error message, question remains answerable" }
    REQ-086: { p: MUST, story: US-008, text: "Upload validation: MIME audio/mpeg|aac <=20MB, image/jpeg|png <=5MB" }
  nfrs:
    - "NFR-001: API p95 <500ms at 200 concurrent users"
    - "NFR-002: Score display <5s post-submit"
    - "NFR-003: Concurrent registration handled by DB unique constraint"
    - "NFR-004: Passwords bcrypt hashed, cost>=10"
    - "NFR-005: Access token <=15min, refresh <=7days"
    - "NFR-006: Streaming file uploads to S3"
    - "NFR-007: RBAC enforced on all endpoints"
    - "NFR-008: Audio error rate <1% over 7-day window"
  gherkin: [SC-001, SC-002, SC-003, SC-004, SC-005, SC-006, SC-007, SC-008, SC-010, SC-011, SC-012, SC-013, SC-014, SC-015, SC-016, SC-017, SC-018, SC-019, SC-020, SC-021, SC-022, SC-023, SC-024, SC-025, SC-026, SC-027, SC-028, SC-029, SC-030, SC-031, SC-032, SC-033, SC-034, SC-035, SC-040, SC-041, SC-042, SC-043, SC-044, SC-045, SC-046, SC-047, SC-048, SC-049, SC-050, SC-060, SC-061, SC-062, SC-063, SC-064, SC-065, SC-070, SC-071, SC-072, SC-073, SC-074, SC-075, SC-080, SC-081, SC-082, SC-083, SC-084, SC-085, SC-086, SC-087, SC-090, SC-091, SC-092, SC-093, SC-094, SC-095, SC-096, SC-100, SC-101, SC-102, SC-103, SC-104, SC-105, SC-106, SC-110, SC-111, SC-112, SC-113, SC-114]
  edge_cases: [EC-001, EC-002, EC-003, EC-004, EC-005, EC-006, EC-007, EC-008, EC-009, EC-010, EC-011, EC-012, EC-013, EC-014, EC-015]
  spec_gaps_added: [GAP-001 explanation_vi field, GAP-002 i18n EN+VI, GAP-003 content vs UI string]
out_of_scope: [social-login, question-bank, spaced-repetition, SW-module, native-apps, LMS, section-timers, leaderboards, CSV-import, email-verification, invite-codes, multi-lang-beyond-VI, offline-PWA]
constraints:
  - "Attempt state machine: in-progress -> {submitted, expired}; no other transitions"
  - "Server-authoritative timer for full-test mode"
  - "explanation_vi is nullable (assumption: not required for publish)"
  - "Default locale = VI for unauthenticated users"
open:
  - { I-001: "ETS conversion table copyright (blocks US-007 data seeding)" }
  - { I-002: "File storage provider confirmation (blocks US-002 upload, US-008 delivery)" }
  - { I-003: "Edit-published-test policy (blocks US-002 AC finalization)" }
  - { I-004: "Max concurrent users (blocks infra sizing)" }
  - { I-005: "Server-side attempt expiry mechanism (cron vs lazy eval -- arch decision needed)" }
pull_hint: "full Gherkin scenarios + traceability matrix + edge case table -> 02-requirements.md"
---
