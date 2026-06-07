"""Versioning constants (EDIES §23 — version model, prompt, schema, output).

Bump these whenever the extraction contract, prompt, or output shape changes —
every extraction result records them for reproducibility and audit.
"""

SCHEMA_VERSION = "1.0"
PROMPT_VERSION = "toeic-reading-extract-v1"
SERVICE_NAME = "toeic-extraction-service"
