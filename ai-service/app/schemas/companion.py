"""Pydantic schemas enforcing minimal Spring Boot context and structured responses."""

from __future__ import annotations

import re
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

KnowledgeCategory = Literal[
    "elderly_care",
    "general_health",
    "medication_safety",
    "app_usage",
    "emergency_guidance",
]

RiskLevel = Literal["low", "moderate", "high", "critical"]

_PII_REJECT_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("JWT token", re.compile(r"\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b")),
    ("API key", re.compile(r"\b(?:gsk|sk|hf)_[A-Za-z0-9_-]{6,}\b|\bsk-[A-Za-z0-9_-]{8,}\b")),
    ("email address", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    ("phone number", re.compile(r"(?<!\d)(?:\+?84[\s.-]?|0)(?:3|5|7|8|9)\d(?:[\s.-]?\d){7,8}(?!\d)")),
    ("citizen ID", re.compile(r"(?<!\d)\d{12}(?!\d)|(?<!\d)\d{9}(?!\d)")),
)


def _assert_no_raw_pii_or_secret(value: Optional[str], field_name: str) -> Optional[str]:
    if value is None:
        return None
    for label, pattern in _PII_REJECT_PATTERNS:
        if pattern.search(value):
            raise ValueError(f"{field_name} must not contain sensitive {label} data")
    return value


class MedicationScheduleContext(BaseModel):
    """Minimal scheduled medication summary passed by Spring Boot (no DB IDs/PII)."""

    model_config = ConfigDict(extra="forbid")

    medication_name: str = Field(..., min_length=1, max_length=120)
    dosage_amount: Optional[str] = Field(default=None, max_length=80)
    reminder_time: Optional[str] = Field(default=None, max_length=32)
    days_of_week: Optional[str] = Field(default=None, max_length=40)
    instructions: Optional[str] = Field(default=None, max_length=200)

    @field_validator("medication_name", "dosage_amount", "instructions")
    @classmethod
    def validate_safe_text(cls, value: Optional[str], info) -> Optional[str]:
        return _assert_no_raw_pii_or_secret(value, info.field_name)


class MedicationLogContext(BaseModel):
    """Minimal medication adherence status record from Spring Boot."""

    model_config = ConfigDict(extra="forbid")

    medication_name: str = Field(..., min_length=1, max_length=120)
    scheduled_time: Optional[str] = Field(default=None, max_length=64)
    taken_time: Optional[str] = Field(default=None, max_length=64)
    status: Literal["PENDING", "TAKEN", "MISSED", "SKIPPED"]
    notes: Optional[str] = Field(default=None, max_length=200)

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip().upper()
        return value

    @field_validator("medication_name", "notes")
    @classmethod
    def validate_safe_text(cls, value: Optional[str], info) -> Optional[str]:
        return _assert_no_raw_pii_or_secret(value, info.field_name)


class DailyCheckInContext(BaseModel):
    """Minimal summary of today's daily check-in."""

    model_config = ConfigDict(extra="forbid")

    checkin_date: Optional[str] = Field(default=None, max_length=32)
    mood: Optional[str] = Field(default=None, max_length=40)
    physical_health: Optional[str] = Field(default=None, max_length=40)
    sleep_quality: Optional[str] = Field(default=None, max_length=40)
    appetite: Optional[str] = Field(default=None, max_length=40)
    concerning_flag: bool = False
    notes: Optional[str] = Field(default=None, max_length=250)

    @field_validator("notes")
    @classmethod
    def validate_safe_notes(cls, value: Optional[str]) -> Optional[str]:
        return _assert_no_raw_pii_or_secret(value, "daily_checkin.notes")


class RecentMessageContext(BaseModel):
    """Recent conversation turn bounded to short non-identifying history."""

    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1, max_length=600)
    timestamp: Optional[str] = Field(default=None, max_length=64)

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        normalized = value.strip().lower()
        if normalized in {"ai", "assistant", "model"}:
            return "assistant"
        if normalized == "user":
            return "user"
        if normalized == "system":
            return "system"
        return normalized

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("recent_messages.content must not be blank")
        _assert_no_raw_pii_or_secret(cleaned, "recent_messages.content")
        return cleaned


class HealthNoteContext(BaseModel):
    """De-identified health condition summary (no clinic, doctor, or PII)."""

    model_config = ConfigDict(extra="forbid")

    condition_name: Optional[str] = Field(default=None, max_length=120)
    status: Optional[str] = Field(default=None, max_length=40)
    severity: Optional[str] = Field(default=None, max_length=40)
    summary: str = Field(..., min_length=1, max_length=250)

    @field_validator("condition_name", "summary")
    @classmethod
    def validate_safe_text(cls, value: Optional[str], info) -> Optional[str]:
        return _assert_no_raw_pii_or_secret(value, info.field_name)


class PersonalContextPayload(BaseModel):
    """Minimal, non-PII personal context provided by Spring Boot orchestrator.

    Rejects unexpected fields (such as email, phone, citizen IDs, or credentials)
    to keep user PII strictly out of the standalone AI microservice.
    """

    model_config = ConfigDict(extra="forbid")

    preferred_honorific: Optional[str] = Field(default=None, max_length=24)
    medication_schedules: Optional[list[MedicationScheduleContext]] = Field(default=None, max_length=10)
    medication_logs: Optional[list[MedicationLogContext]] = Field(default=None, max_length=15)
    daily_checkin: Optional[DailyCheckInContext] = None
    recent_messages: Optional[list[RecentMessageContext]] = Field(default=None, max_length=6)
    health_notes: Optional[list[HealthNoteContext | str]] = Field(default=None, max_length=10)

    @field_validator("preferred_honorific")
    @classmethod
    def validate_honorific(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        _assert_no_raw_pii_or_secret(cleaned, "preferred_honorific")
        return cleaned or None

    @field_validator("health_notes")
    @classmethod
    def validate_health_notes(
        cls, value: Optional[list[HealthNoteContext | str]]
    ) -> Optional[list[HealthNoteContext | str]]:
        if value is None:
            return None
        validated: list[HealthNoteContext | str] = []
        for item in value:
            if isinstance(item, str):
                cleaned = item.strip()
                if not cleaned:
                    raise ValueError("health_notes entries must not be blank")
                if len(cleaned) > 250:
                    raise ValueError("health_notes string entries must be <= 250 characters")
                _assert_no_raw_pii_or_secret(cleaned, "health_notes")
                validated.append(cleaned)
            else:
                validated.append(item)
        return validated


class CompanionChatRequest(BaseModel):
    """Request payload for Companion AI chat endpoint."""

    model_config = ConfigDict(extra="forbid")

    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = Field(default=None, max_length=64)
    personal_context: Optional[PersonalContextPayload] = None
    category_hint: Optional[KnowledgeCategory] = None
    top_k: int = Field(default=3, ge=1, le=8)
    include_general_knowledge: bool = True

    @field_validator("message")
    @classmethod
    def validate_non_blank_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("message must not be blank or whitespace only")
        return cleaned

    @field_validator("conversation_id")
    @classmethod
    def validate_conversation_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        _assert_no_raw_pii_or_secret(cleaned, "conversation_id")
        return cleaned or None


class EvidenceSource(BaseModel):
    """Metadata and excerpt for a retrieved RAG document."""

    doc_id: str
    title: str
    category: KnowledgeCategory
    source: str
    updated_date: str
    version: str
    review_status: str
    score: float = Field(ge=0.0, le=1.0)
    excerpt: str


class CompanionChatResponse(BaseModel):
    """Structured Companion AI response including safety and evidence provenance."""

    reply: str
    safety_triggered: bool
    risk_level: RiskLevel
    escalation_guidance: Optional[str] = None
    evidence_sources: list[EvidenceSource] = Field(default_factory=list)
    uncertainty_note: Optional[str] = None
    knowledge_boundary: str
    provider: str
    guardrail_flags: list[str] = Field(default_factory=list)
    used_personal_context: bool = False


class HealthResponse(BaseModel):
    """Liveness response for GET /health."""

    status: Literal["ok"]
    service: str
    version: str
    port: int


class CompanionStatusResponse(BaseModel):
    """Operational readiness & RAG configuration status for GET /api/v1/companion/status."""

    status: Literal["ready", "degraded"]
    service: str
    version: str
    embedding_provider: str
    embedding_model_name: str
    model_provider: str
    model_provider_configured: bool
    chroma_persist_dir: str
    collection_name: str
    indexed_documents: int
    categories: list[KnowledgeCategory]
    safety_layer_active: bool


class ErrorResponse(BaseModel):
    """Structured JSON error payload."""

    error: str
    message: str
    details: Optional[list[dict[str, str]]] = None
