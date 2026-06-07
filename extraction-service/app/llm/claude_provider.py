"""Anthropic Claude provider — uses the official SDK with structured output.

Per Anthropic guidance: default model claude-opus-4-8; structured JSON via
output_config.format; no temperature/top_p/budget_tokens on Opus 4.8.
"""
import json


class ClaudeProvider:
    name = "claude"

    def __init__(self, api_key: str, model: str):
        from anthropic import Anthropic

        self._client = Anthropic(api_key=api_key)
        self.model = model

    def extract_json(self, system_prompt: str, document_text: str) -> str:
        from app.domain.toeic_schema import QUESTION_JSON_SCHEMA

        resp = self._client.messages.create(
            model=self.model,
            max_tokens=16000,
            system=system_prompt,
            messages=[{"role": "user", "content": document_text}],
            output_config={
                "format": {
                    "type": "json_schema",
                    "schema": QUESTION_JSON_SCHEMA,
                }
            },
        )
        text = "".join(
            block.text for block in resp.content if getattr(block, "type", "") == "text"
        )
        return json.dumps(json.loads(text))
