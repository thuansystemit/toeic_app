"""Token-budget chunking with page tracking (EDIES §9 Chunking Standard).

A rough word-based token estimate keeps the dependency surface small. Each chunk
records pageStart/pageEnd so extracted questions can be traced back to a page.
"""
from dataclasses import dataclass
from typing import List

# Page boundary marker emitted by the text extractor between pages.
PAGE_MARKER = "\f"  # form feed


@dataclass
class Chunk:
    index: int
    page_start: int
    page_end: int
    content: str
    token_estimate: int


def _estimate_tokens(text: str) -> int:
    # ~0.75 words/token; good enough for budgeting (EDIES §9 baseline 800-1200).
    return int(len(text.split()) / 0.75)


def chunk_text(text: str, max_tokens: int = 1000, overlap_tokens: int = 150) -> List[Chunk]:
    """Line-aware sliding chunker with page tracking.

    Breaks only at line boundaries so a question stem or an "(A) ... (D)" choice
    line is never split across chunks. A generous trailing overlap means a Part
    6/7 passage and the questions that reference it (often on the next page) land
    together in at least one chunk. Each line keeps its page number so a chunk
    can report the page range it spans; the pipeline de-duplicates the questions
    that the overlap inevitably repeats.
    """
    pages = text.split(PAGE_MARKER) if PAGE_MARKER in text else [text]

    # Flatten to (line, page_no); windowing is independent of page sizes and a
    # single oversized page is still split (DOCX has no page markers at all).
    lines: List[tuple[str, int]] = []
    for page_no, page in enumerate(pages, start=1):
        for line in page.split("\n"):
            lines.append((line, page_no))

    if not lines:
        return [Chunk(0, 1, len(pages), text.strip(), _estimate_tokens(text))]

    chunks: List[Chunk] = []
    n = len(lines)
    i = 0
    while i < n:
        # Grow the window line by line until the token budget is reached.
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
        # Step back over ~overlap_tokens of trailing lines for the next chunk,
        # but always make forward progress.
        back, ov, k = 0, 0, j - 1
        while k > i and ov < overlap_tokens:
            ov += max(1, _estimate_tokens(lines[k][0]))
            k -= 1
            back += 1
        i = max(i + 1, j - back)
    return chunks
