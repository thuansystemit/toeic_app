"""Environment-driven settings for the extraction worker.

Switching LLMs is purely .env-driven and LIVE: the repo-root `.env` is mounted
into the container and re-read on demand (see `get_settings()`), so editing
`LLM_PROVIDER` / model / key in `.env` takes effect on the next job — no rebuild,
no restart, no code change. `settings` (module-level) is the static snapshot for
values that never change at runtime (redis, backend URL, chunk sizes)."""
import os
from dataclasses import dataclass, field

# Mounted at /app/.env by docker-compose; overridable for local runs.
ENV_FILE = os.environ.get("ENV_FILE", "/app/.env")


def _load_env_file(path: str) -> None:
    """Read a KEY=VALUE .env file into os.environ (override). Tiny, dependency-
    free parser: ignores blank lines and `#` comments, strips surrounding
    quotes. Missing file is fine — the container env is used as-is."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                if key:
                    os.environ[key] = val.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass


@dataclass(frozen=True)
class Settings:
    # default_factory so every Settings() reads the CURRENT os.environ (which
    # get_settings() refreshes from the mounted .env first).
    redis_url: str = field(default_factory=lambda: os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    queue: str = field(default_factory=lambda: os.environ.get("EXTRACTION_QUEUE", "extraction:jobs"))

    backend_base_url: str = field(default_factory=lambda: os.environ.get("BACKEND_BASE_URL", "http://localhost:3000/api"))
    internal_token: str = field(default_factory=lambda: os.environ.get("INTERNAL_API_TOKEN", "dev-internal-token-change-me"))

    # LLM provider selection + per-provider config (all live-switchable via .env).
    provider: str = field(default_factory=lambda: os.environ.get("LLM_PROVIDER", "ollama"))  # ollama | claude | openai

    ollama_base_url: str = field(default_factory=lambda: os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"))
    ollama_model: str = field(default_factory=lambda: os.environ.get("OLLAMA_MODEL", "llama3"))

    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""))
    anthropic_model: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8"))

    openai_api_key: str = field(default_factory=lambda: os.environ.get("OPENAI_API_KEY", ""))
    openai_model: str = field(default_factory=lambda: os.environ.get("OPENAI_MODEL", "gpt-4o"))

    # Guardrails (EDIES §5)
    max_file_bytes: int = field(default_factory=lambda: int(os.environ.get("MAX_FILE_BYTES", str(20 * 1024 * 1024))))
    max_pages: int = field(default_factory=lambda: int(os.environ.get("MAX_PAGES", "500")))
    max_chars: int = field(default_factory=lambda: int(os.environ.get("MAX_TEXT_CHARS", "120000")))
    min_chars: int = field(default_factory=lambda: int(os.environ.get("MIN_TEXT_CHARS", "40")))

    # Chunking (EDIES §9). Defaults tuned for small local models (qwen2.5:3b):
    # smaller chunks (600 tokens ~ 5-8 questions) so the model sees fewer items
    # per call and extracts each one more faithfully. The question-boundary-aware
    # chunker in chunker.py will further ensure no question is split.
    chunk_tokens: int = field(default_factory=lambda: int(os.environ.get("CHUNK_TOKENS", "600")))
    chunk_overlap: int = field(default_factory=lambda: int(os.environ.get("CHUNK_OVERLAP", "100")))

    # Quality gate (EDIES §12, §22): below this -> flag for human review.
    low_confidence_threshold: float = field(default_factory=lambda: float(os.environ.get("LOW_CONFIDENCE", "0.6")))


def get_settings() -> Settings:
    """Fresh settings after re-reading the mounted .env — call this for anything
    that must reflect a live `.env` edit (LLM provider, model, API key)."""
    _load_env_file(ENV_FILE)
    return Settings()


# Static snapshot for runtime-stable values (redis, backend URL, chunk sizes).
settings = Settings()
