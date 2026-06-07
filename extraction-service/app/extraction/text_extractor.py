"""Extract plain text from a PDF or DOCX byte stream."""
import io


def extract_text(data: bytes, mime: str) -> str:
    if mime == "application/pdf":
        return _from_pdf(data)
    if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _from_docx(data)
    raise ValueError(f"unsupported mime: {mime}")


def _from_pdf(data: bytes) -> str:
    import pdfplumber

    # Join pages with a form-feed so the chunker can track page boundaries.
    parts = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return "\f".join(parts)


def _from_docx(data: bytes) -> str:
    import docx  # python-docx

    document = docx.Document(io.BytesIO(data))
    return "\n".join(p.text for p in document.paragraphs)
