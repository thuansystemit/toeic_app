"""Local Ollama provider — JSON-constrained generation optimized for small models.

Tuned for qwen2.5:3b and similar 3B-parameter models: larger context window,
generous predict budget, aggressive JSON recovery, and question-count hints
injected into each call so the model knows exactly how many items to produce.
"""
import json
import re
import time
from typing import Optional

import requests

from app.observability import audit

# Retry transient transport failures with exponential backoff.
_MAX_ATTEMPTS = 3
_RETRY_STATUS = {500, 502, 503, 504}

# Regex to detect question numbers in raw text (e.g. "101.", "Question 102)")
_QUESTION_NUM_RE = re.compile(
    r"(?:^|\n)\s*(?:question\s+)?(\d{1,3})\s*[.):]", re.IGNORECASE
)


class OllamaProvider:
    name = "ollama"

    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model

    def health(self) -> dict:
        """Confirm the Ollama server is reachable and the model is pulled."""
        r = requests.get(f"{self.base_url}/api/tags", timeout=10)
        r.raise_for_status()
        models = [m.get("name", "") for m in r.json().get("models", [])]
        base = self.model.split(":")[0]
        present = self.model in models or any(m.split(":")[0] == base for m in models)
        return {"reachable": True, "model": self.model,
                "model_present": present, "models": models}

    def extract_json(self, system_prompt: str, document_text: str) -> str:
        # Detect expected question numbers from the chunk text to inject a
        # count hint that helps small models maintain completeness.
        expected_nums = sorted(set(
            int(m.group(1)) for m in _QUESTION_NUM_RE.finditer(document_text)
        ))
        count_hint = ""
        if expected_nums:
            nums_str = ", ".join(str(n) for n in expected_nums)
            count_hint = (
                f"\n\nIMPORTANT: This text contains {len(expected_nums)} questions "
                f"(numbers: {nums_str}). You MUST output exactly "
                f"{len(expected_nums)} question objects in your JSON, one for each "
                f"of these numbers. Do not skip any."
            )

        full_system = system_prompt + count_hint

        payload = {
            "model": self.model,
            "format": "json",
            "stream": False,
            # Context budget: system prompt (~500 tokens) + chunk (~600 tokens)
            # + output (up to ~6000 tokens for dense chunks with passages).
            # 16384 gives ample headroom; qwen2.5:3b supports up to 32k natively.
            # num_predict=8192 ensures even a 10-question chunk with full passages
            # and 4 choices each is never truncated.
            "options": {
                "temperature": 0,
                "num_ctx": 16384,
                "num_predict": 8192,
                "repeat_penalty": 1.1,
            },
            "messages": [
                {"role": "system", "content": full_system},
                {"role": "user", "content": document_text},
            ],
        }

        last_err: Exception | None = None
        for attempt in range(_MAX_ATTEMPTS):
            try:
                resp = requests.post(
                    f"{self.base_url}/api/chat", json=payload, timeout=600,
                )
                resp.raise_for_status()
                data = resp.json()
                content = data.get("message", {}).get("content", "")

                # Check for truncation: if the model hit the predict limit,
                # the JSON is likely incomplete.
                done_reason = data.get("done_reason", "")
                if done_reason == "length":
                    audit("OLLAMA_TRUNCATED", model=self.model, attempt=attempt)
                    # Try to salvage what we got
                    parsed = _robust_parse(content)
                    salvaged_count = len(parsed.get("questions", []))
                    if expected_nums and salvaged_count < len(expected_nums) * 0.5:
                        # Too much was lost — retry is unlikely to help with
                        # the same payload, but we can try
                        if attempt < _MAX_ATTEMPTS - 1:
                            last_err = RuntimeError(
                                f"Truncated output: got {salvaged_count} of "
                                f"{len(expected_nums)} expected questions"
                            )
                            time.sleep(2 ** attempt)
                            continue
                    return json.dumps(parsed)

                return json.dumps(_robust_parse(content))

            except (requests.ConnectionError, requests.Timeout) as e:
                last_err = e
            except requests.HTTPError as e:
                if resp.status_code not in _RETRY_STATUS:
                    raise
                last_err = e

            if attempt < _MAX_ATTEMPTS - 1:
                time.sleep(2 ** attempt)

        raise RuntimeError(f"Ollama request failed after {_MAX_ATTEMPTS} attempts: {last_err}")

    def complete_json(self, system_prompt: str, user_text: str) -> str:
        """Generic JSON task (skill tagging) — no count hint, smaller predict
        budget, returns the model's JSON object as a string."""
        payload = {
            "model": self.model,
            "format": "json",
            "stream": False,
            "options": {"temperature": 0, "num_ctx": 16384, "num_predict": 2048},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ],
        }
        last_err: Exception | None = None
        for attempt in range(_MAX_ATTEMPTS):
            try:
                resp = requests.post(
                    f"{self.base_url}/api/chat", json=payload, timeout=300,
                )
                resp.raise_for_status()
                content = resp.json().get("message", {}).get("content", "")
                return json.dumps(_loads_object(content))
            except (requests.ConnectionError, requests.Timeout) as e:
                last_err = e
            except requests.HTTPError as e:
                if resp.status_code not in _RETRY_STATUS:
                    raise
                last_err = e
            if attempt < _MAX_ATTEMPTS - 1:
                time.sleep(2 ** attempt)
        raise RuntimeError(f"Ollama tagging request failed after {_MAX_ATTEMPTS} attempts: {last_err}")


def _loads_object(content: str) -> dict:
    """Lenient parse of a single JSON object from small-model output. Tries a
    strict parse, then isolates the outermost ``{ ... }``. Returns ``{}`` if
    nothing parses (the tagger treats that as 'no tags')."""
    content = (content or "").strip()
    if not content:
        return {}
    try:
        result = json.loads(content)
        return result if isinstance(result, dict) else {}
    except json.JSONDecodeError:
        pass
    start = content.find("{")
    end = content.rfind("}")
    if start >= 0 and end > start:
        try:
            result = json.loads(content[start : end + 1])
            return result if isinstance(result, dict) else {}
        except json.JSONDecodeError:
            pass
    return {}


def _robust_parse(content: str) -> dict:
    """Parse JSON from small-model output with aggressive recovery.

    Small local models (even in JSON mode) often produce:
    - Missing commas between objects
    - Trailing commas before ] or }
    - Truncated tail (incomplete last object)
    - Duplicate keys
    - Single quotes instead of double quotes

    Recovery order:
    1. Strict parse
    2. Common repairs (missing commas, trailing commas, single quotes)
    3. Brace-by-brace salvage of individual question objects
    """
    content = content.strip()
    if not content:
        return {"questions": []}

    # 1. Strict parse
    try:
        result = json.loads(content)
        return _ensure_questions_wrapper(result)
    except json.JSONDecodeError:
        pass

    # 2. Common repairs
    repaired = content
    # Fix missing comma between adjacent objects: }{ -> },{
    repaired = re.sub(r"}\s*{", "},{", repaired)
    # Fix missing comma between adjacent arrays: ][ -> ],[
    repaired = re.sub(r"]\s*\[", "],[", repaired)
    # Remove trailing commas before } or ]
    repaired = re.sub(r",\s*([}\]])", r"\1", repaired)
    # Fix single quotes (common in small models)
    # Only do this if there are no double-quoted strings
    if '"' not in repaired and "'" in repaired:
        repaired = repaired.replace("'", '"')

    try:
        result = json.loads(repaired)
        return _ensure_questions_wrapper(result)
    except json.JSONDecodeError:
        pass

    # 3. Try to close truncated JSON: if the content ends abruptly, try
    # appending closing brackets/braces
    for suffix in [']}', '"]}', '"}]}', 'false}]}', 'null}]}']:
        try:
            result = json.loads(repaired + suffix)
            return _ensure_questions_wrapper(result)
        except json.JSONDecodeError:
            continue

    # 4. Brace-by-brace salvage
    return {"questions": _salvage_questions(content)}


def _ensure_questions_wrapper(result: object) -> dict:
    """Ensure the result is a dict with a 'questions' list.

    Small models sometimes return a bare list instead of {"questions": [...]},
    or put questions under a different key.
    """
    if isinstance(result, list):
        return {"questions": result}
    if isinstance(result, dict):
        if "questions" in result:
            return result
        # Check for common alternative keys
        for key in ("question", "data", "items", "result", "results"):
            if key in result and isinstance(result[key], list):
                return {"questions": result[key]}
        # If the dict itself looks like a single question, wrap it
        if "questionText" in result or "number" in result:
            return {"questions": [result]}
    return {"questions": []}


def _salvage_questions(content: str) -> list:
    """Walk the `questions` array brace-by-brace and keep each object that
    parses on its own -- tolerant of bad separators and a truncated final item."""
    marker = content.find('"questions"')
    if marker < 0:
        # Maybe the model output a bare array
        marker = content.find("[")
        if marker < 0:
            return []
        start_bracket = marker
    else:
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
                fragment = content[obj_start: i + 1]
                # Try strict parse first
                try:
                    items.append(json.loads(fragment))
                except json.JSONDecodeError:
                    # Try repairing the fragment
                    repaired = re.sub(r",\s*([}\]])", r"\1", fragment)
                    try:
                        items.append(json.loads(repaired))
                    except json.JSONDecodeError:
                        pass
                obj_start = -1
        elif ch == "]" and depth == 0:
            break
    return items
