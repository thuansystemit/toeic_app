"""Part 7 — Reading Comprehension."""
from __future__ import annotations

from app.extraction.parts.base import PartExtractor


class Part7Extractor(PartExtractor):
    part = 7
    guidance = (
        "Part 7 = reading comprehension. Each passage (or pair/triple of passages) "
        "is followed by several questions; put the full passage text in passageText "
        "and share one groupId across all questions about the same passage(s)."
    )
