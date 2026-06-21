"""Part 5 — Incomplete Sentences."""
from __future__ import annotations

from app.extraction.parts.base import PartExtractor


class Part5Extractor(PartExtractor):
    part = 5
    guidance = (
        "Part 5 = incomplete sentences. Each question is ONE sentence with a "
        "blank (____) and 4 answer choices (A/B/C/D). "
        "Set passageText to null. Set groupId to null."
    )

    def prepare(self, raw: dict) -> dict:
        raw = super().prepare(raw)
        # Part 5 questions are standalone — never carry a passage or group, even
        # if the model hallucinates one.
        raw["passageText"] = None
        raw["groupId"] = None
        return raw
