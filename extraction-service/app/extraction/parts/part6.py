"""Part 6 — Text Completion."""
from __future__ import annotations

from collections import defaultdict

from app.domain.toeic_schema import ExtractedQuestion
from app.extraction.parts.base import PartExtractor


class Part6Extractor(PartExtractor):
    part = 6
    guidance = (
        "Part 6 = text completion. The document is one or more SHORT PASSAGES "
        "(email, memo, letter, notice, advertisement or article); each passage has "
        "exactly 4 numbered blanks.\n"
        "- passageText MUST be the COMPLETE passage, copied verbatim from its first "
        "word to its last — every sentence and paragraph, including the heading "
        "lines (To/From/Date/Subject). Do NOT shorten it, do NOT summarize, and "
        "NEVER replace any part of it with '...', '…' or an ellipsis. A single "
        "sentence is WRONG; return the whole text.\n"
        "- Keep every blank inside passageText written as its question number then "
        'four underscores, e.g. "(131) ____", so the reader sees where each '
        "question goes.\n"
        "- Output one question object per blank (4 per passage). Give every "
        "question of the same passage the SAME full passageText and the SAME "
        'groupId (e.g. "p6-1", "p6-2" for the next passage).\n'
        "- questionText is the single sentence from the passage that contains that "
        'blank (with the blank as "____"); for a "which sentence best fits" blank, '
        "questionText is that instruction.\n"
        "- choices: the 4 options for that blank; exactly one isCorrect."
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
