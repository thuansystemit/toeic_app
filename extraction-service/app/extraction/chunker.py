"""Token-budget chunking with page tracking (EDIES §9 Chunking Standard).

Supports two modes:
1. Line-aware sliding window (legacy default).
2. Question-boundary-aware chunking (preferred for small LLMs like qwen2.5:3b):
   splits at TOEIC question number boundaries so a question stem + its four
   choices are never split across chunks.

A rough word-based token estimate keeps the dependency surface small. Each chunk
records pageStart/pageEnd so extracted questions can be traced back to a page.
"""
import os
import re
from dataclasses import dataclass
from typing import List, Optional

# Page boundary marker emitted by the text extractor between pages.
PAGE_MARKER = "\f"  # form feed

# Matches the start of a TOEIC question number (e.g. "101.", "102)", "Question 103.")
_QUESTION_START = re.compile(
    r"^\s*(?:question\s+)?(\d{1,3})\s*[.):]", re.IGNORECASE | re.MULTILINE
)


@dataclass
class Chunk:
    index: int
    page_start: int
    page_end: int
    content: str
    token_estimate: int
    question_numbers: Optional[List[int]] = None  # tracked for completeness checks


def _estimate_tokens(text: str) -> int:
    # ~0.75 words/token; good enough for budgeting (EDIES §9 baseline 800-1200).
    return int(len(text.split()) / 0.75)


def _find_question_numbers(text: str) -> List[int]:
    """Extract all TOEIC question numbers found in a text fragment."""
    return sorted(set(int(m.group(1)) for m in _QUESTION_START.finditer(text)))


def chunk_text(text: str, max_tokens: int = 1000, overlap_tokens: int = 150) -> List[Chunk]:
    """Smart chunker: uses question-boundary mode when TOEIC numbered questions
    are detected, otherwise falls back to line-aware sliding window.

    Question-boundary mode groups whole questions together (never splitting a
    question across chunks) and uses smaller chunks optimized for small LLMs.
    """
    # Detect if text contains numbered TOEIC questions
    question_nums = _find_question_numbers(text)
    if len(question_nums) >= 2:
        return _chunk_by_questions(text, max_tokens, overlap_tokens)
    return _chunk_by_lines(text, max_tokens, overlap_tokens)


def _chunk_by_questions(text: str, max_tokens: int, overlap_tokens: int) -> List[Chunk]:
    """Split text at question-number boundaries so no question is ever cut in half.

    Strategy:
    - Split the text into "question blocks" at each numbered question boundary.
    - Any leading text before the first question (e.g. passage text, answer key
      headers) is prepended to the first block.
    - Group consecutive question blocks until adding the next would exceed the
      token budget. Each group becomes one chunk.
    - Overlap: the last question of each chunk is repeated as the first question
      of the next chunk (1-question overlap, cheaper than token-based overlap).
    """
    pages = text.split(PAGE_MARKER) if PAGE_MARKER in text else [text]

    # Build (line, page_no) list
    all_lines: List[tuple] = []
    for page_no, page in enumerate(pages, start=1):
        for line in page.split("\n"):
            all_lines.append((line, page_no))

    if not all_lines:
        return [Chunk(0, 1, len(pages), text.strip(), _estimate_tokens(text))]

    # Find line indices where a new question starts
    question_starts: List[int] = []
    for idx, (line, _) in enumerate(all_lines):
        if _QUESTION_START.match(line):
            question_starts.append(idx)

    if not question_starts:
        return _chunk_by_lines(text, max_tokens, overlap_tokens)

    # Build question blocks: each block is the lines from one question start
    # to the next (or end of text). Lines before the first question are a preamble.
    blocks: List[List[tuple]] = []  # each is [(line, page_no), ...]

    # Preamble: lines before the first question
    preamble = all_lines[: question_starts[0]]

    for i, start in enumerate(question_starts):
        end = question_starts[i + 1] if i + 1 < len(question_starts) else len(all_lines)
        blocks.append(all_lines[start:end])

    # Group blocks into chunks, respecting the token budget.
    # For small models, we want smaller chunks so each LLM call handles fewer
    # questions -> higher per-question accuracy.
    chunks: List[Chunk] = []
    current_blocks: List[List[tuple]] = []
    current_tokens = 0

    # Include preamble tokens in the first chunk's budget
    preamble_text = "\n".join(ln for ln, _ in preamble).strip()
    preamble_tokens = _estimate_tokens(preamble_text) if preamble_text else 0

    # Answer key / passage text that appears before questions: include in every
    # chunk that needs it (we detect if preamble looks like an answer key).
    _is_answer_key_preamble = bool(
        re.search(r"\b(?:answer|key|correct|dap an)\b", preamble_text, re.IGNORECASE)
    ) if preamble_text else False

    for block in blocks:
        block_text = "\n".join(ln for ln, _ in block)
        block_tokens = _estimate_tokens(block_text)

        # Would adding this block exceed the budget?
        effective_preamble = preamble_tokens if not current_blocks else 0
        if current_blocks and (current_tokens + block_tokens + effective_preamble) > max_tokens:
            # Flush current group as a chunk
            _flush_chunk(chunks, current_blocks, preamble if chunks == [] or _is_answer_key_preamble else [])
            # Overlap: repeat the LAST block of the previous chunk
            current_blocks = [current_blocks[-1]] if overlap_tokens > 0 else []
            current_tokens = _estimate_tokens(
                "\n".join(ln for ln, _ in current_blocks[0])
            ) if current_blocks else 0

        current_blocks.append(block)
        current_tokens += block_tokens

    # Flush remaining
    if current_blocks:
        _flush_chunk(chunks, current_blocks, preamble if chunks == [] or _is_answer_key_preamble else [])

    return chunks


def _flush_chunk(
    chunks: List[Chunk],
    blocks: List[List[tuple]],
    preamble: List[tuple],
) -> None:
    """Build a Chunk from a list of question blocks + optional preamble."""
    all_block_lines = [ln for block in blocks for ln in block]
    combined = preamble + all_block_lines if preamble else all_block_lines

    content = "\n".join(ln for ln, _ in combined).strip()
    if not content:
        return

    page_start = combined[0][1]
    page_end = combined[-1][1]
    q_nums = _find_question_numbers(content)

    chunks.append(Chunk(
        index=len(chunks),
        page_start=page_start,
        page_end=page_end,
        content=content,
        token_estimate=_estimate_tokens(content),
        question_numbers=q_nums,
    ))


def _chunk_by_lines(text: str, max_tokens: int, overlap_tokens: int) -> List[Chunk]:
    """Line-aware sliding chunker with page tracking (original algorithm).

    Breaks only at line boundaries so a question stem or an "(A) ... (D)" choice
    line is never split across chunks.
    """
    pages = text.split(PAGE_MARKER) if PAGE_MARKER in text else [text]

    lines: List[tuple] = []
    for page_no, page in enumerate(pages, start=1):
        for line in page.split("\n"):
            lines.append((line, page_no))

    if not lines:
        return [Chunk(0, 1, len(pages), text.strip(), _estimate_tokens(text))]

    chunks: List[Chunk] = []
    n = len(lines)
    i = 0
    while i < n:
        j, tokens = i, 0
        while j < n and tokens < max_tokens:
            tokens += max(1, _estimate_tokens(lines[j][0]))
            j += 1
        window = lines[i:j]
        content = "\n".join(ln for ln, _ in window).strip()
        if content:
            chunks.append(
                Chunk(
                    len(chunks),
                    window[0][1],
                    window[-1][1],
                    content,
                    _estimate_tokens(content),
                )
            )
        if j >= n:
            break
        back, ov, k = 0, 0, j - 1
        while k > i and ov < overlap_tokens:
            ov += max(1, _estimate_tokens(lines[k][0]))
            k -= 1
            back += 1
        i = max(i + 1, j - back)
    return chunks
