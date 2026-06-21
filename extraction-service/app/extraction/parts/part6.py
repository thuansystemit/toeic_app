"""Part 6 — Text Completion."""
from __future__ import annotations

from collections import defaultdict

from app.domain.toeic_schema import ExtractedQuestion
from app.extraction.parts.base import PartExtractor


class Part6Extractor(PartExtractor):
    part = 6
    guidance = (
        "Part 6 = text completion. Each passage has blanks with numbered questions.\n"
        "- passageText: copy the FULL passage text (do NOT shorten or summarize).\n"
        "- groupId: same value for all questions sharing one passage (e.g. \"p6-1\").\n"
        "- questionText: the sentence containing the blank.\n"
        "- choices: 4 options (A/B/C/D), exactly one isCorrect=true."
    )

    def finalize_batch(self, questions: list[ExtractedQuestion]) -> list[ExtractedQuestion]:
        # Within each passage group, share the FULLEST passage text across all of
        # its blanks. Small models often emit the complete passage on only one of
        # the 4 questions and abbreviate the rest — this backfills the others so
        # every blank carries the full passage.
        groups: dict[str, list[ExtractedQuestion]] = defaultdict(list)
        for q in questions:
            if q.groupId:
                groups[q.groupId].append(q)
        for group in groups.values():
            best = max((q.passageText or "" for q in group), key=len, default="")
            if best:
                for q in group:
                    if len(q.passageText or "") < len(best):
                        q.passageText = best
        return questions
