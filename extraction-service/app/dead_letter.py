"""Capture jobs that fail terminally, for later inspection/retry."""
import json
import logging

import redis

from app.config import settings

log = logging.getLogger("extraction.deadletter")
DEAD_LETTER_KEY = "extraction:dead"


def record(client: "redis.Redis", raw_message: str, error: str) -> None:
    try:
        client.lpush(DEAD_LETTER_KEY, json.dumps({"message": raw_message, "error": error}))
    except Exception:  # never let the dead-letter path crash the worker
        log.exception("failed to record dead-letter")
