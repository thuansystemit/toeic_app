"""Extraction pipeline (EDIES §3 flow, §17 stages, §7 traceable output).

Stages: VALIDATING -> EXTRACTING_TEXT -> CHUNKING -> EXTRACTING(LLM) ->
VALIDATING_OUTPUT -> quality gate. Produces a traceable ExtractionEnvelope.
"""
import json
import os
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
from app.extraction.text_extractor import extract_text
from app.guardrails.input_checks import run_text_guardrails, validate_document
from app.llm.factory import get_provider
from app.observability import audit
from app.version import PROMPT_VERSION, SCHEMA_VERSION

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "toeic_extract.txt")

# A stage callback lets the worker report progress (EDIES §17).
StageCb = Optional[Callable[[str], None]]


# Per-part guidance appended when a document is known to contain a single part.
_PART_GUIDANCE = {
    5: ("Part 5 = incomplete sentences. Each question is ONE sentence with a "
        "single blank and 4 options; there is NO passage (set passageText null)."),
    6: ("Part 6 = text completion. A short passage has 4 numbered blanks; put the "
        "passage in passageText and share one groupId across its 4 questions. One "
        "blank may ask which sentence best fits."),
    7: ("Part 7 = reading comprehension. Each passage (or pair/triple of passages) "
        "is followed by several questions; put the full passage text in passageText "
        "and share one groupId across all questions about the same passage(s)."),
}


def _system_prompt(part: Optional[int] = None) -> str:
    with open(_PROMPT_PATH, "r", encoding="utf-8") as f:
        base = f.read()
    if part in _PART_GUIDANCE:
        base += (
            f"\n\nSINGLE-PART DOCUMENT: this file contains ONLY Part {part} "
            f"questions. Set \"part\": {part} for EVERY question. {_PART_GUIDANCE[part]}"
        )
    return base


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

    # 4. LLM extraction per chunk (EDIES §13: validate every output)
    stage("EXTRACTING")
    provider = get_provider(provider_name)
    system = _system_prompt(part)
    questions: list[ExtractedQuestion] = []
    warnings: list[str] = []
    skipped = 0
    chunk_errors = 0
    for ch in chunks:
        # One slow/failed chunk (e.g. an LLM timeout) must not discard the
        # questions already extracted from the others — isolate per chunk.
        try:
            raw_json = provider.extract_json(system, ch.content)
            parsed = json.loads(raw_json)
        except Exception as e:
            chunk_errors += 1
            warnings.append(f"chunk {ch.index} failed: {e}")
            continue
        for i, q in enumerate(parsed.get("questions", [])):
            try:
                # Per-part upload: force the known part rather than trusting the
                # model's classification (eliminates cross-part mislabeling).
                if part is not None:
                    q["part"] = part
                eq = ExtractedQuestion(**q)
                if eq.sourcePage is None:
                    eq.sourcePage = ch.page_start
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

    # Overlapping chunks (and repeated passages) can surface the same question
    # twice — keep the first occurrence, keyed by part + normalized stem.
    deduped: list[ExtractedQuestion] = []
    seen: set[tuple[int, str]] = set()
    for q in questions:
        stem = " ".join((q.questionText or "").lower().split())
        key = (q.part, stem)
        if stem and key in seen:
            continue
        seen.add(key)
        deduped.append(q)
    questions = deduped

    # 5. output validation + quality gate (EDIES §12, §22)
    stage("VALIDATING_OUTPUT")
    if not questions:
        raise ExtractionError(
            ErrorCode.SCHEMA_VALIDATION_FAILED, "no valid questions extracted"
        )

    low_conf = sum(1 for q in questions if q.confidence < settings.low_confidence_threshold)
    no_key = sum(1 for q in questions if "answer_key_not_found" in q.issues
                 or not any(c.isCorrect for c in q.choices))
    needs_review = low_conf > 0 or no_key > 0  # everything is reviewed anyway

    duration_ms = int((time.monotonic() - started) * 1000)
    quality = QualityMetrics(
        questionCount=len(questions),
        skippedCount=skipped,
        lowConfidenceCount=low_conf,
        missingAnswerKeyCount=no_key,
        needsReview=needs_review,
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
