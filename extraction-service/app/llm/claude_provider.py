"""Anthropic Claude provider — uses the official SDK.

Per Anthropic guidance: default model claude-opus-4-8; no temperature / top_p /
budget_tokens on Opus 4.8 (they 400). The system prompt instructs the model to
return only a JSON object; we extract that object from the response text so the
provider works on the installed SDK without the newer structured-output API.
"""
import json


class ClaudeProvider:
    name = "claude"

    def __init__(self, api_key: str, model: str):
        from anthropic import Anthropic

        self._client = Anthropic(api_key=api_key)
        self.model = model

    def extract_json(self, system_prompt: str, document_text: str) -> str:
        resp = self._client.messages.create(
            model=self.model,
            max_tokens=16000,
            system=system_prompt,
            messages=[{"role": "user", "content": document_text}],
        )
        text = "".join(
            block.text for block in resp.content if getattr(block, "type", "") == "text"
        )
        return json.dumps(_extract_json_object(text))


def _extract_json_object(text: str) -> dict:
    """Parse the JSON object from the model's reply. Tolerates code fences and any
    surrounding prose by isolating the outermost ``{ ... }`` before parsing."""
    text = (text or "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return {"questions": []}
