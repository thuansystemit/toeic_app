# Extraction-Service — Code Review TODO List

Source: `ocr-extraction-engineer` code review (2026-06-21).
Use this list to drive fixes. Check items off as completed.

---

## 🔴 Critical

- [x] **C1 — Silent data loss on malformed LLM output** (`app/llm/claude_provider.py:49`) ✅ DONE — `_extract_json_object` now raises `json.JSONDecodeError` instead of returning `{"questions": []}`; the chunk is counted in `chunk_errors` and surfaced in `warnings`.
  When the Claude response can't be parsed, `_extract_json_object` silently returns `{"questions": []}`. Since the pipeline only fails when *all* chunks error (`pipeline.py:103-108`), a garbled response makes that chunk's questions vanish with no trace.
  **Fix:** Raise/log instead of swallowing so the chunk is counted in `chunk_errors` and surfaced in `warnings`. Apply the same diagnostic to Ollama's fallback (`ollama_provider.py:76`).

- [x] **C2 — No type validation of parsed JSON** (`app/pipeline.py:89`) ✅ DONE — added `isinstance(parsed, dict)` guard that raises a clear error (caught per-chunk).
  If the LLM returns valid JSON that is not a dict (array/string), `.get("questions", [])` raises a confusing `AttributeError`.
  **Fix:** Add `if not isinstance(parsed, dict): raise ValueError("LLM returned non-object JSON")` before iterating.

- [x] **C3 — Stale auth header from static settings snapshot** (`app/backend_client.py:9`) ✅ DONE — replaced import-time `_HEADERS` with a `_headers()` helper that reads `get_settings().internal_token` per call.
  `_HEADERS` (incl. `internal_token`) is bound once at import from the module-level static `settings`. Fragile ordering dependency; token won't refresh.
  **Fix:** Build headers at call time via `get_settings()`, consistent with how `worker.py` reads `provider`.

---

## 🟠 High

- [x] **H1 — No retry/backoff on any LLM provider call** (`openai_provider.py`, `claude_provider.py`, `ollama_provider.py`) ✅ DONE — OpenAI/Claude SDK clients now use `max_retries=3` (built-in exponential backoff on 429/5xx/timeout); Ollama got a manual 3-attempt retry loop with backoff on connection/timeout/5xx (4xx fails fast).
  Transient 429/500/timeout failures discard the whole chunk.
  **Fix:** Add exponential backoff (2-3 retries on 429/500/502/503/timeout/ConnectionError). Enable OpenAI SDK `max_retries`.

- [x] **H2 — No `max_tokens` on OpenAI provider** (`app/llm/openai_provider.py:17`) ✅ DONE — set `max_completion_tokens=16384` and raise a `RuntimeError` when `finish_reason == "length"` (truncated output is no longer parsed as if complete).
  Risk of silent output truncation on large documents.
  **Fix:** Set `max_completion_tokens=16384` and raise a retryable error when `finish_reason == "length"`.

- [ ] **H3 — Sequential chunk processing** (`app/pipeline.py:84-101`)
  Total latency = sum of all chunk latencies.
  **Fix:** Process chunks with a bounded `ThreadPoolExecutor` (3-5 concurrent) respecting rate limits.

- [ ] **H4 — `.env` loaded after `settings` constructed** (`app/config.py:78`)
  Module-level `settings` reads `os.environ` before `_load_env_file` runs; guardrails/backend may use pre-`.env` values.
  **Fix:** Call `_load_env_file(ENV_FILE)` at module level before `settings = Settings()`, or switch all consumers to `get_settings()`.

- [ ] **H5 — PDF parsed twice for mixed scanned/digital docs** (`app/extraction/text_extractor.py:49-63`)
  Opens with pdfplumber then PyMuPDF; high memory for large files.
  **Fix:** Single streaming pass (PyMuPDF can do both text extraction and rendering); decide text-layer vs OCR per page inline.

- [ ] **H6 — No tests anywhere in the repository**
  **Fix:** Add (a) chunker unit tests, (b) per-part extractor tests (`prepare`/`finalize`/`finalize_batch`), (c) gold-set regression test with a sample TOEIC doc, (d) tests for `_extract_json_object` / `_robust_parse` edge cases (truncated/nested JSON).

---

## 🟡 Medium

- [ ] **M1 — No `temperature=0` on Claude provider** (`app/llm/claude_provider.py:7`)
  **Fix:** Set `temperature=0` for reproducibility when model is not an extended-thinking/Opus model; condition on the model string.

- [ ] **M2 — Rough token estimation** (`app/extraction/chunker.py:23`)
  `len(text.split())/0.75` can produce chunks larger than the budget in real tokens.
  **Fix:** Document the ratio; validate `system_prompt + chunk` fits context; consider `tiktoken` for OpenAI.

- [x] **M3 — Dead `answer_key_not_found` logic** (`app/pipeline.py:133-134`) ✅ DONE — dropped the `issues` check (never populated); `no_key` now relies solely on `not any(c.isCorrect ...)`. Schema guarantees exactly 4 choices so the empty-`any()` edge can't occur.
  `issues` is not in `QUESTION_JSON_SCHEMA` or the prompt, so the LLM never populates it; the `"answer_key_not_found" in q.issues` check is always False. Also `any()` on empty choices misflags.
  **Fix:** Rely on `not any(c.isCorrect for c in q.choices)` alone, OR add `issues` to the schema + prompt so the LLM can set it.

- [ ] **M4 — Weak prompt-injection defense** (`app/guardrails/input_checks.py:90-98`)
  Exact-substring stripping is trivially bypassable.
  **Fix:** Document it as defense-in-depth; move document text into a dedicated `<document>` tag as a trust boundary.

- [ ] **M5 — Hand-maintained JSON schema can drift from Pydantic model** (`app/domain/toeic_schema.py:73-110`)
  **Fix:** Generate the schema via `model_json_schema()` and strip pipeline-internal fields programmatically.

- [ ] **M6 — Fixed Ollama `num_ctx: 8192`** (`app/llm/ollama_provider.py:38-39`)
  May truncate when prompt + chunk + output exceed context.
  **Fix:** Compute `num_ctx` from estimated input + max output, or raise to 16384+.

- [ ] **M7 — Job message parsed with no schema validation** (`app/worker.py:60-69`)
  Malformed/missing fields raise `KeyError`; job silently lost (no dead-letter/callback).
  **Fix:** Validate with a Pydantic model or explicit checks; dead-letter malformed messages.

- [ ] **M8 — Unhandled `json.JSONDecodeError` in main loop** (`app/worker.py:153-158`)
  Non-JSON Redis message is caught by the broad handler and lost forever.
  **Fix:** Catch JSON parse errors in `handle()` and dead-letter the raw message.

- [ ] **M9 — Latent provider attribute bug** (`app/pipeline.py:150`)
  `getattr(provider, "model", provider.name)` itself fails if a provider lacks `name`.
  **Fix:** Guard the fallback; low risk since all providers define `name`.

- [ ] **M10 — OCR language not configurable / English-only** (`app/extraction/text_extractor.py:85`, `Dockerfile`)
  **Fix:** Install `tesseract-ocr-eng` explicitly; add `tesseract-ocr-vie` and `lang="eng+vie"` if Vietnamese OCR is needed.

---

## 🟢 Low

- [ ] **L1 — Basic `.env` parser** (`app/config.py:28`): no `export` prefix, inline comments, or multi-line values. Document limits or use `python-dotenv`.
- [ ] **L2 — Timestamp format** (`app/pipeline.py:157`): prefer `datetime.now(timezone.utc).isoformat()` over `time.strftime`.
- [ ] **L3 — Unprotected `Counter`** (`app/observability.py:25`): add a lock if concurrency (H3) is introduced.
- [ ] **L4 — Unbounded dead-letter list** (`app/dead_letter.py:16`): add `LTRIM` cap or TTL.
- [ ] **L5 — Falsy-zero bug** (`app/extraction/parts/base.py:66-67`): use `eq.number if eq.number is not None else ...`.
- [ ] **L6 — Unpinned Docker/Tesseract versions** (`Dockerfile:7-9`): pin `python:3.12.x-slim` and document Tesseract version.

---

## Progress

**Batch 1 (done, 2026-06-21):** C1, C2, C3, H1, H2, M3 — all Critical items + LLM retries/truncation + the dead answer-key logic. All changed files byte-compile cleanly.

**Remaining:** H3, H4, H5, H6 (High), M1–M2, M4–M10 (Medium), L1–L6 (Low).

Suggested next batch: H4 (`.env` load ordering — quick, removes a latent config bug), H3 (parallel chunks), then H6 (tests) to lock in the fixes.
