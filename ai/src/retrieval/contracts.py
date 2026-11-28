from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Language = Literal["ja", "vi"]
Reason = Literal[
    "NONE",
    "NO_MATCH",
    "LOW_CONFIDENCE",
    "UNAVAILABLE",
    "BUSY",
    "QUERY_TOO_LONG",
    "INVALID_INDEX",
    "BUDGET_EXHAUSTED",
]
SourceKey = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_-]{0,79}$")]


class RetrievalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    query: str = Field(min_length=1, max_length=1024, repr=False)
    language: Language
    top_k: int = Field(default=3, ge=1, le=8, strict=True)
    max_context_tokens: int = Field(default=384, ge=32, le=1024, strict=True)
    source_ids: list[SourceKey] = Field(default_factory=list, max_length=20)
    document_ids: list[UUID] = Field(default_factory=list, max_length=20)


class RetrievedChunk(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chunk_id: UUID
    document_id: UUID
    source_id: SourceKey
    source: str = Field(min_length=1, max_length=1000)
    title: str = Field(min_length=1, max_length=240)
    section: str = Field(min_length=1, max_length=512)
    language: Language
    version: str = Field(min_length=1, max_length=80)
    ingestion_timestamp: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1, max_length=16384, repr=False)
    score: float = Field(ge=-1.001, le=1.001, allow_inf_nan=False)
    token_count: int = Field(ge=1, le=4096)
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class RetrievalResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: Literal[1] = 1
    status: Literal["context", "no_context"]
    reason: Reason
    pipeline_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    context_tokens: int = Field(ge=0, le=1024)
    chunks: list[RetrievedChunk] = Field(default_factory=list, max_length=8)

    @classmethod
    def empty(cls, pipeline: str, reason: Reason) -> "RetrievalResponse":
        return cls(status="no_context", reason=reason, pipeline_id=pipeline, context_tokens=0)
