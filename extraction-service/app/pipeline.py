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


def _system_prompt() -> str:
    with open(_PROMPT_PATH, "r", encoding="utf-8") as f:
        return f.read()


def run_extraction(
    data: bytes,
    mime: str,
    file_name: str,
    *,
    provider_name: Optional[str] = None,
    on_stage: StageCb = None,
    job_id: str = "",
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
    system = _system_prompt()
    questions: list[ExtractedQuestion] = []
    warnings: list[str] = []
    skipped = 0
    try:
        for ch in chunks:
            raw_json = provider.extract_json(system, ch.content)
            parsed = json.loads(raw_json)
            for i, q in enumerate(parsed.get("questions", [])):
                try:
                    eq = ExtractedQuestion(**q)
                    if eq.sourcePage is None:
                        eq.sourcePage = ch.page_start
                    questions.append(eq)
                except Exception as e:
                    skipped += 1
                    warnings.append(f"chunk {ch.index} q{i + 1} skipped: {e}")
    except ExtractionError:
        raise
    except Exception as e:
        raise ExtractionError(ErrorCode.LLM_EXTRACTION_FAILED, str(e))

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
