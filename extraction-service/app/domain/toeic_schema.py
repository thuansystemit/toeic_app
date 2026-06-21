"""TOEIC question schema + traceable extraction envelope.

Follows EDIES §7 (structured output), §8 (metadata/traceability), §25
(every extracted fact carries source, confidence, timestamp, schema version).
"""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


class Choice(BaseModel):
    label: Literal["A", "B", "C", "D"]
    text: str
    isCorrect: bool = False


class ExtractedQuestion(BaseModel):
    part: int = Field(ge=5, le=7, description="TOEIC reading part 5-7")
    number: Optional[int] = None  # the source question number, e.g. 101
    groupId: Optional[str] = None
    passageText: Optional[str] = None
    questionText: str
    choices: List[Choice]
    explanationVi: Optional[str] = None
    # Skill tags (knowledge-graph): codes from the TOEIC taxonomy, classified by
    # the same extraction LLM. Persisted as Question->Skill edges on import.
    skills: List[str] = Field(default_factory=list)
    # --- provenance / quality (EDIES §8, §25) ---
    confidence: float = 1.0
    issues: List[str] = Field(default_factory=list)
    sourcePage: Optional[int] = None

    @field_validator("choices")
    @classmethod
    def _exactly_four(cls, v: List[Choice]) -> List[Choice]:
        if len(v) != 4:
            raise ValueError("a question must have exactly 4 choices")
        if len({c.label for c in v}) != 4:
            raise ValueError("choices must use distinct labels A,B,C,D")
        return v


class DocumentSource(BaseModel):
    fileName: str
    fileType: str
    pageCount: Optional[int] = None
    fileHash: str  # sha256 — dedup + traceability (EDIES §5, §8)


class QualityMetrics(BaseModel):
    """EDIES §12 — measurable extraction quality.

    Includes completeness metrics that compare the number of questions extracted
    against the number of question numbers detected in the source text. This is
    the primary accuracy/completeness signal for evaluating extraction quality.
    """
    questionCount: int = 0
    skippedCount: int = 0
    lowConfidenceCount: int = 0
    missingAnswerKeyCount: int = 0
    needsReview: bool = False
    durationMs: int = 0
    # Completeness metrics: how many questions were expected vs. actually extracted.
    expectedQuestionCount: Optional[int] = None
    missingQuestionNumbers: Optional[List[int]] = None
    completenessPercent: Optional[float] = None  # 100.0 = every expected Q extracted
    choiceCompletenessPercent: Optional[float] = None  # 100.0 = every Q has 4 distinct ABCD


class ExtractionEnvelope(BaseModel):
    """The traceable result (EDIES §7). Mirrors what the worker sends to NestJS."""
    schemaVersion: str
    promptVersion: str
    model: str
    source: DocumentSource
    extractedAt: str
    quality: QualityMetrics
    questions: List[ExtractedQuestion] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


# JSON Schema fragment handed to providers that support structured output
# (EDIES §13: validate ALL LLM output against a schema).
QUESTION_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "part": {"type": "integer"},
                    "number": {"type": ["integer", "null"]},
                    "groupId": {"type": ["string", "null"]},
                    "passageText": {"type": ["string", "null"]},
                    "questionText": {"type": "string"},
                    "choices": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "label": {"type": "string", "enum": ["A", "B", "C", "D"]},
                                "text": {"type": "string"},
                                "isCorrect": {"type": "boolean"},
                            },
                            "required": ["label", "text", "isCorrect"],
                            "additionalProperties": False,
                        },
                    },
                    "explanationVi": {"type": ["string", "null"]},
                    "skills": {"type": "array", "items": {"type": "string"}},
                    "sourcePage": {"type": ["integer", "null"]},
                },
                "required": ["part", "questionText", "choices"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["questions"],
    "additionalProperties": False,
}
