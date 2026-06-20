"""Select an LlmProvider by name. Add a provider here once.

Reads LIVE settings (re-read from the mounted .env) so the provider, model, and
API key reflect the current .env without a restart."""
from __future__ import annotations

from app.config import get_settings
from app.llm.provider import LlmProvider


def get_provider(name: str | None = None) -> LlmProvider:
    cfg = get_settings()
    name = (name or cfg.provider).lower()

    if name == "ollama":
        from app.llm.ollama_provider import OllamaProvider

        return OllamaProvider(cfg.ollama_base_url, cfg.ollama_model)

    if name == "claude":
        from app.llm.claude_provider import ClaudeProvider

        if not cfg.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        return ClaudeProvider(cfg.anthropic_api_key, cfg.anthropic_model)

    if name == "openai":
        from app.llm.openai_provider import OpenAiProvider

        if not cfg.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        return OpenAiProvider(cfg.openai_api_key, cfg.openai_model)

    raise ValueError(f"unknown LLM provider: {name}")
