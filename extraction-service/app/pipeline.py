"""Extraction pipeline (EDIES §3 flow, §17 stages, §7 traceable output).

Stages: VALIDATING -> EXTRACTING_TEXT -> CHUNKING -> EXTRACTING(LLM) ->
VERIFYING -> VALIDATING_OUTPUT -> quality gate. Produces a traceable
ExtractionEnvelope.

Includes a completeness verification pass: after the initial extraction, the
pipeline checks which expected question numbers are missing and re-asks the
LLM for just those numbers. This is critical for small models (qwen2.5:3b)
that tend to drop questions.
"""
import json
import os
import re
import time
from typing import Callable, Optional

from app.config import settings
from app.domain.toeic_schema import (
    DocumentSource,
    ExtractedQuestion,
    ExtractionEnvelope,
    QualityMetrics,
)
from app.errors import ErrorCode, ExtractionError
from app.extraction.chunker import chunk_text
from app.extraction.parts import get_part_extractor
from app.extraction.text_extractor import extract_text
from app.guardrails.input_checks import run_text_guardrails, validate_document
from app.llm.factory import get_provider
from app.observability import audit
from app.version import PROMPT_VERSION, SCHEMA_VERSION

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "toeic_extract.txt")

# A stage callback lets the worker report progress (EDIES §17).
StageCb = Optional[Callable[[str], None]]

# Regex to detect question numbers in source text
_QUESTION_NUM_RE = re.compile(
    r"(?:^|\n)\s*(?:question\s+)?(\d{1,3})\s*[.):]", re.IGNORECASE
)


def _base_prompt() -> str:
    with open(_PROMPT_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _detect_expected_numbers(text: str) -> list[int]:
    """Scan the full source text to find all TOEIC question numbers.

    Returns a sorted list of unique question numbers found. These are used
    by the completeness verification pass to detect missing extractions.
    """
    nums = sorted(set(int(m.group(1)) for m in _QUESTION_NUM_RE.finditer(text)))
    # Filter to plausible TOEIC question number ranges (101-200 for Parts 5-7,
    # but some practice tests use 1-30 or similar).
    return nums


def _find_text_around_question(full_text: str, q_num: int, context_lines: int = 15) -> Optional[str]:
    """Extract the text surrounding a specific question number from the source.

    Returns up to `context_lines` lines around the question number, which is
    enough for the question stem + 4 choices + some passage context.
    """
    lines = full_text.split("\n")
    pattern = re.compile(
        rf"^\s*(?:question\s+)?{q_num}\s*[.):]", re.IGNORECASE
    )
    for i, line in enumerate(lines):
        if pattern.match(line):
            start = max(0, i - 3)  # include a few lines before (passage context)
            end = min(len(lines), i + context_lines)
            return "\n".join(lines[start:end])
    return None


def run_extraction(
    data: bytes,
    mime: str,
    file_name: str,
    *,
    provider_name: Optional[str] = None,
    on_stage: StageCb = None,
    job_id: str = "",
    part: Optional[int] = None,
) -> ExtractionEnvelope:
    started = time.monotonic()

    def stage(s: str) -> None:
        audit("STAGE", jobId=job_id, stage=s)
        if on_stage:
            on_stage(s)

    # 1. file-level validation (raises ExtractionError with a stable code)
    stage("VALIDATING")
    meta = validate_document(data, mime)

    # 2. text extraction + content guardrails
    stage("EXTRACTING_TEXT")
    try:
        raw_text = extract_text(data, mime)
    except ExtractionError:
        raise
    except Exception as e:
        raise ExtractionError(ErrorCode.TEXT_EXTRACTION_FAILED, str(e))
    cleaned = run_text_guardrails(raw_text)

    # 3. chunking (EDIES §9)
    stage("CHUNKING")
    chunks = chunk_text(cleaned, settings.chunk_tokens, settings.chunk_overlap)

    # 4. LLM extraction per chunk (EDIES §13: validate every output).
    stage("EXTRACTING")
    provider = get_provider(provider_name)
    extractor = get_part_extractor(part)
    system = extractor.system_prompt(_base_prompt())
    questions: list[ExtractedQuestion] = []
    warnings: list[str] = []
    skipped = 0
    chunk_errors = 0
    for ch in chunks:
        try:
            raw_json = provider.extract_json(system, ch.content)
            parsed = json.loads(raw_json)
            if not isinstance(parsed, dict):
                raise ValueError(f"LLM returned non-object JSON ({type(parsed).__name__})")
        except Exception as e:
            chunk_errors += 1
            warnings.append(f"chunk {ch.index} failed: {e}")
            continue
        for i, q in enumerate(parsed.get("questions", [])):
            try:
                eq = ExtractedQuestion(**extractor.prepare(q))
                eq = extractor.finalize(eq, page_start=ch.page_start)
                questions.append(eq)
            except Exception as e:
                skipped += 1
                warnings.append(f"chunk {ch.index} q{i + 1} skipped: {e}")

    # Only treat the job as failed if every chunk errored (nothing usable).
    if chunks and chunk_errors == len(chunks):
        raise ExtractionError(
            ErrorCode.LLM_EXTRACTION_FAILED,
            warnings[-1] if warnings else "all chunks failed",
        )

    # Dedup: overlapping chunks can surface the same question twice.
    deduped: list[ExtractedQuestion] = []
    seen: set[tuple] = set()
    for q in questions:
        key = extractor.dedup_key(q)
        if key is not None and key in seen:
            continue
        if key is not None:
            seen.add(key)
        deduped.append(q)

    # Cross-question normalization (e.g. Part 6 shares the full passage).
    questions = extractor.finalize_batch(deduped)

    # 5. COMPLETENESS VERIFICATION PASS
    # Detect which question numbers from the source text are missing from
    # extraction and re-ask the LLM for just those, one at a time.
    stage("VERIFYING")
    expected_nums = _detect_expected_numbers(cleaned)
    extracted_nums = set()
    for q in questions:
        if q.number is not None:
            extracted_nums.add(q.number)

    missing_nums = [n for n in expected_nums if n not in extracted_nums]

    if missing_nums and len(missing_nums) <= 20:
        # Re-extraction: for each missing question, find its surrounding text
        # and ask the LLM to extract just that one question.
        audit("COMPLETENESS_GAP", expected=len(expected_nums),
              extracted=len(extracted_nums), missing=missing_nums)

        for q_num in missing_nums:
            snippet = _find_text_around_question(cleaned, q_num)
            if not snippet:
                warnings.append(f"question {q_num}: not found in source for re-extraction")
                continue

            re_ask_prompt = (
                f"Extract ONLY question number {q_num} from the text below. "
                f"Output JSON: {{\"questions\": [<one question object>]}}.\n"
                f"The question object must have: part, number, questionText, "
                f"choices (4 items with label/text/isCorrect), passageText, "
                f"groupId, explanationVi, skills.\n"
                f"Set number to {q_num}. Blanks are \"____\"."
            )
            try:
                raw_json = provider.extract_json(re_ask_prompt, snippet)
                parsed = json.loads(raw_json)
                if not isinstance(parsed, dict):
                    continue
                for q_raw in parsed.get("questions", []):
                    try:
                        # Force the expected number
                        q_raw["number"] = q_num
                        eq = ExtractedQuestion(**extractor.prepare(q_raw))
                        eq = extractor.finalize(eq, page_start=None)
                        questions.append(eq)
                        extracted_nums.add(q_num)
                        audit("COMPLETENESS_RECOVERED", number=q_num)
                        break  # only need one
                    except Exception as e:
                        warnings.append(f"re-extract q{q_num} parse failed: {e}")
            except Exception as e:
                warnings.append(f"re-extract q{q_num} LLM failed: {e}")

        # Re-dedup after recovery
        deduped2: list[ExtractedQuestion] = []
        seen2: set[tuple] = set()
        for q in questions:
            key = extractor.dedup_key(q)
            if key is not None and key in seen2:
                continue
            if key is not None:
                seen2.add(key)
            deduped2.append(q)
        questions = extractor.finalize_batch(deduped2)

    elif missing_nums:
        warnings.append(
            f"Completeness check: {len(missing_nums)} questions missing "
            f"(too many to re-extract individually): {missing_nums[:10]}..."
        )

    # 6. output validation + quality gate (EDIES §12, §22)
    stage("VALIDATING_OUTPUT")
    if not questions:
        raise ExtractionError(
            ErrorCode.SCHEMA_VALIDATION_FAILED, "no valid questions extracted"
        )

    low_conf = sum(1 for q in questions if q.confidence < settings.low_confidence_threshold)
    no_key = sum(1 for q in questions if not any(c.isCorrect for c in q.choices))
    needs_review = low_conf > 0 or no_key > 0

    # Compute completeness metrics
    final_extracted_nums = {q.number for q in questions if q.number is not None}
    final_missing = [n for n in expected_nums if n not in final_extracted_nums]
    completeness_pct = (
        round(100.0 * len(final_extracted_nums) / len(expected_nums), 1)
        if expected_nums else 100.0
    )
    choice_complete = sum(
        1 for q in questions
        if len(q.choices) == 4 and len({c.label for c in q.choices}) == 4
    )
    choice_completeness_pct = (
        round(100.0 * choice_complete / len(questions), 1)
        if questions else 100.0
    )

    duration_ms = int((time.monotonic() - started) * 1000)
    quality = QualityMetrics(
        questionCount=len(questions),
        skippedCount=skipped,
        lowConfidenceCount=low_conf,
        missingAnswerKeyCount=no_key,
        needsReview=needs_review,
        durationMs=duration_ms,
        expectedQuestionCount=len(expected_nums) if expected_nums else None,
        missingQuestionNumbers=final_missing if final_missing else None,
        completenessPercent=completeness_pct,
        choiceCompletenessPercent=choice_completeness_pct,
    )

    audit(
        "EXTRACTION_COMPLETE",
        jobId=job_id,
        questions=len(questions),
        expected=len(expected_nums),
        missing=len(final_missing),
        completeness=completeness_pct,
        choiceCompleteness=choice_completeness_pct,
        durationMs=duration_ms,
    )

    return ExtractionEnvelope(
        schemaVersion=SCHEMA_VERSION,
        promptVersion=PROMPT_VERSION,
        model=getattr(provider, "model", provider.name),
        source=DocumentSource(
            fileName=file_name,
            fileType=mime,
            pageCount=meta.page_count,
            fileHash=meta.file_hash,
        ),
        extractedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        quality=quality,
        questions=questions,
        warnings=warnings,
    )
