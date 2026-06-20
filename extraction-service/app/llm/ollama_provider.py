"""Local Ollama provider (llama3) — JSON-constrained generation."""
import json
import requests


class OllamaProvider:
    name = "ollama"

    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model

    def health(self) -> dict:
        """Confirm the Ollama server is reachable and the model is pulled.
        Raises (requests error) if the server can't be reached."""
        r = requests.get(f"{self.base_url}/api/tags", timeout=10)
        r.raise_for_status()
        models = [m.get("name", "") for m in r.json().get("models", [])]
        base = self.model.split(":")[0]
        present = self.model in models or any(m.split(":")[0] == base for m in models)
        return {"reachable": True, "model": self.model,
                "model_present": present, "models": models}

    def extract_json(self, system_prompt: str, document_text: str) -> str:
        resp = requests.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "format": "json",  # constrains output to valid JSON
                "stream": False,
                # A dense chunk yields many questions -> long JSON. The default
                # 2048-token context truncates that mid-output (invalid JSON), so
                # give room for the chunk + system prompt + a full answer. This is
                # affordable here because the model is small and GPU-resident
                # (a ~3B model in 4GB VRAM); only an oversized model on CPU made
                # a big context slow.
                "options": {
                    "temperature": 0,
                    "num_ctx": 8192,
                    "num_predict": 4096,
                },
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
        return json.dumps(_robust_parse(content))


def _robust_parse(content: str) -> dict:
    """Small local models (even in JSON mode) occasionally emit a malformed
    separator or a truncated tail. Recover instead of discarding the chunk:
      1. strict parse,
      2. fix the common 'missing comma between objects' error and retry,
      3. salvage every well-formed question object from the questions array.
    """
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    import re

    repaired = re.sub(r"}\s*{", "},{", content)
    repaired = re.sub(r"]\s*\[", "],[", repaired)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    return {"questions": _salvage_questions(content)}


def _salvage_questions(content: str) -> list:
    """Walk the `questions` array brace-by-brace and keep each object that
    parses on its own — tolerant of bad separators and a truncated final item."""
    marker = content.find('"questions"')
    if marker < 0:
        return []
    start_bracket = content.find("[", marker)
    if start_bracket < 0:
        return []

    items: list = []
    depth = 0
    obj_start = -1
    for i in range(start_bracket + 1, len(content)):
        ch = content[i]
        if ch == "{":
            if depth == 0:
                obj_start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and obj_start >= 0:
                try:
                    items.append(json.loads(content[obj_start : i + 1]))
                except json.JSONDecodeError:
                    pass
                obj_start = -1
        elif ch == "]" and depth == 0:
            break
    return items
