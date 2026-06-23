"""OpenAI provider — Chat Completions with JSON-schema response format."""
import json

# Output budget for a dense chunk (many questions -> long JSON). Mirrors the
# Claude provider's 16k so behaviour is consistent across providers.
_MAX_OUTPUT_TOKENS = 16384


class OpenAiProvider:
    name = "openai"

    def __init__(self, api_key: str, model: str):
        from openai import OpenAI

        # max_retries gives the SDK exponential backoff on 429/5xx/timeout, so a
        # transient blip doesn't discard the chunk.
        self._client = OpenAI(api_key=api_key, max_retries=3)
        self.model = model

    def extract_json(self, system_prompt: str, document_text: str) -> str:
        from app.domain.toeic_schema import QUESTION_JSON_SCHEMA

        resp = self._client.chat.completions.create(
            model=self.model,
            temperature=0,
            max_completion_tokens=_MAX_OUTPUT_TOKENS,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "toeic_questions",
                    "schema": QUESTION_JSON_SCHEMA,
                    "strict": True,
                },
            },
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": document_text},
            ],
        )
        choice = resp.choices[0]
        # A `length` finish means the JSON was truncated mid-output; the content is
        # incomplete/invalid. Fail the chunk loudly instead of parsing a partial
        # object and silently dropping the questions that didn't fit.
        if choice.finish_reason == "length":
            raise RuntimeError(
                "OpenAI response truncated (finish_reason=length); "
                f"raise _MAX_OUTPUT_TOKENS or reduce CHUNK_TOKENS (model={self.model})"
            )
        content = choice.message.content or "{}"
        return json.dumps(json.loads(content))

    def complete_json(self, system_prompt: str, user_text: str) -> str:
        # Generic JSON task (e.g. skill tagging) — plain json_object mode, no
        # question schema. Keep the output budget modest; tagging is small.
        resp = self._client.chat.completions.create(
            model=self.model,
            temperature=0,
            max_completion_tokens=2048,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ],
        )
        content = resp.choices[0].message.content or "{}"
        return json.dumps(json.loads(content))
