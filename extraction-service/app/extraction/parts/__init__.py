"""Per-part TOEIC extractors.

The UI lets the user pick the part to extract (Part 5/6/7); that choice flows to
the worker as ``part`` and selects exactly one strategy here. ``part=None`` keeps
the legacy "extract every part found in the document" behavior.
"""
from __future__ import annotations

from typing import Optional

from app.extraction.parts.base import GenericExtractor, PartExtractor
from app.extraction.parts.part5 import Part5Extractor
from app.extraction.parts.part6 import Part6Extractor
from app.extraction.parts.part7 import Part7Extractor

_REGISTRY: dict[int, type[PartExtractor]] = {
    5: Part5Extractor,
    6: Part6Extractor,
    7: Part7Extractor,
}

#: Parts that can be selected in the UI.
SUPPORTED_PARTS = tuple(sorted(_REGISTRY))


def get_part_extractor(part: Optional[int]) -> PartExtractor:
    """Return the extractor for ``part`` (None -> whole-document extractor).

    Falls back to the generic extractor for an unknown part so a stray value
    never crashes a job — the model's own classification is used instead.
    """
    if part is None:
        return GenericExtractor()
    cls = _REGISTRY.get(part)
    return cls() if cls else GenericExtractor()


__all__ = [
    "PartExtractor",
    "GenericExtractor",
    "Part5Extractor",
    "Part6Extractor",
    "Part7Extractor",
    "get_part_extractor",
    "SUPPORTED_PARTS",
]
