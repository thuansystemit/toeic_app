"""Extraction worker: consumes jobs from Redis and calls back to NestJS.

Message shape (LPUSH'd by NestJS):
  {"jobId","examFileId","storageKey","fileName","provider","model"}

Follows EDIES §17 (async stages), §18 (classified errors, user-safe messages),
§19 (audit log per action), §24 (metrics).
"""
import json
import signal
import sys

import redis

from app.config import settings
from app import backend_client, dead_letter
from app.errors import ErrorCode, ExtractionError
from app.observability import METRICS, audit, correlation_id, incr
from app.pipeline import run_extraction

_running = True


def _stop(*_):
    global _running
    _running = False


def handle(client: redis.Redis, raw: str) -> None:
    msg = json.loads(raw)
    job_id = msg["jobId"]
    document_id = msg.get("examFileId", "")
    storage_key = msg["storageKey"]
    file_name = msg.get("fileName", storage_key)
    provider = msg.get("provider") or settings.provider
    part = msg.get("part")
    corr = correlation_id(job_id)

    audit("EXTRACTION_STARTED", correlationId=corr, jobId=job_id,
          documentId=document_id, provider=provider, part=part)
    incr("documents_processed_total")

    try:
        backend_client.mark_started(job_id)
        data, mime = backend_client.download_file(storage_key)

        env = run_extraction(
            data, mime, file_name, provider_name=provider,
            job_id=job_id, on_stage=lambda s: None, part=part,
        )

        # Provenance + quality travel in `usage` (stored as JSONB by NestJS).
        backend_client.post_result(
            job_id, "succeeded",
            questions=[q.model_dump() for q in env.questions],
            warnings=env.warnings,
            model=env.model,
            usage={
                "schemaVersion": env.schemaVersion,
                "promptVersion": env.promptVersion,
                "source": env.source.model_dump(),
                "quality": env.quality.model_dump(),
            },
        )
        incr("llm_token_usage_total", 0)
        METRICS["question_count_total"] += env.quality.questionCount
        audit("EXTRACTION_COMPLETED", correlationId=corr, jobId=job_id,
              documentId=document_id, model=env.model, promptVersion=env.promptVersion,
              schemaVersion=env.schemaVersion, status="succeeded",
              questionCount=env.quality.questionCount,
              needsReview=env.quality.needsReview, durationMs=env.quality.durationMs)

    except ExtractionError as e:  # classified, user-safe (EDIES §18)
        incr("documents_failed_total")
        audit("EXTRACTION_FAILED", correlationId=corr, jobId=job_id,
              documentId=document_id, errorCode=e.code, internal=e.internal)
        _report_failure(client, job_id, raw, e.user_message, str(e))

    except Exception as e:  # unexpected -> INTERNAL, never leak details
        incr("documents_failed_total")
        audit("EXTRACTION_FAILED", correlationId=corr, jobId=job_id,
              documentId=document_id, errorCode=ErrorCode.INTERNAL, internal=str(e))
        _report_failure(client, job_id, raw,
                        "An unexpected error occurred while processing the document.",
                        str(e))


def _report_failure(client, job_id, raw, user_message, internal):
    try:
        backend_client.post_result(job_id, "failed", error=user_message)
    except Exception:
        audit("CALLBACK_FAILED", jobId=job_id)
    dead_letter.record(client, raw, internal)


def main() -> int:
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    audit("WORKER_UP", queue=settings.queue, provider=settings.provider)

    while _running:
        item = client.brpop(settings.queue, timeout=5)
        if item is None:
            continue
        _, raw = item
        try:
            handle(client, raw)
        except Exception as e:
            audit("WORKER_ERROR", internal=str(e))
    audit("WORKER_DOWN", metrics=dict(METRICS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
