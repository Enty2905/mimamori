import hashlib
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit
from uuid import NAMESPACE_URL, uuid5

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from src.common.errors import IngestionError


class Source(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    key: str = Field(pattern=r"^[a-z][a-z0-9_-]{0,79}$")
    path: str = Field(min_length=1, max_length=240)
    source: str = Field(min_length=1, max_length=1000)
    title: str = Field(min_length=1, max_length=240)
    language: str = Field(pattern=r"^(ja|vi)$")
    version: str = Field(min_length=1, max_length=80)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    approved: bool = Field(strict=True)
    reviewed_by: str = Field(min_length=1, max_length=120)
    reviewed_at: date
    sensitivity_class: str
    content_kind: str

    @field_validator("source")
    @classmethod
    def safe_reference(cls, value: str) -> str:
        parsed = urlsplit(value)
        if parsed.scheme not in {"https", "repo"} or parsed.username or parsed.password:
            raise ValueError("Source must be an HTTPS or repository reference without credentials")
        if not parsed.netloc or parsed.query:
            raise ValueError("Source reference must be canonical and contain no query")
        return value

    @property
    def document_id(self) -> str:
        return str(uuid5(NAMESPACE_URL, f"mimamori:document:{self.key}"))


class Manifest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int = Field(ge=1, le=1)
    sources: list[Source] = Field(min_length=1, max_length=1000)


class SourceRegistry:
    def __init__(self, root: Path, manifest: Path, max_bytes: int = 262144) -> None:
        self.root = root.resolve()
        self.manifest = manifest
        self.max_bytes = max_bytes

    def entries(self) -> dict[str, Source]:
        try:
            with self.manifest.open("rb") as stream:
                raw = stream.read(1048577)
            if len(raw) > 1048576:
                raise ValueError("Manifest too large")
            value = Manifest.model_validate(json.loads(raw))
            entries = {source.key: source for source in value.sources}
            if len(entries) != len(value.sources):
                raise ValueError("Duplicate source key")
            return entries
        except (OSError, ValueError, ValidationError) as error:
            raise IngestionError(
                "INVALID_MANIFEST", "Source registry is unavailable or invalid.", 503
            ) from error

    def source(self, key: str) -> Source:
        value = self.entries().get(key)
        if value is None:
            raise IngestionError("SOURCE_NOT_FOUND", "Source is not registered.", 404)
        return value

    def load(self, key: str) -> tuple[Source, str, str]:
        source = self.source(key)
        if not source.approved or source.reviewed_at > date.today():
            raise IngestionError("SOURCE_NOT_APPROVED", "Source has not been approved.", 403)
        if source.sensitivity_class != "public" or source.content_kind not in {
            "project_knowledge",
            "care_reference",
        }:
            raise IngestionError(
                "SENSITIVE_SOURCE", "Source is not permitted in shared knowledge.", 403
            )
        relative = Path(source.path)
        # Check Windows and POSIX forms even when running on the other platform.
        if (
            relative.is_absolute()
            or ":" in source.path
            or "\\" in source.path
            or ".." in relative.parts
        ):
            raise IngestionError("UNSAFE_PATH", "Source path is outside the approved corpus.", 403)
        target = (self.root / relative).resolve()
        if not target.is_relative_to(self.root) or target.suffix.lower() not in {".md", ".txt"}:
            raise IngestionError("UNSAFE_PATH", "Source path or format is not permitted.", 403)
        try:
            with target.open("rb") as stream:
                raw = stream.read(self.max_bytes + 1)
        except OSError as error:
            raise IngestionError(
                "SOURCE_UNAVAILABLE", "Registered source cannot be read.", 404
            ) from error
        if len(raw) > self.max_bytes:
            raise IngestionError(
                "SOURCE_TOO_LARGE", "Source exceeds the ingestion size limit.", 413
            )
        if hashlib.sha256(raw).hexdigest() != source.sha256:
            raise IngestionError("CHECKSUM_MISMATCH", "Source changed after approval.", 409)
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeError as error:
            raise IngestionError("INVALID_ENCODING", "Source must be valid UTF-8.") from error
        reject_sensitive_text(text)
        return source, text, target.suffix.lower()


# Defense in depth, not a claim of general-purpose PII detection. The reviewed,
# byte-pinned registry is the primary exclusion boundary.
SENSITIVE_PATTERNS = [
    r'"(?:role|conversation_id|patient_id|access_token|refresh_token|api_key)"\s*:',
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}",
    r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    r"\b(?:Bearer\s+[A-Za-z0-9._-]{12,}|gsk_[A-Za-z0-9]{12,}|sk-[A-Za-z0-9]{12,})",
    r"(?im)^\s*(?:patient_id|conversation_id|access_token|refresh_token|api_key)\s*[:=]",
    r"(?im)^\s*(?:user|assistant|patient|患者|利用者|bệnh nhân)\s*:",
    r"(?<!\d)(?:\+81[- ]?|0)(?:70|80|90)[- ]?\d{4}[- ]?\d{4}(?!\d)",
    r"(?<!\d)\+84[- ]?\d(?:[- ]?\d){8,9}(?!\d)",
]


def reject_sensitive_text(text: str) -> None:
    if any(re.search(pattern, text, re.IGNORECASE) for pattern in SENSITIVE_PATTERNS):
        raise IngestionError("SENSITIVE_CONTENT", "Source contains excluded content.", 403)
