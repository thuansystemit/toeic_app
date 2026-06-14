"""Local Ollama provider (llama3) — JSON-constrained generation."""
import json
import requests


class OllamaProvider:
    name = "ollama"

    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model

    def extract_json(self, system_prompt: str, document_text: str) -> str:
        resp = requests.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "format": "json",  # constrains output to valid JSON
                "stream": False,
                # Default context (2048) comfortably fits a ~1000-token chunk +
                # the system prompt; a larger window only slows generation on
                # CPU-bound Ollama hosts (and risked request timeouts).
                "options": {"temperature": 0},
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": document_text},
                ],
            },
            timeout=600,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data.get("message", {}).get("content", "")
        # Validate it parses; re-dump to normalize.
        return json.dumps(json.loads(content))
