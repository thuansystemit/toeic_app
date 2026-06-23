"""Per-part extraction strategy (EDIES §3, §13).

The pipeline owns the part-agnostic flow (validate -> text -> chunk -> LLM ->
validate -> quality). Everything that differs *by TOEIC part* lives in a
``PartExtractor`` subclass: the prompt guidance, how raw model output is coerced
before schema validation, and how a validated question is normalized.

Selecting a part in the UI maps to exactly one of these classes
(see :func:`app.extraction.parts.get_part_extractor`).
"""
from __future__ import annotations

import re
from typing import Optional

from app.domain.toeic_schema import ExtractedQuestion

# Leading "<optional stray letter> <number>.)" the model echoes from the source
# (e.g. "101.", "Question 101.", "e 101."). We capture the number and rebuild a
# CLEAN, consistent "101. <stem>" prefix on every question.
_LEADING_NUMBER = re.compile(
    r"^\s*(?:question\s*)?[a-z]?\s*(\d{1,3})\s*[.):]\s*", re.IGNORECASE
)


_CHOICE_LABELS = ["A", "B", "C", "D"]


def _normalize_choices(raw: dict) -> dict:
    """Repair the choice-shape errors small models (qwen2.5:3b) commonly make,
    BEFORE Pydantic validation, so a recoverable question isn't dropped.

    The frequent failure mode is the model packing the answer WORD into ``label``
    and omitting ``text`` (e.g. ``{"label": "During", "isCorrect": true}``). TOEIC
    choices are positional (A,B,C,D in order), so we:
      * move a non-letter ``label`` into ``text`` when ``text`` is missing,
      * accept a bare string choice as its text,
      * relabel every choice by position (A,B,C,D).
    Choices already shaped correctly pass through COMPLETELY UNCHANGED — the
    repair only ever touches choices that would otherwise fail validation, so it
    can add a recovered question but can never alter or drop a valid one."""
    choices = raw.get("choices")
    if not isinstance(choices, list) or not choices:
        return raw

    # Fast path: if the choices are already well-formed (exactly 4 dicts, each
    # with a distinct A-D label and non-empty text), leave them byte-for-byte
    # as-is. This guarantees the repair is a strict no-op on valid questions.
    def _clean(ch: object) -> bool:
        return (
            isinstance(ch, dict)
            and isinstance(ch.get("label"), str)
            and ch["label"].strip().upper() in _CHOICE_LABELS
            and isinstance(ch.get("text"), str)
            and ch["text"].strip() != ""
        )

    if len(choices) == 4 and all(_clean(c) for c in choices):
        labels = {c["label"].strip().upper() for c in choices}  # type: ignore[index]
        if len(labels) == 4:
            return raw  # nothing to repair — untouched

    repaired: list = []
    for i, ch in enumerate(choices):
        label = _CHOICE_LABELS[i] if i < len(_CHOICE_LABELS) else None
        if isinstance(ch, str):
            repaired.append({"label": label, "text": ch, "isCorrect": False})
            continue
        if not isinstance(ch, dict):
            repaired.append(ch)  # let validation reject anything truly unexpected
            continue
        ch = dict(ch)
        text = ch.get("text")
        orig_label = ch.get("label")
        # Recover text from a label that holds a word rather than an A-D letter.
        if (text is None or text == "") and isinstance(orig_label, str) \
                and orig_label.strip().upper() not in _CHOICE_LABELS:
            ch["text"] = orig_label
        if label is not None:
            ch["label"] = label  # canonical positional label
        repaired.append(ch)

    raw["choices"] = repaired
    return raw


def _strip_leading_number(text: str) -> str:
    return _LEADING_NUMBER.sub("", text or "").strip()


def _leading_number_value(text: str) -> Optional[int]:
    m = _LEADING_NUMBER.match(text or "")
    return int(m.group(1)) if m else None


class PartExtractor:
    """Base strategy. ``part = None`` means "extract whatever parts are present"
    (the legacy whole-document behavior); subclasses pin a single part."""

    part: Optional[int] = None
    #: Appended to the base prompt when a single part is known. Subclasses set it.
    guidance: str = ""

    # -- prompt -----------------------------------------------------------------
    def system_prompt(self, base_prompt: str) -> str:
        if self.part is None:
            return base_prompt
        return base_prompt + (
            f"\n\nSINGLE-PART DOCUMENT: this file contains ONLY Part {self.part} "
            f'questions. Set "part": {self.part} for EVERY question. {self.guidance}'
        )

    # -- per-question hooks -----------------------------------------------------
    def prepare(self, raw: dict) -> dict:
        """Coerce a raw model question dict BEFORE schema validation.

        For a known part we force ``part`` rather than trusting the model's
        classification — this eliminates cross-part mislabeling. We also repair
        common small-model choice-shape errors so a recoverable question isn't
        dropped at validation."""
        if self.part is not None:
            raw["part"] = self.part
        raw = _normalize_choices(raw)
        return raw

    def finalize(self, eq: ExtractedQuestion, *, page_start: Optional[int]) -> ExtractedQuestion:
        """Normalize a validated question. Shared across all parts: rebuild a
        clean "<n>. <stem>" question number and default the source page."""
        raw_stem = eq.questionText or ""
        num = eq.number or _leading_number_value(raw_stem)
        stem = _strip_leading_number(raw_stem)
        eq.questionText = f"{num}. {stem}" if num else stem
        if eq.sourcePage is None:
            eq.sourcePage = page_start
        return eq

    # -- batch ------------------------------------------------------------------
    def finalize_batch(self, questions: list[ExtractedQuestion]) -> list[ExtractedQuestion]:
        """Cross-question normalization, run once after dedup. Default: no-op.
        Parts that share a passage across questions override this."""
        return questions

    # -- dedup ------------------------------------------------------------------
    def dedup_key(self, eq: ExtractedQuestion) -> Optional[tuple]:
        """Key used to drop duplicates surfaced by overlapping chunks. Return
        ``None`` to never treat the question as a duplicate (e.g. empty stem).

        Prefers question number as the dedup key (most reliable for TOEIC),
        falls back to normalized stem text when the number is absent."""
        # If the question has a number, dedup by (part, number) — this is
        # robust against slight OCR variations in the stem text.
        if eq.number is not None:
            return (eq.part, eq.number)
        stem = " ".join((eq.questionText or "").lower().split())
        return (eq.part, stem) if stem else None


class GenericExtractor(PartExtractor):
    """Whole-document extraction (no part selected). Trusts the model's own
    part classification for every question."""

    part = None
