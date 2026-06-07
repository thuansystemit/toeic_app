"""Environment-driven settings for the extraction worker."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    queue: str = os.environ.get("EXTRACTION_QUEUE", "extraction:jobs")

    backend_base_url: str = os.environ.get("BACKEND_BASE_URL", "http://localhost:3000/api")
    internal_token: str = os.environ.get("INTERNAL_API_TOKEN", "dev-internal-token-change-me")

    # LLM provider selection + per-provider config.
    provider: str = os.environ.get("LLM_PROVIDER", "ollama")  # ollama | claude | openai

    ollama_base_url: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    ollama_model: str = os.environ.get("OLLAMA_MODEL", "llama3")

    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    anthropic_model: str = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8")

    openai_api_key: str = os.environ.get("OPENAI_API_KEY", "")
    openai_model: str = os.environ.get("OPENAI_MODEL", "gpt-4o")

    # Guardrails (EDIES §5)
    max_file_bytes: int = int(os.environ.get("MAX_FILE_BYTES", str(20 * 1024 * 1024)))
    max_pages: int = int(os.environ.get("MAX_PAGES", "500"))
    max_chars: int = int(os.environ.get("MAX_TEXT_CHARS", "120000"))
    min_chars: int = int(os.environ.get("MIN_TEXT_CHARS", "40"))

    # Chunking (EDIES §9)
    chunk_tokens: int = int(os.environ.get("CHUNK_TOKENS", "1000"))
    chunk_overlap: int = int(os.environ.get("CHUNK_OVERLAP", "150"))

    # Quality gate (EDIES §12, §22): below this -> flag for human review.
    low_confidence_threshold: float = float(os.environ.get("LOW_CONFIDENCE", "0.6"))


settings = Settings()
