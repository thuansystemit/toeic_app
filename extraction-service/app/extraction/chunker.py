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
    pages = text.split(PAGE_MARKER) if PAGE_MARKER in text else [text]

    chunks: List[Chunk] = []
    buf: List[str] = []
    buf_tokens = 0
    page_start = 1
    page_no = 0

    def flush(p_start: int, p_end: int) -> None:
        nonlocal buf, buf_tokens
        if not buf:
            return
        content = "\n".join(buf).strip()
        if content:
            chunks.append(
                Chunk(len(chunks), p_start, p_end, content, _estimate_tokens(content))
            )
        # carry overlap from the tail of this chunk
        tail = " ".join(content.split()[-int(overlap_tokens * 0.75):])
        buf = [tail] if tail else []
        buf_tokens = _estimate_tokens(tail)

    for i, page in enumerate(pages, start=1):
        page_no = i
        if not buf:
            page_start = i
        buf.append(page)
        buf_tokens += _estimate_tokens(page)
        if buf_tokens >= max_tokens:
            flush(page_start, page_no)
            page_start = page_no

    flush(page_start, page_no or 1)
    return chunks or [Chunk(0, 1, page_no or 1, text.strip(), _estimate_tokens(text))]
