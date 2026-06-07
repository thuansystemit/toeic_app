"""OpenAI provider — Chat Completions with JSON-schema response format."""
import json


class OpenAiProvider:
    name = "openai"

    def __init__(self, api_key: str, model: str):
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key)
        self.model = model

    def extract_json(self, system_prompt: str, document_text: str) -> str:
        from app.domain.toeic_schema import QUESTION_JSON_SCHEMA

        resp = self._client.chat.completions.create(
            model=self.model,
            temperature=0,
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
        content = resp.choices[0].message.content or "{}"
        return json.dumps(json.loads(content))
