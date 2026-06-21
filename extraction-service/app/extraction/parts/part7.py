"""Part 7 — Reading Comprehension."""
from __future__ import annotations

from app.extraction.parts.base import PartExtractor


class Part7Extractor(PartExtractor):
    part = 7
    guidance = (
        "Part 7 = reading comprehension. A passage is followed by questions.\n"
        "- passageText: copy the FULL passage text.\n"
        "- groupId: same value for all questions about the same passage (e.g. \"p7-1\").\n"
        "- questionText: the question being asked.\n"
        "- choices: 4 options (A/B/C/D), exactly one isCorrect=true."
    )
