"""TOEIC Reading skill taxonomy — the single source of truth for the codes the
tagger may emit. Kept in lock-step with the backend seed
(`backend/src/database/migrations/1700000006000-Skills.ts`, ADR Appendix A).

If a code here is not present in the backend `skills` table, the backend import
silently drops the resulting tag — so this list must not drift ahead of it."""
from __future__ import annotations

# (code, human-readable name, category) — Reading scope (MVP). Order groups by
# category so the prompt reads naturally.
SKILLS: list[tuple[str, str, str]] = [
    # grammar
    ("G-TENSE", "Verb tense & aspect", "grammar"),
    ("G-SVA", "Subject–verb agreement", "grammar"),
    ("G-PREP", "Prepositions", "grammar"),
    ("G-CONJ", "Conjunctions & transitions", "grammar"),
    ("G-PRON", "Pronouns & reference", "grammar"),
    ("G-RELCL", "Relative clauses", "grammar"),
    ("G-COMP", "Comparatives & superlatives", "grammar"),
    ("G-WFORM", "Word form (part of speech)", "grammar"),
    ("G-VERBAL", "Gerunds & infinitives", "grammar"),
    ("G-COND", "Conditionals", "grammar"),
    ("G-VOICE", "Active / passive voice", "grammar"),
    ("G-DET", "Articles & determiners", "grammar"),
    ("G-MODAL", "Modal verbs", "grammar"),
    # lexical
    ("L-VOCAB", "Vocabulary in context", "lexical"),
    ("L-COLLOC", "Collocations", "lexical"),
    ("L-WCHOICE", "Word choice / usage", "lexical"),
    # discourse
    ("D-INSERT", "Sentence insertion", "discourse"),
    ("D-COHESION", "Cohesion / transition selection", "discourse"),
    # comprehension
    ("R-GIST", "Main idea / gist", "comprehension"),
    ("R-DETAIL", "Specific detail", "comprehension"),
    ("R-INFER", "Inference", "comprehension"),
    ("R-VIC", "Vocabulary in context (passage)", "comprehension"),
    ("R-PURPOSE", "Purpose / tone / audience", "comprehension"),
    ("R-NOTTRUE", "NOT / true (exception)", "comprehension"),
    ("R-XREF", "Cross-reference (multi-passage)", "comprehension"),
    ("R-INTENT", "Implied meaning (message intent)", "comprehension"),
]

# Fast membership test for filtering whatever the model returns.
SKILL_CODES: frozenset[str] = frozenset(code for code, _, _ in SKILLS)

# Which codes are plausible per TOEIC part — used to constrain the prompt and to
# drop obviously-wrong tags (e.g. a Part 5 single-sentence item tagged R-XREF).
#   Part 5 — incomplete sentences: grammar + lexical.
#   Part 6 — text completion: grammar + lexical + discourse.
#   Part 7 — reading comprehension: comprehension (+ lexical for vocab items).
_GRAMMAR = {c for c, _, cat in SKILLS if cat == "grammar"}
_LEXICAL = {c for c, _, cat in SKILLS if cat == "lexical"}
_DISCOURSE = {c for c, _, cat in SKILLS if cat == "discourse"}
_COMPREHENSION = {c for c, _, cat in SKILLS if cat == "comprehension"}

CODES_BY_PART: dict[int, frozenset[str]] = {
    5: frozenset(_GRAMMAR | _LEXICAL),
    6: frozenset(_GRAMMAR | _LEXICAL | _DISCOURSE),
    7: frozenset(_COMPREHENSION | _LEXICAL),
}


def codes_for_part(part: int | None) -> frozenset[str]:
    """Allowed codes for a part; falls back to the whole taxonomy if unknown."""
    if part in CODES_BY_PART:
        return CODES_BY_PART[part]
    return SKILL_CODES


def taxonomy_lines(parts: set[int] | None = None) -> str:
    """A compact ``CODE — Name`` list for the prompt. If ``parts`` is given, only
    the codes valid for those parts are listed (keeps the prompt small + focused
    for a small model)."""
    allowed: set[str] = set()
    if parts:
        for p in parts:
            allowed |= codes_for_part(p)
    else:
        allowed = set(SKILL_CODES)
    return "\n".join(
        f"{code} — {name}" for code, name, _ in SKILLS if code in allowed
    )
