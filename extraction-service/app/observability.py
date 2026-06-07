"""Structured audit logging + metrics (EDIES §19 Audit, §24 Observability).

Emits one JSON log line per event with the standard fields
(correlationId, jobId, documentId, status, model, promptVersion, duration…)
and keeps simple in-process counters for documents processed/failed/etc.
"""
import json
import logging
import sys
import time
from collections import Counter
from contextlib import contextmanager
from typing import Any, Dict, Optional

from app.version import SERVICE_NAME

_logger = logging.getLogger("extraction")
if not _logger.handlers:
    _h = logging.StreamHandler(sys.stdout)
    _h.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(_h)
    _logger.setLevel(logging.INFO)

# Minimal in-process metrics (EDIES §24). A real deployment scrapes these.
METRICS: Counter = Counter()


def audit(event_type: str, **fields: Any) -> None:
    """Emit one structured JSON audit line."""
    record: Dict[str, Any] = {
        "service": SERVICE_NAME,
        "event": event_type,
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    record.update({k: v for k, v in fields.items() if v is not None})
    _logger.info(json.dumps(record, ensure_ascii=False))


def incr(metric: str, n: int = 1) -> None:
    METRICS[metric] += n


@contextmanager
def timed(metric: str):
    start = time.monotonic()
    try:
        yield
    finally:
        METRICS[f"{metric}_ms_total"] += int((time.monotonic() - start) * 1000)


def correlation_id(job_id: str) -> str:
    return f"corr-{job_id}"
