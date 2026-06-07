"""Select an LlmProvider by name. Add a provider here once."""
from __future__ import annotations

from app.config import settings
from app.llm.provider import LlmProvider


def get_provider(name: str | None = None) -> LlmProvider:
    name = (name or settings.provider).lower()

    if name == "ollama":
        from app.llm.ollama_provider import OllamaProvider

        return OllamaProvider(settings.ollama_base_url, settings.ollama_model)

    if name == "claude":
        from app.llm.claude_provider import ClaudeProvider

        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        return ClaudeProvider(settings.anthropic_api_key, settings.anthropic_model)

    if name == "openai":
        from app.llm.openai_provider import OpenAiProvider

        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        return OpenAiProvider(settings.openai_api_key, settings.openai_model)

    raise ValueError(f"unknown LLM provider: {name}")
