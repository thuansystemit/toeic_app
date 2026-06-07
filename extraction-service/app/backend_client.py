"""Talks to the NestJS internal endpoints (download file + post results)."""
from __future__ import annotations

import requests

from app.config import settings

_HEADERS = {"x-internal-token": settings.internal_token}


def download_file(storage_key: str) -> tuple[bytes, str]:
    url = f"{settings.backend_base_url}/internal/files/{storage_key}"
    r = requests.get(url, headers=_HEADERS, timeout=120)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


def mark_started(job_id: str) -> None:
    url = f"{settings.backend_base_url}/internal/extraction/{job_id}/started"
    requests.post(url, headers=_HEADERS, timeout=30)


def post_result(job_id: str, status: str, *, questions=None, warnings=None,
                error: str | None = None, model: str | None = None,
                usage: dict | None = None) -> None:
    url = f"{settings.backend_base_url}/internal/extraction/{job_id}/callback"
    payload = {"status": status}
    if questions is not None:
        payload["questions"] = questions
    if warnings is not None:
        payload["warnings"] = warnings
    if error is not None:
        payload["error"] = error
    if model is not None:
        payload["model"] = model
    if usage is not None:
        payload["usage"] = usage
    r = requests.post(url, headers={**_HEADERS, "Content-Type": "application/json"},
                      json=payload, timeout=60)
    r.raise_for_status()
