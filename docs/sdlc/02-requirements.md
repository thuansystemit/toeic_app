# Requirements --- TOEIC Learning Platform
**Date:** 2026-06-07  **Author:** @requirements-analyst  **Status:** REVIEWED
**Source:** `docs/sdlc/01-product-spec.md`

---

## Added Since Product Spec (Spec-Gap Audit)

The following requirements were NOT present in the PM's original stories but are mandated by the bilingual-UI decision (resolved in OQ-3) and by edge-case analysis. They are explicitly called out here so the trail is auditable.

| Gap ID | Description | Affected Stories | New REQs |
|--------|-------------|-----------------|----------|
| GAP-001 | **Explanation field per question** -- the data model must carry a Vietnamese-language explanation (`explanation_vi`, text, nullable). US-002 authoring must allow teachers to enter it. US-004 instant feedback and US-005 review must display it. | US-002, US-004, US-005 | REQ-020, REQ-021, REQ-022 |
| GAP-002 | **i18n -- every UI string must resolve in EN and VI** via react-i18next. Default locale selectable per user. Fallback behavior when a VI string key is missing: render the EN string, never render a raw key. | All | REQ-023, REQ-024, REQ-025, REQ-026 |
| GAP-003 | **TOEIC content vs. UI string distinction** -- TOEIC question text, passages, choices, and audio stay in English always (they are exam content, not UI). Only explanations and UI chrome are bilingual. | US-002, US-004, US-005 | REQ-027 |

**Assumption made:** `explanation_vi` is **nullable** (not required) at authoring time. A teacher may publish a test without explanations; learners see "No explanation available" in that case. This keeps MVP unblocked while encouraging gradual content enrichment.

---

## Formal Requirements

### Authentication and Registration (US-001)

| ID | Requirement (testable statement) | Priority | Source Story |
|----|----------------------------------|----------|-------------|
| REQ-001 | A visitor can self-register by providing a unique email, a password (>= 8 chars, >= 1 numeric digit), and a display name; the system creates a Learner-role account and returns JWT tokens | MUST | US-001 |
| REQ-002 | The system shall reject registration when the email is already registered, returning HTTP 409 and message "An account with this email already exists" without revealing account details | MUST | US-001 |
| REQ-003 | The system shall reject registration when the password fails strength rules (<8 chars OR no numeric digit), returning HTTP 422 with a specific validation message | MUST | US-001 |
| REQ-004 | A registered user can log in with email + password and receive a JWT access token (short-lived) and a refresh token (long-lived) | MUST | US-001 |
| REQ-005 | The system shall return HTTP 401 with "Invalid credentials" for incorrect password OR unregistered email, without distinguishing which is wrong | MUST | US-001 |
| REQ-006 | A registered user can request a password-reset email; the system sends a time-limited reset link (valid for 30 minutes) to the registered email | MUST | US-001 |
| REQ-007 | A valid reset link allows the user to set a new password that meets strength rules; an expired or already-used link returns HTTP 410 | MUST | US-001 |
| REQ-008 | The system shall normalize email addresses to lowercase before uniqueness check and storage | MUST | US-001 |
| REQ-009 | The system shall reject display names that are empty or exceed 100 characters | MUST | US-001 |

### Test Authoring (US-002)

| ID | Requirement | Priority | Source Story |
|----|-------------|----------|-------------|
| REQ-010 | A Teacher can create a new test (title, description, time limit defaulting to 120 min); the system scaffolds Parts 1-7 with target question counts per TOEIC spec | MUST | US-002 |
| REQ-011 | A Teacher can add a standalone question to a Part, providing question text, 4 choices (A-D), exactly one marked correct, and an optional explanation in Vietnamese | MUST | US-002 |
| REQ-012 | A Teacher can create a stimulus (audio, image, or text passage) and attach multiple questions to it (question group) for Parts 3, 4, 6, 7 | MUST | US-002 |
| REQ-013 | A Teacher can upload audio files (MIME audio/mpeg or audio/aac, max 20 MB) and image files (MIME image/jpeg or image/png, max 5 MB) to file storage; other MIME types are rejected with HTTP 422 | MUST | US-002 |
| REQ-014 | A draft test is not visible to Learners in the Test Library; only published tests appear | MUST | US-002 |
| REQ-015 | A Teacher can publish a draft test; publish shall be rejected if any Part has zero questions | MUST | US-002 |
| REQ-016 | A Teacher can save a test as draft at any time, even with incomplete parts | MUST | US-002 |
| REQ-017 | When a Teacher sets fewer than 4 choices or marks zero or more than one correct choice for a question, the system rejects the save with HTTP 422 | MUST | US-002 |
| REQ-018 | A test title must be non-empty and <= 200 characters; description <= 2000 characters | MUST | US-002 |
| REQ-019 | Upload file names containing special characters or Unicode shall be sanitized before storage; original name preserved in metadata | SHOULD | US-002 |

### Explanation and Bilingual Requirements (GAP-001, GAP-002, GAP-003)

| ID | Requirement | Priority | Source Story |
|----|-------------|----------|-------------|
| REQ-020 | The Question entity shall have a nullable `explanation_vi` text field (max 5000 chars) for Vietnamese-language explanation of the correct answer | MUST | US-002 (GAP-001) |
| REQ-021 | In practice mode (US-004), after a learner confirms an answer, the system shall display the Vietnamese explanation below the correct-answer highlight; if `explanation_vi` is null, display "Chua co giai thich" / "No explanation available" in the active locale | MUST | US-004 (GAP-001) |
| REQ-022 | In result review (US-005), the Vietnamese explanation shall be shown for every question alongside the learner's answer and the correct answer | MUST | US-005 (GAP-001) |
| REQ-023 | Every UI string (labels, buttons, messages, navigation) shall be defined in both EN and VI translation files managed by react-i18next | MUST | All (GAP-002) |
| REQ-024 | The user shall be able to select their preferred locale (EN or VI) from a persistent UI control; the selection is stored per user and survives session refresh | MUST | All (GAP-002) |
| REQ-025 | When a VI translation key is missing at runtime, the system shall fall back to the EN string; it shall never render a raw i18n key to the user | MUST | All (GAP-002) |
| REQ-026 | The default locale for unauthenticated visitors shall be VI (Vietnamese) | SHOULD | All (GAP-002) |
| REQ-027 | TOEIC question content (question text, passage text, choice text, audio) shall always render in English regardless of the user's locale setting; only explanations and UI chrome are locale-sensitive | MUST | US-002, US-004, US-005 (GAP-003) |

### Full Timed Test -- Strict Mode (US-003)

| ID | Requirement | Priority | Source Story |
|----|-------------|----------|-------------|
| REQ-030 | When a Learner clicks "Start Full Test" on a published test, the system creates an Attempt with mode=full, status=in-progress, and startedAt=now; the hard timer begins counting down from the test's time limit | MUST | US-003 |
| REQ-031 | The hard timer runs server-authoritative: the server records startedAt and timeLimitMinutes; the client displays a countdown synced to server time but the server enforces expiry independently | MUST | US-003 |
| REQ-032 | No pause, stop, or extend action is available to the Learner during a full-test attempt; the timer UI element has no interactive controls | MUST | US-003 |
| REQ-033 | When the timer reaches 0, the server auto-submits all answers recorded so far, sets attempt status to "expired", and triggers scoring | MUST | US-003 |
| REQ-034 | When a Learner manually submits before timer expiry with unanswered questions, the system shows a confirmation dialog listing the count of unanswered questions; submission proceeds only on explicit confirm | MUST | US-003 |
| REQ-035 | After submission or expiry, the attempt transitions to status "submitted" (manual) or "expired" (timeout); no further answers may be recorded for that attempt | MUST | US-003 |
| REQ-036 | The attempt state machine is: in-progress -> submitted (manual) OR in-progress -> expired (timeout). No other transitions are valid. Re-opening a submitted/expired attempt is not permitted | MUST | US-003 |
| REQ-037 | A Learner may have at most one in-progress full-test attempt per test at a time; starting a new attempt while one is in-progress shall resume the existing attempt, not create a duplicate | MUST | US-003 |
| REQ-038 | Unanswered questions at submission/expiry time are scored as incorrect (no penalty, but no credit) | MUST | US-003 |
| REQ-039 | Scaled scores shall be displayed to the Learner within 5 seconds of submission/expiry | SHOULD | US-003 |

### Practice Mode -- Lenient (US-004)

| ID | Requirement | Priority | Source Story |
|----|-------------|----------|-------------|
| REQ-040 | A Learner can select "Practice by Part" on a published test and choose exactly one Part to practice; the system creates an Attempt with mode=practice | MUST | US-004 |
| REQ-041 | No countdown timer is shown or enforced in practice mode | MUST | US-004 |
| REQ-042 | In practice mode, after a Learner confirms an answer for a question, the system immediately reveals: (a) whether the answer is correct, (b) the correct choice highlighted, (c) the Vietnamese explanation (REQ-021) | MUST | US-004 |
| REQ-043 | In practice mode, once a Learner confirms an answer for a question, that answer is locked; navigating back shows the locked answer and feedback but does not allow changes | MUST | US-004 |
| REQ-044 | On completing all questions in the practiced part, the system shows raw score only (e.g. "18 / 30 correct"); no scaled score is computed or displayed | MUST | US-004 |
| REQ-045 | For Listening questions in practice mode, audio auto-plays on load AND a visible "Replay" button allows unlimited replays from the start | MUST | US-004, US-008 |
| REQ-046 | A practice attempt has no expiry mechanism; the Learner may close and return later; if the session is lost, unanswered questions remain available | SHOULD | US-004 |

### Result Review (US-005)

| ID | Requirement | Priority | Source Story |
|----|-------------|----------|-------------|
| REQ-050 | A Learner can view a list of their past attempts ("My Results") showing: test name, date, mode, score, status; ordered by most recent first; paginated | MUST | US-005 |
| REQ-051 | Clicking an attempt shows all questions with: question text, the Learner's selected answer, the correct answer, correct/incorrect indicator, and the Vietnamese explanation | MUST | US-005 |
| REQ-052 | The Learner can filter the review to show "Wrong answers only" | MUST | US-005 |
| REQ-053 | In review mode, audio stimuli can be replayed (review is non-timed) | SHOULD | US-005 |
| REQ-054 | For question groups, the review displays the shared stimulus once followed by all grouped questions | MUST | US-005 |

### Admin User Management (US-006)

| ID | Requirement | Priority | Source Story |
|----|-------------|----------|-------------|
| REQ-060 | An Admin can view a paginated list of all users with columns: email, display name, role, status (active/deactivated), registration date, last login date | MUST | US-006 |
| REQ-061 | An Admin can change a user's role (Learner <-> Teacher); the change takes effect on the user's next token refresh or login | MUST | US-006 |
| REQ-062 | An Admin can deactivate a user account; a deactivated user's existing tokens are invalidated and login is blocked until reactivated | MUST | US-006 |
| REQ-063 | An Admin cannot deactivate their own account or change their own role | MUST | US-006 |
| REQ-064 | An Admin can reactivate a deactivated account | MUST | US-006 |
| REQ-065 | User list supports search by email substring and filter by role | SHOULD | US-006 |

### Score Calculation (US-007)

| ID | Requirement | Priority | Source Story |
|----|-------------|----------|-------------|
| REQ-070 | After a full-test attempt is submitted/expired, the system computes raw scores: Listening raw = count of correct answers in Parts 1-4 (max 100), Reading raw = count of correct answers in Parts 5-7 (max 100) | MUST | US-007 |
| REQ-071 | The system looks up raw scores in the ScoreConversionTable and returns scaled scores: Listening 5-495, Reading 5-495, Total 10-990 | MUST | US-007 |
| REQ-072 | For raw score = 0, the scaled score shall be the table minimum (5 per section); for raw score = 100, the scaled score shall be the table maximum (495 per section) | MUST | US-007 |
| REQ-073 | If a raw score has no entry in the conversion table (data gap), the system shall return an error to the admin dashboard and show the learner raw scores with a message "Scaled score temporarily unavailable" | MUST | US-007 |
| REQ-074 | Practice-mode attempts show raw count only; no conversion-table lookup is performed | MUST | US-007 |
| REQ-075 | The ScoreConversionTable is admin-seeded (not user-editable); it contains exactly 101 rows per section (raw 0-100) | MUST | US-007 |

### Audio Playback (US-008)

| ID | Requirement | Priority | Source Story |
|----|-------------|----------|-------------|
| REQ-080 | In full-test mode, audio auto-plays exactly once when a Listening question/group loads; no replay button, scrub bar, or native audio controls are exposed | MUST | US-008 |
| REQ-081 | In full-test mode, if a Learner navigates away from and returns to a Listening question whose audio has already played, the audio does NOT play again | MUST | US-008 |
| REQ-082 | In practice mode, audio auto-plays on question load AND a "Replay" button is visible; clicking Replay restarts audio from the beginning with no limit on replays | MUST | US-008 |
| REQ-083 | The NestJS backend generates a pre-signed URL for each audio asset with a minimum validity of 15 minutes | MUST | US-008 |
| REQ-084 | If a pre-signed URL expires mid-session (e.g., a learner idles), the frontend shall request a fresh URL from the backend before attempting playback; this refresh is invisible to the learner | MUST | US-008 |
| REQ-085 | If audio fails to load (network error, 403 on expired URL after retry, corrupt file), the UI shows "Audio unavailable -- please notify your teacher" and the question remains answerable | MUST | US-008 |
| REQ-086 | Teacher audio uploads are validated server-side: MIME must be audio/mpeg or audio/aac, size <= 20 MB; violations return HTTP 422 with accepted-format message | MUST | US-008 |

### Non-Functional Requirements

| ID | Requirement | Priority | Source Story |
|----|-------------|----------|-------------|
| NFR-001 | API response time for question fetch (including pre-signed URL generation) shall be < 500ms at p95 under 200 concurrent users | SHOULD | US-003, US-008 |
| NFR-002 | Score computation and display shall complete within 5 seconds of attempt submission | SHOULD | US-003, US-007 |
| NFR-003 | The system shall handle concurrent registration attempts with the same email via database unique constraint; exactly one succeeds, the other receives HTTP 409 | MUST | US-001 |
| NFR-004 | All passwords shall be hashed with bcrypt (cost factor >= 10) before storage; plaintext passwords are never stored or logged | MUST | US-001 |
| NFR-005 | JWT access tokens shall expire in <= 15 minutes; refresh tokens in <= 7 days | MUST | US-001 |
| NFR-006 | File uploads shall be streamed to S3 (not buffered entirely in server memory) to support 20 MB audio files without OOM risk | SHOULD | US-002 |
| NFR-007 | All API endpoints shall enforce RBAC: Learner cannot access teacher/admin routes; Teacher cannot access admin routes | MUST | All |
| NFR-008 | Audio playback error rate shall be < 1% of total plays measured over any 7-day window | SHOULD | US-008 |

---

## Acceptance Criteria (Gherkin)

### Feature: User Registration (US-001)

```gherkin
Feature: User Registration

  Scenario: SC-001 Successful self-registration
    Given a visitor is on the registration page
    When they submit email "learner@example.com", password "Secure1pass", display name "Minh"
    Then the system creates an account with role "Learner"
    And the system returns a JWT access token and refresh token
    And the visitor is redirected to the Test Library page

  Scenario: SC-002 Registration rejected -- duplicate email
    Given an account with email "existing@example.com" already exists
    When a visitor submits registration with email "existing@example.com"
    Then the system returns HTTP 409
    And the response message is "An account with this email already exists"
    And no duplicate account is created

  Scenario: SC-003 Registration rejected -- duplicate email race condition
    Given no account with email "race@example.com" exists
    When two registration requests for "race@example.com" arrive simultaneously
    Then exactly one account is created
    And the other request returns HTTP 409

  Scenario: SC-004 Registration rejected -- password too short
    Given a visitor is on the registration page
    When they submit password "Short1"
    Then the system returns HTTP 422
    And the validation message indicates password must be at least 8 characters

  Scenario: SC-005 Registration rejected -- password missing number
    Given a visitor is on the registration page
    When they submit password "NoNumberHere"
    Then the system returns HTTP 422
    And the validation message indicates password must contain at least 1 number

  Scenario: SC-006 Registration rejected -- empty display name
    Given a visitor is on the registration page
    When they submit an empty display name
    Then the system returns HTTP 422

  Scenario: SC-007 Registration rejected -- display name exceeds 100 chars
    Given a visitor is on the registration page
    When they submit a display name of 101 characters
    Then the system returns HTTP 422

  Scenario: SC-008 Email normalization
    Given an account with email "User@Example.COM" is registered
    When another visitor tries to register with "user@example.com"
    Then the system returns HTTP 409 (duplicate detected after normalization)
```

### Feature: User Login (US-001)

```gherkin
Feature: User Login

  Scenario: SC-010 Successful login
    Given a user has a registered active account with email "learner@example.com"
    When they submit correct email and password on the login form
    Then the system returns a JWT access token (expiry <= 15 min) and refresh token (expiry <= 7 days)
    And the user is redirected to their role-appropriate dashboard

  Scenario: SC-011 Login fails -- wrong password
    Given a user has a registered account
    When they submit the correct email but wrong password
    Then the system returns HTTP 401 with message "Invalid credentials"
    And no tokens are issued

  Scenario: SC-012 Login fails -- unregistered email
    Given no account exists for "ghost@example.com"
    When someone submits login with "ghost@example.com"
    Then the system returns HTTP 401 with message "Invalid credentials"
    And the error is indistinguishable from a wrong-password error

  Scenario: SC-013 Login fails -- deactivated account
    Given an admin has deactivated the account for "suspended@example.com"
    When the user tries to log in with correct credentials
    Then the system returns HTTP 403 with message "Account deactivated"
    And no tokens are issued

  Scenario: SC-014 Token refresh
    Given a user holds a valid refresh token
    When they call the token refresh endpoint
    Then the system returns a new access token
    And the old access token is no longer valid after its original expiry
```

### Feature: Password Reset (US-001)

```gherkin
Feature: Password Reset

  Scenario: SC-015 Password reset request -- valid email
    Given a user with email "user@example.com" exists
    When they request a password reset
    Then the system sends a reset email with a time-limited link (30 min validity)
    And the response says "If that email is registered, a reset link has been sent"

  Scenario: SC-016 Password reset request -- unregistered email
    Given no account exists for "nobody@example.com"
    When someone requests a password reset for that email
    Then the response says "If that email is registered, a reset link has been sent"
    And no email is sent (no information leak)

  Scenario: SC-017 Password reset -- valid link
    Given a user has received a valid reset link
    When they follow the link and submit a new password meeting strength rules
    Then the password is updated
    And all existing sessions/tokens for that user are invalidated

  Scenario: SC-018 Password reset -- expired link
    Given a user received a reset link 31 minutes ago
    When they follow the link
    Then the system returns HTTP 410 "Reset link has expired"

  Scenario: SC-019 Password reset -- link reuse
    Given a user has already used a reset link successfully
    When they attempt to use the same link again
    Then the system returns HTTP 410 "Reset link has already been used"
```

### Feature: Test Authoring (US-002)

```gherkin
Feature: Test Authoring

  Scenario: SC-020 Create new draft test
    Given a user is logged in as Teacher
    When they click "Create Test" and provide title "TOEIC Practice 1" and description
    Then a new test is created with status "draft"
    And Parts 1-7 are scaffolded with target question counts (6, 25, 39, 30, 30, 16, 54)

  Scenario: SC-021 Add standalone question with explanation
    Given a Teacher is editing Part 5 of a draft test
    When they add a question with text, 4 choices (one marked correct), and Vietnamese explanation "Day la cau tra loi dung vi..."
    Then the question is saved with the explanation in the explanation_vi field

  Scenario: SC-022 Add question without explanation
    Given a Teacher is editing a Part
    When they add a question with text and 4 choices but leave explanation blank
    Then the question is saved with explanation_vi = null

  Scenario: SC-023 Upload audio stimulus
    Given a Teacher is editing Part 1
    When they upload an MP3 file of 15 MB
    Then the file is stored in S3 and a stimulus record is created linked to the Part

  Scenario: SC-024 Upload rejected -- invalid MIME type
    Given a Teacher attempts to upload a WAV audio file
    Then the system returns HTTP 422 with "Accepted formats: MP3, AAC"

  Scenario: SC-025 Upload rejected -- file too large
    Given a Teacher attempts to upload a 25 MB audio file
    Then the system returns HTTP 422 with "Audio files must be 20 MB or less"

  Scenario: SC-026 Upload image -- valid
    Given a Teacher is editing Part 1
    When they upload a JPEG image of 3 MB
    Then the image is stored and linked as a stimulus

  Scenario: SC-027 Upload image -- too large
    Given a Teacher attempts to upload a 6 MB PNG
    Then the system returns HTTP 422 with "Image files must be 5 MB or less"

  Scenario: SC-028 Create question group
    Given a Teacher is editing Part 3
    When they create a stimulus (audio conversation) and attach 3 questions to it
    Then all 3 questions share the same stimulusId

  Scenario: SC-029 Publish test -- success
    Given a draft test where every Part has at least 1 question
    When the Teacher clicks "Publish"
    Then the test status changes to "published"
    And the test appears in the Learner Test Library

  Scenario: SC-030 Publish test -- rejected (empty part)
    Given a draft test where Part 2 has zero questions
    When the Teacher clicks "Publish"
    Then the system rejects with HTTP 422 "Part 2 has no questions"
    And the test remains in "draft" status

  Scenario: SC-031 Save draft with incomplete parts
    Given a Teacher has added questions to Parts 1 and 5 only
    When they click "Save Draft"
    Then the test is saved in "draft" status with no validation errors

  Scenario: SC-032 Invalid question -- fewer than 4 choices
    Given a Teacher is adding a question
    When they provide only 3 choices
    Then the system returns HTTP 422 "Exactly 4 choices required"

  Scenario: SC-033 Invalid question -- no correct answer marked
    Given a Teacher is adding a question with 4 choices
    When none is marked as correct
    Then the system returns HTTP 422 "Exactly one choice must be marked correct"

  Scenario: SC-034 Invalid question -- multiple correct answers
    Given a Teacher is adding a question with 4 choices
    When 2 choices are marked as correct
    Then the system returns HTTP 422 "Exactly one choice must be marked correct"

  Scenario: SC-035 Filename sanitization on upload
    Given a Teacher uploads a file named "audio (test) #1 .mp3"
    When the server processes the upload
    Then the stored filename is sanitized (no special chars)
    And the original filename is preserved in file metadata
```

### Feature: Full Timed Test (US-003)

```gherkin
Feature: Full Timed Test - Strict Mode

  Scenario: SC-040 Start full test -- attempt created
    Given a Learner is viewing a published test
    When they click "Start Full Test"
    Then an Attempt record is created with mode=full, status=in-progress, startedAt=now
    And the countdown timer starts at the test's time limit (120 minutes)
    And Part 1, Question 1 is displayed

  Scenario: SC-041 Timer runs without pause
    Given a Learner is in a full-test attempt
    When they look for pause/stop controls
    Then no such controls exist in the UI
    And the timer continues decrementing every second

  Scenario: SC-042 Timer reaches exactly 0 -- auto-submit
    Given a Learner is in a full-test attempt with 1 second remaining
    When the timer reaches 00:00:00
    Then all currently recorded answers are submitted
    And the attempt status changes to "expired"
    And scoring is triggered immediately
    And no further answers can be recorded

  Scenario: SC-043 Learner submits with all questions answered
    Given a Learner has answered all 200 questions
    When they click "Submit"
    Then the attempt status changes to "submitted"
    And scoring is triggered
    And scaled scores are displayed

  Scenario: SC-044 Learner submits with unanswered questions
    Given a Learner has answered 180 of 200 questions
    When they click "Submit"
    Then a confirmation dialog appears: "You have 20 unanswered questions. Submit anyway?"
    And if the Learner confirms, the attempt is submitted
    And the 20 unanswered questions are scored as incorrect

  Scenario: SC-045 Learner cancels submit confirmation
    Given the unanswered-question confirmation dialog is shown
    When the Learner clicks "Cancel"
    Then the dialog closes and the attempt remains in-progress
    And the timer continues running

  Scenario: SC-046 Attempt state: no re-open after submit
    Given an attempt with status "submitted"
    When the Learner attempts to navigate to that test's in-progress URL
    Then the system redirects to the result review page
    And no answers can be modified

  Scenario: SC-047 Attempt state: no re-open after expiry
    Given an attempt with status "expired"
    When the Learner attempts to navigate to that test's in-progress URL
    Then the system redirects to the result review page

  Scenario: SC-048 Duplicate in-progress attempt prevention
    Given a Learner already has an in-progress full-test attempt for Test X
    When they click "Start Full Test" on Test X again
    Then the system resumes the existing attempt (same Attempt ID)
    And the timer shows the remaining time from the original startedAt
    And no new Attempt is created

  Scenario: SC-049 Network disconnection during full test
    Given a Learner is in a full-test attempt
    When the network drops and reconnects
    Then answers submitted before the drop are preserved on the server
    And the timer on reconnection re-syncs with the server
    And the Learner can continue answering

  Scenario: SC-050 Server-authoritative timer enforcement
    Given a Learner's browser clock is 5 minutes ahead of server time
    When the server calculates remaining time as startedAt + timeLimitMinutes
    Then the server enforces expiry based on server time, not client time
    And a client cannot extend the timer by manipulating the local clock
```

### Feature: Practice Mode (US-004)

```gherkin
Feature: Practice Mode - Lenient

  Scenario: SC-060 Start practice session
    Given a Learner views a published test
    When they select "Practice by Part" and choose Part 5
    Then an Attempt with mode=practice is created
    And only Part 5 questions are displayed
    And no countdown timer is visible

  Scenario: SC-061 Instant feedback after answering
    Given a Learner is in practice mode on a question
    When they select choice B and confirm
    Then the system immediately shows whether B is correct or incorrect
    And the correct answer is highlighted
    And the Vietnamese explanation is displayed (or "Chua co giai thich" if null)

  Scenario: SC-062 Answer lock on navigate back
    Given a Learner has answered and confirmed Question 3 in practice mode
    When they navigate back to Question 3
    Then they see their locked answer and the feedback
    And the answer selection is disabled -- they cannot change it

  Scenario: SC-063 Practice completion -- raw score display
    Given a Learner has answered all 30 questions in Part 5 practice
    When the last question is confirmed
    Then the system displays "18 / 30 correct" (example)
    And no scaled score is shown

  Scenario: SC-064 No timer enforcement in practice
    Given a Learner starts practice mode at 10:00 AM
    When they answer the last question at 3:00 PM (5 hours later)
    Then the session completes normally with no timeout

  Scenario: SC-065 Practice session resume after browser close
    Given a Learner has answered 10 of 30 questions in practice mode and closes the browser
    When they return and navigate to the same practice attempt
    Then questions 1-10 show as answered with feedback
    And questions 11-30 are available for answering
```

### Feature: Result Review (US-005)

```gherkin
Feature: Result Review

  Scenario: SC-070 View past attempts list
    Given a Learner has completed 3 attempts
    When they navigate to "My Results"
    Then they see a paginated list of 3 attempts
    And each entry shows: test name, date, mode (full/practice), score, status
    And the list is ordered most recent first

  Scenario: SC-071 Review a full-test attempt -- all questions
    Given a Learner clicks on a completed full-test attempt
    Then they see all 200 questions with:
      | Field | Shown |
      | Question text | Yes |
      | Learner's answer | Yes (highlighted) |
      | Correct answer | Yes (highlighted) |
      | Correct/incorrect indicator | Yes |
      | Vietnamese explanation | Yes (or "No explanation available") |

  Scenario: SC-072 Filter wrong answers only
    Given a Learner is reviewing a full-test attempt where they got 40 wrong
    When they toggle "Show only wrong answers"
    Then only the 40 incorrect questions are displayed
    And toggling off restores the full list

  Scenario: SC-073 Question group display in review
    Given a Part 3 stimulus is shared by 3 questions
    When the Learner reviews those questions
    Then the stimulus (audio/passage) is shown once
    And all 3 questions appear beneath it

  Scenario: SC-074 Audio replay in review mode
    Given a Learner is reviewing a Listening question
    When they click the audio play button
    Then the audio plays (unlimited replays allowed in review mode)

  Scenario: SC-075 Review practice attempt
    Given a Learner completed a practice attempt for Part 5
    When they view it in "My Results"
    Then the raw score is shown (e.g. "18 / 30")
    And no scaled score is displayed
```

### Feature: Admin User Management (US-006)

```gherkin
Feature: Admin User Management

  Scenario: SC-080 View paginated user list
    Given an Admin is logged in
    When they navigate to User Management
    Then they see a paginated list of all users
    And each row shows: email, display name, role, status, registration date, last login

  Scenario: SC-081 Change role: Learner to Teacher
    Given an Admin views a user with role "Learner"
    When the Admin changes their role to "Teacher" and confirms
    Then the user's role is updated in the database
    And the change takes effect on the user's next token refresh or login

  Scenario: SC-082 Change role: Teacher to Learner
    Given an Admin views a user with role "Teacher"
    When the Admin changes their role to "Learner" and confirms
    Then the user's role is updated
    And teacher-specific features become inaccessible after re-authentication

  Scenario: SC-083 Deactivate user
    Given an Admin views an active user
    When the Admin clicks "Deactivate" and confirms
    Then the user's status changes to "deactivated"
    And the user's existing tokens are invalidated
    And the user cannot log in

  Scenario: SC-084 Reactivate user
    Given an Admin views a deactivated user
    When the Admin clicks "Reactivate"
    Then the user's status changes to "active"
    And the user can log in again

  Scenario: SC-085 Admin cannot self-deactivate
    Given an Admin is viewing their own user record
    When they attempt to deactivate their own account
    Then the system rejects with "Cannot deactivate your own account"

  Scenario: SC-086 Admin cannot change own role
    Given an Admin is viewing their own user record
    When they attempt to change their own role
    Then the system rejects with "Cannot change your own role"

  Scenario: SC-087 Permission change while user is in session
    Given an Admin changes a user's role from Teacher to Learner
    And the user currently holds a valid access token with role=Teacher
    When the user's access token expires and they refresh
    Then the new access token has role=Learner
    And teacher routes return HTTP 403
```

### Feature: Score Calculation (US-007)

```gherkin
Feature: Score Calculation

  Scenario: SC-090 Raw score computation
    Given a full-test attempt is submitted with 85 correct in Listening and 70 correct in Reading
    When scoring is triggered
    Then Listening raw score = 85, Reading raw score = 70

  Scenario: SC-091 Scaled score lookup
    Given Listening raw = 85 and Reading raw = 70
    When the system looks up the ScoreConversionTable
    Then it returns the corresponding scaled scores (e.g. L=420, R=340, Total=760)

  Scenario: SC-092 Boundary: raw score = 0
    Given a Learner answered zero questions correctly
    When scoring is triggered
    Then Listening scaled = 5, Reading scaled = 5, Total = 10

  Scenario: SC-093 Boundary: raw score = 100
    Given a Learner answered all 100 Listening and all 100 Reading correctly
    When scoring is triggered
    Then Listening scaled = 495, Reading scaled = 495, Total = 990

  Scenario: SC-094 Missing conversion table entry
    Given the ScoreConversionTable has no entry for Listening raw = 47
    When scoring is triggered for that raw score
    Then the system logs an error for admin review
    And the Learner sees raw scores with message "Scaled score temporarily unavailable"

  Scenario: SC-095 Practice mode -- no scaled score
    Given a practice attempt is completed
    When the results are displayed
    Then only raw score is shown (e.g. "22 / 30 correct")
    And no conversion table lookup occurs

  Scenario: SC-096 Unanswered questions scored as incorrect
    Given a full-test attempt expired with 50 unanswered questions
    When scoring is triggered
    Then the 50 unanswered questions count as incorrect (raw score reflects only answered-correct)
```

### Feature: Audio Playback (US-008)

```gherkin
Feature: Audio Playback

  Scenario: SC-100 Full-test mode -- audio plays once
    Given a Learner is in full-test mode on a Listening question
    When the question loads
    Then the audio auto-plays exactly once
    And no replay button is visible
    And no scrub bar or native audio controls are shown

  Scenario: SC-101 Full-test mode -- no replay on revisit
    Given a Learner is in full-test mode and has already heard Question 5's audio
    When they navigate away and return to Question 5
    Then the audio does NOT play again
    And no replay option is available

  Scenario: SC-102 Practice mode -- replay unlimited
    Given a Learner is in practice mode on a Listening question
    When the question loads
    Then the audio auto-plays
    And a "Replay" button is visible
    When the Learner clicks "Replay" 5 times
    Then the audio plays from the start each time without restriction

  Scenario: SC-103 Pre-signed URL generation
    Given a Learner requests a Listening question
    When the backend serves the question data
    Then the response includes a pre-signed URL for the audio asset
    And the URL is valid for at least 15 minutes

  Scenario: SC-104 Pre-signed URL expiry mid-session -- auto-refresh
    Given a Learner has been idle for 20 minutes in a full-test attempt
    When they navigate to a Listening question whose pre-signed URL has expired
    Then the frontend detects the 403 error
    And requests a fresh pre-signed URL from the backend
    And plays the audio using the new URL (if in practice mode) or proceeds without replay (if in full-test mode and audio already played)

  Scenario: SC-105 Audio load failure -- graceful fallback
    Given a Listening question's audio file is corrupted or unreachable
    When the audio element fires an error event
    Then the UI shows "Audio unavailable -- please notify your teacher"
    And the question remains answerable (choices are still selectable)
    And the Learner is not penalized for the system error

  Scenario: SC-106 Question group audio -- single play for group (full-test)
    Given a Part 3 question group shares one audio stimulus
    When the group's first question loads in full-test mode
    Then the audio plays once for the entire group
    And navigating between questions within the group does NOT re-trigger the audio
```

### Feature: Bilingual UI (GAP-002)

```gherkin
Feature: Bilingual UI (i18n)

  Scenario: SC-110 Locale switcher available
    Given any page in the application
    When the user looks for a locale control
    Then a language selector (EN / VI) is visible in the header/nav

  Scenario: SC-111 Switch locale EN to VI
    Given the user's current locale is EN
    When they select VI from the locale switcher
    Then all UI strings (buttons, labels, navigation, messages) render in Vietnamese
    And TOEIC question content (passages, choices) remains in English
    And the preference is persisted (survives page refresh)

  Scenario: SC-112 Missing VI translation key -- fallback
    Given a UI string key "feature.new_label" exists in EN but not VI
    When the user's locale is VI
    Then the EN string is rendered for that key
    And no raw key like "feature.new_label" is ever shown to the user

  Scenario: SC-113 Default locale for visitors
    Given a visitor has not yet registered or selected a locale
    When they visit the site
    Then the UI renders in Vietnamese (VI) by default

  Scenario: SC-114 Explanation displays in Vietnamese regardless of locale
    Given a Learner's locale is set to EN
    When they view a question explanation (in practice feedback or result review)
    Then the explanation text renders in Vietnamese (as authored by the teacher)
    And the surrounding UI (labels like "Explanation:") renders in EN per the user's locale
```

---

## Edge Cases Identified

| EC-ID | Scenario Description | Required Handling |
|-------|---------------------|-------------------|
| EC-001 | Timer reaches exactly 0 seconds during answer submission (race condition) | Server must accept the answer only if received before the server-side expiry timestamp; if after, discard and auto-submit without it |
| EC-002 | Pre-signed URL expires while Learner is mid-session (idle > 15 min) | Frontend detects 403 on audio fetch, silently requests fresh URL from backend, retries playback |
| EC-003 | Two users register with the same email simultaneously (race condition) | PostgreSQL UNIQUE constraint on email ensures exactly one insert succeeds; the other gets HTTP 409 |
| EC-004 | Learner's browser tab is closed mid full-test without submitting | Attempt remains in-progress; server-side timer still runs; if timer expires, server auto-expires the attempt on next check or via scheduled job |
| EC-005 | Question group in Parts 3/4/6/7 with partial answers at submission | Unanswered questions in a group are scored as incorrect; the stimulus is submitted regardless of how many grouped questions are answered |
| EC-006 | ScoreConversionTable has gap at raw=47 | System returns raw scores and "Scaled score temporarily unavailable" message; admin alert triggered |
| EC-007 | Teacher uploads file with 0 bytes | Server rejects with HTTP 422 "File is empty" |
| EC-008 | Learner refreshes browser during full-test attempt | Attempt resumes from server state; answered questions are preserved; timer re-syncs; audio replay rules still enforced (already-played audio does not replay) |
| EC-009 | Admin deactivates a user who is mid-test | User's current session continues until token expiry (max 15 min); after that, token refresh fails, and the attempt is eventually expired by the server-side timer |
| EC-010 | Learner attempts practice mode on a test that becomes unpublished mid-session | If test is unpublished during an active practice session, the current session may complete but new attempts cannot start; answered questions are preserved |
| EC-011 | Special characters in question text or choices (Unicode, HTML, emoji) | All user-generated text must be properly escaped/sanitized on output to prevent XSS; Unicode is stored and displayed correctly |
| EC-012 | Test with time limit = 0 minutes (misconfiguration) | Server rejects test creation/update with timeLimitMinutes < 1; minimum is 1 minute |
| EC-013 | Learner navigates directly to question N via URL manipulation in full-test mode | Server validates that the question belongs to the active attempt's test; navigation is allowed (questions are not forced sequential in Reading) but audio-already-played tracking persists |
| EC-014 | Session expiry during multi-step test creation (Teacher) | Draft is auto-saved on each question add; teacher must re-authenticate but does not lose work |
| EC-015 | Display name with only whitespace characters | Trimmed to empty string, rejected as REQ-009 |

---

## Conflicts and Ambiguities Resolved

| # | Original Ambiguity | Resolution | Decision Owner |
|---|--------------------|-----------|---------------|
| C-001 | PM spec says "explanation" field but does not specify language or field name for bilingual context | Resolved: field is `explanation_vi` (Vietnamese text, nullable). TOEIC content stays EN; explanations are VI per the bilingual decision. | @requirements-analyst (per UI language decision) |
| C-002 | PM spec US-005 says "explanation text is shown" but does not specify behavior when explanation is null | Resolved: Display "Chua co giai thich" (VI) or "No explanation available" (EN) per locale. Explanation is nullable at authoring time. | @requirements-analyst |
| C-003 | Full-test: should audio-played tracking be client-side or server-side? | Resolved: Server tracks which audio stimuli have been played per attempt (AttemptAudioLog or equivalent). Client cannot spoof replay. | @requirements-analyst |
| C-004 | What happens to an in-progress attempt when the test is unpublished? | Resolved: Active in-progress attempts continue to completion. New attempts cannot start. This mirrors exam-day policy -- once started, you finish. | @requirements-analyst (pending OQ-4 final decision) |
| C-005 | Password reset link validity period not specified in PM spec | Resolved: 30 minutes, single-use. Consistent with security best practices. | @requirements-analyst |
| C-006 | PM spec says practice mode "answers lock when navigating back" but does not specify the lock trigger | Resolved: Lock occurs on explicit "Confirm" action (not on mere selection). Learner selects a choice, then clicks Confirm to lock and see feedback. | @requirements-analyst |

---

## Out of Scope (Explicit)

| Item | Reason Excluded |
|------|----------------|
| Social login (Google/Facebook) | Deferred -- adds OAuth complexity; basic auth sufficient for MVP |
| Question bank / cross-test reuse | Significant data model complexity; teacher can duplicate tests manually |
| Spaced repetition / adaptive learning | Requires learning data history; build after usage data exists |
| TOEIC Speaking and Writing module | Entirely different test format; L&R focus only |
| Native iOS/Android apps | Responsive web first; validate demand before native build |
| LMS integrations (Canvas, Moodle) | Enterprise feature; not needed for MVP |
| Section-level timers (L vs. R independently timed) | Complex UX; overall timer sufficient for MVP |
| Leaderboards / gamification | Nice-to-have; not core learning value |
| Bulk CSV import of questions | Teacher tooling enhancement; manual entry sufficient at MVP scale |
| Email verification gating | Deferred to v1.1 |
| Admin-driven enrollment / invite codes | Decided: open self-registration model |
| Multi-language explanations (beyond VI) | Only EN+VI for MVP; other languages are future scope |
| Offline mode / PWA | Requires service worker complexity; web-only for MVP |

---

## Traceability Matrix

| REQ ID | User Story | Gherkin Scenario(s) | Notes |
|--------|-----------|---------------------|-------|
| REQ-001 | US-001 | SC-001 | Happy path registration |
| REQ-002 | US-001 | SC-002, SC-003 | Duplicate + race condition |
| REQ-003 | US-001 | SC-004, SC-005 | Password validation |
| REQ-004 | US-001 | SC-010, SC-014 | Login + token refresh |
| REQ-005 | US-001 | SC-011, SC-012 | Failed login (ambiguous error) |
| REQ-006 | US-001 | SC-015, SC-016 | Password reset request |
| REQ-007 | US-001 | SC-017, SC-018, SC-019 | Password reset execution |
| REQ-008 | US-001 | SC-008 | Email normalization |
| REQ-009 | US-001 | SC-006, SC-007 | Display name validation |
| REQ-010 | US-002 | SC-020 | Test creation + scaffolding |
| REQ-011 | US-002 | SC-021, SC-022 | Question + explanation authoring |
| REQ-012 | US-002 | SC-028 | Question groups |
| REQ-013 | US-002 | SC-023, SC-024, SC-025, SC-026, SC-027 | File upload validation |
| REQ-014 | US-002 | SC-029 | Draft visibility |
| REQ-015 | US-002 | SC-029, SC-030 | Publish validation |
| REQ-016 | US-002 | SC-031 | Save draft |
| REQ-017 | US-002 | SC-032, SC-033, SC-034 | Choice validation |
| REQ-018 | US-002 | SC-020 | Title/description limits |
| REQ-019 | US-002 | SC-035 | Filename sanitization |
| REQ-020 | US-002 (GAP-001) | SC-021, SC-022 | Explanation_vi field |
| REQ-021 | US-004 (GAP-001) | SC-061 | Explanation in practice feedback |
| REQ-022 | US-005 (GAP-001) | SC-071 | Explanation in result review |
| REQ-023 | All (GAP-002) | SC-110, SC-111 | i18n string coverage |
| REQ-024 | All (GAP-002) | SC-110, SC-111 | Locale selector + persistence |
| REQ-025 | All (GAP-002) | SC-112 | Fallback behavior |
| REQ-026 | All (GAP-002) | SC-113 | Default locale = VI |
| REQ-027 | All (GAP-003) | SC-111, SC-114 | Content vs. UI string separation |
| REQ-030 | US-003 | SC-040 | Start full test |
| REQ-031 | US-003 | SC-049, SC-050 | Server-authoritative timer |
| REQ-032 | US-003 | SC-041 | No pause |
| REQ-033 | US-003 | SC-042 | Auto-submit on expiry |
| REQ-034 | US-003 | SC-044, SC-045 | Submit confirmation |
| REQ-035 | US-003 | SC-046, SC-047 | Post-submit state |
| REQ-036 | US-003 | SC-046, SC-047 | State machine |
| REQ-037 | US-003 | SC-048 | Duplicate attempt prevention |
| REQ-038 | US-003 | SC-044, SC-096 | Unanswered = incorrect |
| REQ-039 | US-003 | SC-043 | Score display timing |
| REQ-040 | US-004 | SC-060 | Start practice |
| REQ-041 | US-004 | SC-060, SC-064 | No timer |
| REQ-042 | US-004 | SC-061 | Instant feedback |
| REQ-043 | US-004 | SC-062 | Answer lock |
| REQ-044 | US-004 | SC-063 | Raw score only |
| REQ-045 | US-004 | SC-102 | Audio replay in practice |
| REQ-046 | US-004 | SC-064, SC-065 | Session resume |
| REQ-050 | US-005 | SC-070 | Attempt list |
| REQ-051 | US-005 | SC-071 | Question-level review |
| REQ-052 | US-005 | SC-072 | Wrong-only filter |
| REQ-053 | US-005 | SC-074 | Audio in review |
| REQ-054 | US-005 | SC-073 | Group display |
| REQ-060 | US-006 | SC-080 | User list |
| REQ-061 | US-006 | SC-081, SC-082, SC-087 | Role change |
| REQ-062 | US-006 | SC-083 | Deactivation |
| REQ-063 | US-006 | SC-085, SC-086 | Self-protection |
| REQ-064 | US-006 | SC-084 | Reactivation |
| REQ-065 | US-006 | SC-080 | Search/filter |
| REQ-070 | US-007 | SC-090 | Raw score computation |
| REQ-071 | US-007 | SC-091 | Scaled score lookup |
| REQ-072 | US-007 | SC-092, SC-093 | Boundary values |
| REQ-073 | US-007 | SC-094 | Missing table entry |
| REQ-074 | US-007 | SC-095 | Practice: no scaled score |
| REQ-075 | US-007 | SC-090 | Table structure |
| REQ-080 | US-008 | SC-100 | Full-test: single play |
| REQ-081 | US-008 | SC-101, SC-106 | No replay on revisit |
| REQ-082 | US-008 | SC-102 | Practice: unlimited replay |
| REQ-083 | US-008 | SC-103 | Pre-signed URL validity |
| REQ-084 | US-008 | SC-104 | URL refresh on expiry |
| REQ-085 | US-008 | SC-105 | Audio error fallback |
| REQ-086 | US-008 | SC-024, SC-025 | Upload validation |
| NFR-001 | US-003, US-008 | -- | API response time |
| NFR-002 | US-003, US-007 | -- | Score computation time |
| NFR-003 | US-001 | SC-003 | Concurrent registration |
| NFR-004 | US-001 | -- | Password hashing |
| NFR-005 | US-001 | SC-010 | Token expiry |
| NFR-006 | US-002 | -- | Streaming uploads |
| NFR-007 | All | SC-087 | RBAC enforcement |
| NFR-008 | US-008 | -- | Audio error rate |

---

## Open Issues (Blocking Design)

| # | Issue | Impact if Unresolved | Owner | Due |
|---|-------|---------------------|-------|-----|
| I-001 | OQ-1: ETS score conversion table copyright -- use official or approximation? | Cannot seed ScoreConversionTable; US-007 scoring displays "temporarily unavailable" | Product / Legal | Before Sprint 2 |
| I-002 | OQ-2: File storage provider -- S3 confirmed as recommended but not finalized | Blocks S3 SDK integration in upload (US-002) and pre-signed URL generation (US-008) | Engineering / Owner | Before Sprint 1 |
| I-003 | OQ-4: Can teachers edit a published test in-place, or must they unpublish first? | Affects whether active attempts see mid-edit changes; data integrity risk | Product | Before Sprint 2 |
| I-004 | OQ-5: Max concurrent users at launch | Affects PostgreSQL pool sizing, NestJS instance count, S3 request rate, NFR-001 target | Stakeholder | Before Sprint 1 |
| I-005 | Server-side attempt expiry mechanism -- needs architectural decision: cron job, scheduled task, or lazy evaluation on next access? | Affects EC-004 (browser closed mid-test); attempt could stay "in-progress" indefinitely if no server-side expiry mechanism exists | Architect | Sprint 1 design |
