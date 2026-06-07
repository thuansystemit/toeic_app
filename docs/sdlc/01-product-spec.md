# Product Spec — TOEIC Learning Platform
**Date:** 2026-06-07  **Author:** @product-manager  **Status:** DRAFT (updated 2026-06-07)
**Feature ID:** toeic-platform

---

## Tech Stack (Decided)

| Layer | Choice | Notes |
|-------|--------|-------|
| **Backend** | Node.js + NestJS (TypeScript) | REST API; JWT-based auth; module per domain (auth, tests, attempts, scoring) |
| **Frontend** | React (TypeScript) | SPA; React Router for navigation; component library TBD |
| **Database** | PostgreSQL | Relational; well-suited to the hierarchical test → part → question model |
| **File Storage** | AWS S3 (recommended default) | For audio (MP3/AAC) and image (JPEG/PNG) assets; pre-signed URLs for delivery; exact bucket/provider confirmed in OQ-2 |
| **Auth** | JWT (access + refresh tokens) | NestJS Guards for role-based access control (RBAC): Admin / Teacher / Learner |

> All decisions above are fixed except file storage provider (see Open Questions OQ-2). Engineering may begin scaffold work against this stack immediately.

---

## Problem Statement

Students preparing for the TOEIC exam have no centralized, structured platform where they can take realistic full-length TOEIC tests and practice by part, receive immediate scoring, and review their answers. Teachers and administrators lack tools to author, organize, and publish TOEIC tests digitally. This platform solves both sides: a content-authoring tool for Admins/Teachers and a learning environment for students.

---

## Product Vision

Build a web-based TOEIC learning platform that enables teachers to create and publish authentic TOEIC tests, and enables learners to practice via full tests or individual parts, receive instant scaled scores, and review their answers with explanations — all in a structured, exam-faithful environment.

---

## Target Users

| Persona | Key need | Estimated reach (users/quarter) |
|---------|----------|---------------------------------|
| Admin | Manage users, manage all content, configure platform | 1–5 |
| Teacher (Content Author) | Create TOEIC tests, upload audio, write questions and answer keys | 5–20 |
| Learner (Student) | Take full tests or practice by part, see scores, review mistakes | 500–5,000 |

### Persona Details

**Admin**
- Manages teacher and learner accounts
- Full CRUD on any test content
- Views platform-wide analytics (usage, score distributions)

**Teacher**
- Authenticated, credentialed user elevated above a basic learner
- Creates and edits Tests, Parts, Questions, and Choices
- Uploads audio files for Listening sections
- Publishes or unpublishes tests
- Views per-test analytics (attempt counts, average scores)

**Learner**
- Self-registers via open signup (email + password); no Admin approval required
- Browses available tests
- Takes timed full tests (Listening + Reading, ~120 min) or practices individual parts
- Receives instant score with breakdown by part
- Reviews each question: their answer, correct answer, explanation

---

## TOEIC Domain Considerations

### Test Structure (TOEIC Listening & Reading)

The TOEIC L&R test has **200 questions**, **~120 minutes** total.

#### Listening Section (100 Qs, ~45 min)
| Part | Name | Format | # Questions |
|------|------|--------|-------------|
| Part 1 | Photographs | 1 photo + 4 audio choices; pick what you see | 6 |
| Part 2 | Question-Response | Audio question + 3 audio choices; no photo | 25 |
| Part 3 | Conversations | Audio conversation + 3–4 questions per set | 39 |
| Part 4 | Talks | Audio monologue + 3–4 questions per set | 30 |

#### Reading Section (100 Qs, ~75 min)
| Part | Name | Format | # Questions |
|------|------|--------|-------------|
| Part 5 | Incomplete Sentences | Single sentence with blank; 4 choices | 30 |
| Part 6 | Text Completion | Short passage with 4 blanks; 4 choices each | 16 |
| Part 7 | Reading Comprehension | Single/double/triple passages + questions | 54 |

### Scoring
- Raw score per section (0–100) maps to a **scaled score** (5–495 per section; total 10–990)
- Conversion table is fixed by ETS — the platform must store a mapping table to translate raw → scaled
- No penalty for wrong answers

### Audio Requirements
- Parts 1–4 require MP3/AAC audio files per question or per conversation/talk group
- **Full-test mode (exam fidelity — DECIDED):** Audio plays exactly once per question/group. No replay button is shown. The hard timer runs continuously with no pause capability. This mirrors real TOEIC exam-day conditions.
- **Part-level practice mode (lenient — DECIDED):** Audio may be replayed unlimited times via a visible "Replay" button. No hard timer; learner controls their own pace. Immediate per-question feedback is shown after each answer.
- Images required for Part 1 (one photo per question)

### Question Group vs. Standalone
- Parts 1, 2, 5: one question per audio/text stimulus (standalone)
- Parts 3, 4, 6, 7: one stimulus shared by a group of questions (question group)

---

## User Flows

### Flow 1 — Teacher Creates a Test
1. Teacher logs in → lands on Teacher Dashboard
2. Clicks "Create New Test" → enters test title, description, time limit (default 120 min), tags
3. System creates a test with 7 Parts scaffolded (Part 1–7 with correct question counts as targets)
4. Teacher selects Part 1 → "Add Question" → uploads photo + audio, writes 4 answer choices, marks correct answer, optionally adds explanation
5. Teacher repeats for all 200 questions (or saves draft and returns later)
6. For Parts 3/4/6/7: Teacher creates a Stimulus (audio file or passage text), then attaches multiple questions to it
7. Teacher clicks "Preview Test" → sees learner view
8. Teacher clicks "Publish" → test becomes visible to Learners

### Flow 2 — Learner Takes a Full Test
1. Learner logs in → Test Library page
2. Learner clicks a test → sees title, description, part breakdown, time limit
3. Clicks "Start Full Test" → system creates an Attempt record, starts countdown timer (120 min)
4. Learner progresses through Listening (Parts 1–4) with auto-advancing audio, then Reading (Parts 5–7) at own pace
5. Learner submits (or timer expires, auto-submit)
6. System calculates raw scores per section, maps to scaled scores
7. Learner sees: total scaled score (e.g. 750/990), Listening score (e.g. 390/495), Reading score (e.g. 360/495), breakdown by part

### Flow 3 — Learner Practices by Part
1. Learner → Test Library → selects a test → "Practice by Part"
2. Learner selects one or more parts to practice
3. No overall timer; learner controls their own pace (lenient mode — decided)
4. For Listening questions: audio plays on load; a "Replay" button is available at all times
5. After each question: learner sees correct answer + explanation immediately
6. Score shown as raw count only (e.g., 18/30 for Part 5) — no scaled score in practice mode

### Flow 4 — Learner Reviews a Past Attempt
1. Learner → "My Results" → list of past attempts with date, score, test name
2. Clicks an attempt → full review: question by question with their response, correct answer, explanation, whether correct
3. Can filter: "Show only wrong answers"

### Flow 5 — Admin Manages Users
1. Admin → User Management → lists all users with role, registration date, last active
2. Admin can change role (Learner → Teacher, or suspend account)
3. Admin can delete or deactivate users

---

## High-Level Data Entities

> Conceptual model only — not a physical schema.

| Entity | Key Attributes | Notes |
|--------|----------------|-------|
| **User** | id, email, passwordHash, role (admin/teacher/learner), displayName, createdAt | Role governs permissions |
| **Test** | id, title, description, status (draft/published), timeLimitMinutes, createdBy (Teacher), createdAt | Top-level container |
| **Part** | id, testId, partNumber (1–7), section (listening/reading), questionCount | Fixed structure per TOEIC spec |
| **Stimulus** | id, partId, type (audio/image/text/passage), storageUrl, transcript | For Parts 1, 3, 4, 6, 7 |
| **Question** | id, partId, stimulusId (nullable), sequence, questionText, explanation | Standalone or grouped under stimulus |
| **Choice** | id, questionId, label (A/B/C/D), choiceText, isCorrect | 4 per question for L&R |
| **Attempt** | id, userId, testId, mode (full/practice), startedAt, submittedAt, status (in-progress/submitted/expired) | One per sitting |
| **AttemptAnswer** | id, attemptId, questionId, selectedChoiceId, isCorrect, answeredAt | One per question per attempt |
| **Score** | id, attemptId, section (listening/reading/total), rawScore, scaledScore | Computed at submission |
| **ScoreConversionTable** | section, rawScore, scaledScore | Static ETS mapping — seeded at deploy |

---

## User Stories

### US-001: Learner Self-Registration and Login
As a learner, I want to register for an account myself and log in immediately, so that I can start accessing tests and tracking my progress without waiting for an admin to approve me.

**Signup model (DECIDED):** Open self-registration — anyone can visit the registration page, provide email + password + display name, and begin learning immediately. No admin approval or invite required.

**Acceptance Criteria:**
- [ ] Given the registration page, when I submit a unique email, a password meeting minimum strength rules (≥ 8 chars, at least 1 number), and a display name, then my account is created with the Learner role and I am redirected to the Test Library
- [ ] Given an email that is already registered, when I attempt to register with that email, then I see "An account with this email already exists" and no duplicate account is created
- [ ] Given a registered email and correct password, when I submit the login form, then I receive a JWT (access + refresh token) and am redirected to my dashboard
- [ ] Given an incorrect password or unregistered email, when I submit the login form, then I see "Invalid credentials" and am not authenticated
- [ ] Given a registered email, when I request password reset, then I receive a reset link by email within 2 minutes; following the link lets me set a new password

**Out of scope for this story:** Social login (Google/Facebook), admin-driven enrollment or invite codes, email verification gating (deferred to v1.1)
**RICE Score:** Reach=2000 × Impact=3 × Confidence=100% / Effort=1 = **6000**

---

### US-002: Teacher Creates a Test (Draft)
As a teacher, I want to create a new TOEIC test with all 7 parts and add questions with answer choices, so that learners have content to practice with.

**Acceptance Criteria:**
- [ ] Given I am logged in as Teacher, when I click "Create Test," then a new draft Test is created with Parts 1–7 pre-scaffolded
- [ ] Given I am on a Part editor, when I add a question, then I can input question text, 4 answer choices (A–D), mark one as correct, and optionally add an explanation
- [ ] Given Part 1 or Part 3/4, when I add a question, then I can upload an audio file (MP3, max 20 MB) or an image (JPEG/PNG, max 5 MB) as the stimulus
- [ ] Given a question group (Parts 3/4/6/7), when I create a stimulus, then I can attach multiple questions to that single stimulus
- [ ] Given a draft test, when I save, then the test remains in "draft" status and is not visible to learners
- [ ] Given I have at least 1 question, when I publish, then the test status changes to "published" and appears in the learner Test Library

**Out of scope for this story:** Bulk import of questions via CSV/spreadsheet, question bank/reuse across tests
**RICE Score:** Reach=15 × Impact=3 × Confidence=90% / Effort=5 = **8.1**

---

### US-003: Learner Takes a Full Timed Test (Strict Exam Fidelity)
As a learner, I want to take a full 200-question TOEIC test under strict exam conditions — single-play audio, hard timer, no pause — so that I experience exactly what I will face on actual TOEIC exam day.

**Exam fidelity rules (DECIDED):** Full-test mode is strict. The countdown timer runs continuously and cannot be paused. Audio plays exactly once per question/group — no replay button is shown. These rules are not configurable per-attempt; they apply to all full-test sittings.

**Acceptance Criteria:**
- [ ] Given a published test, when I click "Start Full Test," then an Attempt record is created with mode=full, the countdown timer starts at the configured time limit (default 120 min), and Part 1 Question 1 is displayed
- [ ] Given I am in full-test mode, when a Listening question loads, then audio plays automatically exactly once; no replay button or audio progress bar is shown
- [ ] Given I am in full-test mode, when I navigate away from or return to a Listening question that has already played, then the audio does NOT play again
- [ ] Given the hard timer is running, when I attempt to pause or navigate away, then the timer continues counting down and no pause action is available in the UI
- [ ] Given the timer expires, when time runs out, then all current answers are auto-submitted immediately and the attempt status is set to "expired"
- [ ] Given I click "Submit" before timer expiry, when fewer than 200 questions are answered, then I see a warning listing the count of unanswered questions and must confirm before submitting
- [ ] Given a submitted or expired attempt, when scoring completes, then the learner sees scaled scores (Listening / Reading / Total) within 5 seconds

**Out of scope for this story:** Section-level independent timers (Listening vs. Reading separately timed — deferred to v2), per-question time tracking
**RICE Score:** Reach=1500 × Impact=3 × Confidence=85% / Effort=5 = **765**

---

### US-004: Learner Practices by Part (Lenient Mode)
As a learner, I want to select one part of a TOEIC test and practice it at my own pace — with audio replay and instant feedback — so that I can deeply understand each question without exam pressure.

**Practice-mode rules (DECIDED):** No hard timer, no restrictions on audio replay. The goal is learning, not simulation. Contrast with full-test mode (US-003) which enforces strict exam fidelity.

**Acceptance Criteria:**
- [ ] Given a published test, when I select "Practice by Part" and choose a part (e.g., Part 5), then only that part's questions are shown with no countdown timer visible
- [ ] Given a Listening question in practice mode, when the question loads, then audio plays automatically AND a "Replay" button is visible; clicking Replay plays the audio again from the start
- [ ] Given I am in practice mode, when I select an answer and confirm, then I immediately see: whether I was correct, the correct answer highlighted, and the explanation text (if authored)
- [ ] Given practice mode, when I complete all questions in the selected part, then I see my raw score for that part (e.g., "18 / 30 correct") with no scaled-score calculation
- [ ] Given practice mode, when I navigate back to a previously answered question, then I can see my prior answer and the correct answer but cannot change it (answers are locked on first confirm)

**Out of scope for this story:** Cross-part combined practice sessions, spaced-repetition scheduling, optional per-question timer in practice mode
**RICE Score:** Reach=2000 × Impact=2 × Confidence=80% / Effort=3 = **1067**

---

### US-005: Learner Reviews Past Attempt
As a learner, I want to review a past test attempt question by question, so that I can understand my mistakes and learn from them.

**Acceptance Criteria:**
- [ ] Given I have a submitted attempt, when I navigate to "My Results" and click that attempt, then I see all 200 questions with: my answer, the correct answer, and whether I was right
- [ ] Given I am reviewing an attempt, when I filter by "Wrong answers only," then only questions I answered incorrectly are shown
- [ ] Given a question with an explanation, when I view it in review, then the explanation text is shown below the question

**Out of scope for this story:** Comparing multiple attempts over time (score trend charts), detailed per-skill analytics
**RICE Score:** Reach=1500 × Impact=2 × Confidence=85% / Effort=2 = **1275**

---

### US-006: Admin Manages User Roles
As an admin, I want to view all users and change their roles or deactivate accounts, so that I can control who has teacher privileges.

**Acceptance Criteria:**
- [ ] Given I am logged in as Admin, when I navigate to User Management, then I see a paginated list of all users with: email, role, status, registration date
- [ ] Given a user row, when I change their role from Learner to Teacher and confirm, then that user gains teacher permissions on next login
- [ ] Given a user row, when I deactivate an account, then that user cannot log in until reactivated

**Out of scope for this story:** Bulk user import via CSV, per-teacher content permission scoping
**RICE Score:** Reach=3 × Impact=2 × Confidence=95% / Effort=1 = **5.7**

---

### US-007: Score Calculation and Scaled Score Display
As a learner, I want to see my TOEIC scaled score (out of 990) after completing a full test, so that I understand my estimated actual TOEIC performance.

**Acceptance Criteria:**
- [ ] Given a submitted full-test attempt, when scoring is triggered, then raw scores per section (0–100 each) are computed by counting correct answers
- [ ] Given raw scores, when the system looks up the ScoreConversionTable, then it returns the correct scaled score for each section matching ETS conversion charts
- [ ] Given scaled scores for both sections, when displayed, then the learner sees: Listening scaled (5–495), Reading scaled (5–495), Total (10–990)
- [ ] Given a practice-mode attempt, when completed, then raw count only is shown — no scaled score

**Out of scope for this story:** Subscores by skill (grammar, vocabulary) — not part of standard TOEIC L&R scoring
**RICE Score:** Reach=1500 × Impact=3 × Confidence=90% / Effort=2 = **2025**

---

### US-008: Audio Playback for Listening Parts
As a learner, I want audio for Listening parts to play in the browser with mode-appropriate controls, so that I get strict exam simulation in full-test mode and unrestricted replay in practice mode.

**Audio policy (DECIDED — see TOEIC Domain Considerations):**
- Full-test mode: single play, no replay button, timer continues.
- Practice mode: auto-play on load + visible Replay button, no restrictions.

**Delivery:** Audio files are served via pre-signed URLs from file storage (AWS S3 recommended — see OQ-2). The NestJS backend generates short-lived pre-signed URLs; the React frontend fetches and plays them via the HTML5 `<audio>` element.

**Acceptance Criteria:**
- [ ] Given a Listening question in full-test mode, when the question loads, then the audio plays automatically exactly once; no replay button, no scrub bar, and no audio element controls are exposed to the learner
- [ ] Given a Listening question in practice mode, when the question loads, then the audio plays automatically and a "Replay" button is visible and functional (plays from the start on each click)
- [ ] Given the NestJS backend, when a learner fetches a question, then the response includes a pre-signed URL for the audio asset valid for ≥ 15 minutes (sufficient to cover the question's play time + buffer)
- [ ] Given an audio file upload by a Teacher, when the file MIME type is not audio/mpeg or audio/aac, then the upload is rejected with a 422 error and a message stating accepted formats (MP3, AAC)
- [ ] Given an audio file that fails to load in the browser, when the error event fires, then a visible error message is shown ("Audio unavailable — please notify your teacher") and the question remains answerable (learner is not penalized for the failure)

**Out of scope for this story:** Transcript display during the exam (only surfaced in post-attempt review), live audio recording, adaptive bitrate streaming
**RICE Score:** Reach=1500 × Impact=3 × Confidence=85% / Effort=3 = **1275**

---

## Prioritized Backlog

| # | Story ID | Title | RICE Score | Priority | Target Sprint |
|---|----------|-------|-----------|---------|--------------|
| 1 | US-001 | Learner Registration and Login | 6000 | P0 | Sprint 1 |
| 2 | US-002 | Teacher Creates a Test | 8.1* | P0 | Sprint 1–2 |
| 3 | US-007 | Score Calculation and Scaled Score Display | 2025 | P0 | Sprint 2 |
| 4 | US-004 | Learner Practices by Part | 1067 | P0 | Sprint 2 |
| 5 | US-005 | Learner Reviews Past Attempt | 1275 | P0 | Sprint 2 |
| 6 | US-008 | Audio Playback for Listening Parts | 1275 | P0 | Sprint 2 |
| 7 | US-003 | Learner Takes a Full Timed Test | 765 | P0 | Sprint 3 |
| 8 | US-006 | Admin Manages User Roles | 5.7* | P1 | Sprint 3 |

> *Note: US-002 and US-006 have low raw RICE because they serve a small user count (teachers/admins), but they are prerequisite — without content, no learner can use the platform. Treated as P0 regardless of RICE score.

---

## MVP Scope

### MUST ship (Sprint 1–3, v1.0):
- **Open self-registration** (email + password), login with JWT, role-based access (Admin, Teacher, Learner) — NestJS Guards + PostgreSQL
- Teacher: create/edit/publish a TOEIC test with all 7 parts, audio upload (MP3/AAC), image upload (JPEG/PNG) — assets stored in file storage (S3 recommended)
- Learner: take a full timed test (200 questions, hard countdown, **no pause**, audio plays once only) — strict TOEIC exam fidelity; auto-submit on timer expiry
- Learner: practice mode for individual parts — no timer, **unlimited audio replay**, instant per-question feedback
- Scaled score calculation using ETS conversion table (Listening + Reading + Total) — blocked on OQ-1 (copyright)
- Learner: review past attempts with correct/wrong answer display and explanations
- Admin: basic user role management (view users, change role, deactivate)
- Audio delivery via pre-signed URLs from file storage; HTML5 audio player in React frontend

### SHOULD ship (Sprint 4–6, v1.1):
- Teacher dashboard with per-test analytics (attempt count, score distribution)
- Learner score trend chart over multiple attempts
- Filter/search in Test Library (by part, difficulty tag)
- Email verification on registration
- Password reset via email
- Question explanation field displayed in review (v1.0 stores it, v1.1 surfaces it more prominently with formatting)

### WILL NOT ship (this release — explicitly deferred):
- Social login (Google, Facebook) — reason: adds OAuth complexity; basic auth sufficient for MVP
- Question bank / reuse questions across tests — reason: significant data model complexity; author can duplicate tests manually
- Spaced repetition / adaptive learning algorithm — reason: requires learning data history; build after data exists
- Speaking & Writing TOEIC module — reason: entirely different test format; out of scope for L&R focus
- Mobile native apps (iOS/Android) — reason: responsive web first, validate demand before native build
- LMS integrations (Canvas, Moodle) — reason: enterprise feature; not needed for MVP
- Section-level timers (Listening vs. Reading independently timed) — reason: complex UX; overall timer is sufficient for MVP
- Leaderboards / gamification — reason: nice-to-have, not core learning value
- Bulk CSV import of questions — reason: teacher tooling enhancement; manual entry sufficient for MVP scale

---

## Phased Roadmap

| Phase | Target | Key Deliverables |
|-------|--------|-----------------|
| **Phase 1 — MVP** | Sprint 1–3 (~6 weeks) | Auth, test creation (all 7 parts + audio), full timed test, practice mode, scaled scoring, result review, basic admin |
| **Phase 2 — Engagement** | Sprint 4–6 (~6 weeks) | Teacher analytics, learner progress dashboard, score trends, email flows, library search/filter |
| **Phase 3 — Scale & Retention** | Sprint 7–10 (~8 weeks) | Adaptive practice recommendations, question bank, difficulty tagging, mobile-responsive polish, performance optimization |
| **Phase 4 — Ecosystem** | TBD | Native apps, LMS integrations, TOEIC Speaking & Writing, institutional/school accounts |

---

## Success Metrics

| Metric | Current baseline | Target (3 months post-launch) | How measured |
|--------|-----------------|-------------------------------|-------------|
| Registered learners | 0 | 500 | User table count |
| Tests published | 0 | 10 | Test table, status=published |
| Full-test attempts completed | 0 | 1,000 | Attempt table, status=submitted |
| Avg. session duration | N/A | ≥ 30 min | Session tracking |
| Score improvement (2nd attempt vs. 1st) | N/A | +30 pts average | Score table, per-user delta |
| Audio playback error rate | N/A | < 1% of plays | Error logging |

---

## Open Questions

**Resolved (no longer blocking):**
- ~~Tech stack~~ — DECIDED: NestJS + React (TypeScript) + PostgreSQL (see Tech Stack section)
- ~~Signup model~~ — DECIDED: Open self-registration, no admin approval required (see US-001)
- ~~Audio replay in full-test mode~~ — DECIDED: Single play, no replay, no pause; strict exam fidelity (see US-003, US-008)
- ~~UI language(s)~~ — DECIDED: **Bilingual — English + Vietnamese**. App UI is bilingual (react-i18next from day one). Specifically, **answer/question explanations are presented in Vietnamese** so learners understand *why* a choice is correct in their native language, while the TOEIC question content itself (passages, choices, audio) remains in English as the test demands.

**Still open:**

| # | Question | Owner | Due date | Impact if unresolved |
|---|----------|-------|---------|----------------------|
| OQ-1 | Will the platform use the official ETS score conversion table, or an approximation? ETS tables are copyrighted — legal review needed to determine if we can reproduce them or must approximate. | Product / Legal | Before Sprint 2 | Blocks US-007 (scoring) — can build the lookup mechanism but cannot seed data until resolved |
| OQ-2 | File storage provider for audio/images: AWS S3 is the recommended default (NestJS + `@aws-sdk/client-s3` is a standard pairing). Confirm S3, or choose GCS/Cloudflare R2/local-disk. Affects infra cost, CDN strategy, and pre-signed URL implementation. | Engineering / Owner | Before Sprint 1 | Blocks US-002 (upload) and US-008 (audio delivery) |
| OQ-4 | Should teachers be able to edit a published test in place, or must they unpublish first? Editing in-flight risks inconsistency for active attempts. | Product | Before Sprint 2 | Affects US-002 acceptance criteria and data integrity rules |
| OQ-5 | Expected maximum concurrent users at launch — needed for PostgreSQL connection pool sizing, NestJS instance count, and S3 request rate estimates. | Stakeholder | Before Sprint 1 | Affects infra sizing and load-test targets |

---

## Assumptions

- The platform targets the TOEIC Listening & Reading (L&R) format only (not TOEIC Speaking & Writing).
- All 200 questions per test follow the fixed TOEIC L&R structure (Parts 1–7, question counts as specified).
- The platform is web-first; mobile support is via responsive design, not native apps.
- Audio files are pre-recorded and uploaded by teachers; there is no live audio recording feature.
- The platform is multi-tenant at the user level but single-tenant at the infrastructure level (one deployment, all users share).
- Learners answer in multiple-choice format only (4 choices, one correct answer per question).
- **Stack is fixed:** NestJS (TypeScript) backend, React (TypeScript) frontend, PostgreSQL database. Engineering may begin scaffolding immediately.
- **Signup is open:** Any visitor can create a Learner account. No invite gate, waitlist, or admin pre-approval.
- **Full-test mode is strict:** Hard timer (no pause), audio plays once per item, no replay. These are not configurable. Practice mode is lenient: no timer, unlimited audio replay, instant feedback.
