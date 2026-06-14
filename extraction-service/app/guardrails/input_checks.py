"""Input validation guardrails (EDIES §5 Input Validation, §13 LLM security).

Two phases:
  validate_document(...) — file-level: MIME, size, encryption, page count, hash.
  run_text_guardrails(...) — content-level: min length, quality, injection strip.
Each is composable; add a rule = add a function and register it.
"""
from __future__ import annotations

import hashlib
import io
from dataclasses import dataclass
from typing import Callable, List

from app.config import settings
from app.errors import ErrorCode, ExtractionError

ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@dataclass
class DocumentMeta:
    file_hash: str
    page_count: int | None
    size_bytes: int


# ---- file-level validation ----

def _check_mime(data: bytes, mime: str) -> None:
    if mime not in ALLOWED_MIME:
        raise ExtractionError(ErrorCode.UNSUPPORTED_FILE_TYPE, f"mime={mime}")


def _check_size(data: bytes, mime: str) -> None:
    if len(data) > settings.max_file_bytes:
        raise ExtractionError(ErrorCode.VALIDATION_ERROR, f"size={len(data)} exceeds limit")
    if len(data) == 0:
        raise ExtractionError(ErrorCode.VALIDATION_ERROR, "empty file")


def _check_encryption_and_pages(data: bytes, mime: str) -> int | None:
    """Reject password-protected PDFs and over-long documents; return page count."""
    if mime != "application/pdf":
        return None
    import pdfplumber
    from pdfminer.pdfdocument import PDFPasswordIncorrect

    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = len(pdf.pages)
    except PDFPasswordIncorrect as e:
        raise ExtractionError(ErrorCode.ENCRYPTED_DOCUMENT, str(e))
    except Exception as e:
        raise ExtractionError(ErrorCode.TEXT_EXTRACTION_FAILED, f"corrupt pdf: {e}")
    if pages > settings.max_pages:
        raise ExtractionError(ErrorCode.VALIDATION_ERROR, f"pages={pages} exceeds limit")
    return pages


def validate_document(data: bytes, mime: str) -> DocumentMeta:
    for rule in (_check_mime, _check_size):
        rule(data, mime)
    page_count = _check_encryption_and_pages(data, mime)
    return DocumentMeta(
        file_hash=hashlib.sha256(data).hexdigest(),
        page_count=page_count,
        size_bytes=len(data),
    )


# ---- content-level guardrails ----

def _check_min_length(text: str) -> None:
    if len(text.strip()) < settings.min_chars:
        raise ExtractionError(
            ErrorCode.TEXT_EXTRACTION_FAILED, "too little extractable text (scanned image?)"
        )


def _check_text_quality(text: str) -> None:
    printable = sum(1 for c in text if c.isprintable() or c in "\n\r\t")
    if text and printable / max(1, len(text)) < 0.7:
        raise ExtractionError(ErrorCode.TEXT_EXTRACTION_FAILED, "garbled text")


def strip_injection(text: str) -> str:
    """EDIES §13: treat document text as untrusted; defang injection lines."""
    bad = ("ignore previous", "ignore all previous", "system prompt", "you are now",
           "disregard the above", "new instructions:")
    # Split on "\n" only (NOT splitlines, which also breaks on "\f" and would
    # strip the page markers the chunker relies on to keep documents splittable).
    return "\n".join(
        line for line in text.split("\n") if not any(b in line.lower() for b in bad)
    )


TEXT_GUARDRAILS: List[Callable[[str], None]] = [_check_min_length, _check_text_quality]


def run_text_guardrails(text: str) -> str:
    for rule in TEXT_GUARDRAILS:
        rule(text)
    return strip_injection(text)[: settings.max_chars]
