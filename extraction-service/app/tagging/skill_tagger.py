"""Skill-tagging pass: assign TOEIC taxonomy codes to already-extracted questions.

This is deliberately decoupled from extraction. Classifying a single, already
clean question against a fixed code list is a far easier task than reading +
structuring a dense page, so even a small model (qwen2.5:3b) does it far more
reliably here than inline in the extraction prompt. It also lets the tagging
model be swapped independently of the extraction model.

We batch questions to keep the number of LLM calls low, ask for a code list per
question, and hard-filter the result against the taxonomy (and the codes valid
for that part) so the model can never invent a code or mis-assign a Part-7
comprehension skill to a Part-5 grammar item.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from app.observability import audit
from app.tagging.taxonomy import codes_for_part, taxonomy_lines

if TYPE_CHECKING:
    from app.domain.toeic_schema import ExtractedQuestion
    from app.llm.provider import LlmProvider

_STEM_MAX = 240
_CHOICE_MAX = 60

_SYSTEM = (
    "You are a TOEIC item tagger. For EACH question, pick the 1-3 skill codes "
    "from the list below that best describe what the question tests.\n"
    "Use ONLY codes from this list — never invent a code:\n"
    "{taxonomy}\n\n"
    "Return ONLY JSON: {{\"tags\": {{\"<id>\": [\"CODE\", ...]}}}} where <id> is "
    "the bracketed number of each question. Pick the most specific codes. If "
    "unsure, return an empty list for that id."
)


def _truncate(text: str | None, limit: int) -> str:
    text = (text or "").strip().replace("\n", " ")
    return text if len(text) <= limit else text[:limit] + "…"


def _render_question(idx: int, q: "ExtractedQuestion") -> str:
    choices = " ".join(
        f"({c.label}) {_truncate(c.text, _CHOICE_MAX)}" for c in q.choices
    )
    return f"[{idx}] Part {q.part}: {_truncate(q.questionText, _STEM_MAX)} | {choices}"


def _coerce_codes(raw: object) -> list[str]:
    """The model may return a list, a single string, or comma-separated text."""
    if isinstance(raw, list):
        return [str(c).strip().upper() for c in raw if str(c).strip()]
    if isinstance(raw, str):
        return [part.strip().upper() for part in raw.replace(";", ",").split(",") if part.strip()]
    return []


def tag_questions(
    provider: "LlmProvider",
    questions: list["ExtractedQuestion"],
    *,
    batch_size: int = 10,
    max_per_q: int = 3,
) -> int:
    """Tag questions in place (sets ``q.skills``). Returns the count of questions
    that received at least one tag. Best-effort: a failed batch is logged and
    leaves those questions untagged rather than failing the job."""
    if not questions:
        return 0

    tagged = 0
    for start in range(0, len(questions), batch_size):
        batch = questions[start : start + batch_size]
        parts = {q.part for q in batch}
        system = _SYSTEM.format(taxonomy=taxonomy_lines(parts))
        user = "\n".join(_render_question(i + 1, q) for i, q in enumerate(batch))

        try:
            import json

            raw = provider.complete_json(system, user)
            parsed = json.loads(raw)
        except Exception as e:  # noqa: BLE001 — tagging must never fail the job
            audit("TAGGING_BATCH_FAILED", offset=start, size=len(batch), error=str(e))
            continue

        tags = parsed.get("tags", parsed) if isinstance(parsed, dict) else {}
        if not isinstance(tags, dict):
            continue

        for i, q in enumerate(batch):
            # Accept "1"/1 and tolerate the model keying by question number.
            raw_codes = tags.get(str(i + 1))
            if raw_codes is None and q.number is not None:
                raw_codes = tags.get(str(q.number))
            allowed = codes_for_part(q.part)
            codes = [
                c for c in dict.fromkeys(_coerce_codes(raw_codes)) if c in allowed
            ][:max_per_q]
            if codes:
                q.skills = codes
                tagged += 1

    audit("TAGGING_COMPLETE", questions=len(questions), tagged=tagged)
    return tagged
