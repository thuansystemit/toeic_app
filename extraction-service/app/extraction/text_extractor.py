"""Extract plain text from a PDF or DOCX byte stream.

PDFs may have a real text layer (born-digital) or be scanned images. We read the
text layer with pdfplumber and, for any page that comes back essentially empty,
fall back to OCR (PyMuPDF renders the page -> Tesseract recognises it). This
handles fully-scanned and mixed documents without OCR-ing pages that don't need
it.
"""
import io
import re

from app.observability import audit

# A page with fewer than this many characters of real text is treated as a
# scanned image and sent to OCR.
_PAGE_TEXT_MIN_CHARS = 20
# Render DPI for OCR — higher = better character accuracy (fewer "as"->"a8"
# style errors) at the cost of speed. 300 DPI is the sweet spot for TOEIC docs.
_OCR_DPI = 300
# Tesseract: LSTM engine (--oem 1), automatic page segmentation (--psm 3).
# psm 3 detects multi-column layouts and reads each column in proper order;
# TOEIC reading sheets are two-column, and the old --psm 6 ("one uniform block")
# read straight across both columns, gluing a left-column question onto the same
# line as a right-column one. That hid every right-column question number from
# the line-start question detector (chunker + completeness pass), so half the
# questions silently went missing. preserve_interword_spaces=1 keeps choice
# labels (A) (B) (C) (D) from merging with adjacent text.
_OCR_CONFIG = "--oem 1 --psm 3 -c preserve_interword_spaces=1"
# A TOEIC sentence blank (a long underline) gets OCR'd as runs of dots / under-
# scores / backslashes / pluses / zeros / dashes, e.g. "\.....+0", "---",
# "______", ".. ..", etc. Collapse such runs into a clean "____".
_BLANK_RE = re.compile(r"\\?[._\-]{2,}[\\._+=0\-]*|_{2,}")


def _normalize_ocr(text: str) -> str:
    text = _BLANK_RE.sub(" ____ ", text)
    # Collapse the runs of spaces the substitution and OCR introduce.
    return re.sub(r"[ \t]{2,}", " ", text)


def extract_text(data: bytes, mime: str) -> str:
    if mime == "application/pdf":
        return _from_pdf(data)
    if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _from_docx(data)
    raise ValueError(f"unsupported mime: {mime}")


def _from_pdf(data: bytes) -> str:
    import pdfplumber

    # Pass 1: text layer, per page (form-feed separators keep page boundaries
    # so the chunker can attribute questions to a source page).
    parts: list[str] = []
    ocr_pages: list[int] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for i, page in enumerate(pdf.pages):
            txt = page.extract_text() or ""
            parts.append(txt)
            if len(txt.strip()) < _PAGE_TEXT_MIN_CHARS:
                ocr_pages.append(i)

    # Pass 2: OCR only the pages that had no usable text layer.
    if ocr_pages:
        recognised = _ocr_pdf_pages(data, ocr_pages)
        for i, txt in recognised.items():
            if len(txt.strip()) > len(parts[i].strip()):
                parts[i] = txt

    return "\f".join(parts)


def _ocr_pdf_pages(data: bytes, pages: list[int]) -> dict[int, str]:
    """Render the given page indices and OCR them. Best-effort: if the OCR stack
    is unavailable or a page fails, we skip it and let the text-layer result
    (and downstream guardrails) decide."""
    try:
        import fitz  # PyMuPDF
        import pytesseract
        from PIL import Image
    except Exception as e:  # pragma: no cover - import/runtime env issue
        audit("OCR_UNAVAILABLE", error=str(e))
        return {}

    audit("OCR_FALLBACK", pages=len(pages), dpi=_OCR_DPI)
    out: dict[int, str] = {}
    with fitz.open(stream=data, filetype="pdf") as doc:
        for i in pages:
            try:
                pix = doc[i].get_pixmap(dpi=_OCR_DPI)
                img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                out[i] = _normalize_ocr(pytesseract.image_to_string(img, config=_OCR_CONFIG))
            except Exception as e:
                audit("OCR_PAGE_FAILED", page=i, error=str(e))
    return out


def _from_docx(data: bytes) -> str:
    import docx  # python-docx

    document = docx.Document(io.BytesIO(data))
    return "\n".join(p.text for p in document.paragraphs)
