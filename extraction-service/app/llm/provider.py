"""LLM provider strategy interface — add a provider by implementing this."""
from typing import Protocol


class LlmProvider(Protocol):
    name: str

    def extract_json(self, system_prompt: str, document_text: str) -> str:
        """Return a JSON string matching the question schema. Raises on failure."""
        ...
