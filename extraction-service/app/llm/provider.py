"""LLM provider strategy interface — add a provider by implementing this."""
from typing import Protocol


class LlmProvider(Protocol):
    name: str

    def extract_json(self, system_prompt: str, document_text: str) -> str:
        """Return a JSON string matching the question schema. Raises on failure."""
        ...

    def complete_json(self, system_prompt: str, user_text: str) -> str:
        """Return a JSON string for a generic task (not the question schema) — used
        by the skill-tagging pass. Raises on failure."""
        ...
