"""Classified error taxonomy (EDIES §18 — Error Handling Standard).

Each error carries a stable machine code, a user-safe message (no internals),
and an internal detail string for logs. Never surface `internal` to end users.
"""
from dataclasses import dataclass


class ErrorCode:
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE"
    ENCRYPTED_DOCUMENT = "ENCRYPTED_DOCUMENT"
    DUPLICATE_DOCUMENT = "DUPLICATE_DOCUMENT"
    TEXT_EXTRACTION_FAILED = "TEXT_EXTRACTION_FAILED"
    LLM_EXTRACTION_FAILED = "LLM_EXTRACTION_FAILED"
    SCHEMA_VALIDATION_FAILED = "SCHEMA_VALIDATION_FAILED"
    TIMEOUT = "TIMEOUT"
    INTERNAL = "INTERNAL"


# User-safe messages keyed by code (EDIES §18: do not leak internals).
USER_MESSAGE = {
    ErrorCode.VALIDATION_ERROR: "The document failed validation and could not be processed.",
    ErrorCode.UNSUPPORTED_FILE_TYPE: "This file type is not supported. Upload a PDF or DOCX.",
    ErrorCode.ENCRYPTED_DOCUMENT: "Password-protected documents are not supported.",
    ErrorCode.DUPLICATE_DOCUMENT: "This document has already been imported.",
    ErrorCode.TEXT_EXTRACTION_FAILED: "We could not read text from this document (is it a scan?).",
    ErrorCode.LLM_EXTRACTION_FAILED: "Automatic question extraction failed. Please try again.",
    ErrorCode.SCHEMA_VALIDATION_FAILED: "The extracted content did not match the expected format.",
    ErrorCode.TIMEOUT: "Extraction took too long and was stopped.",
    ErrorCode.INTERNAL: "An unexpected error occurred while processing the document.",
}


@dataclass
class ExtractionError(Exception):
    code: str
    internal: str = ""

    @property
    def user_message(self) -> str:
        return USER_MESSAGE.get(self.code, USER_MESSAGE[ErrorCode.INTERNAL])

    def __str__(self) -> str:  # used for internal logs only
        return f"{self.code}: {self.internal}"
