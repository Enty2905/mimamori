"""Privacy-preserving structured logging with PII, JWT, and secret scrubbing."""

from __future__ import annotations

import logging
import re
from typing import Any

# Patterns scrubbed from every log message and exception trace.
_JWT_PATTERN = re.compile(r"\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b")
_BEARER_PATTERN = re.compile(r"(?i)\b(bearer|authorization)\s*[:=]?\s*[A-Za-z0-9._~+/=-]{8,}")
_KNOWN_API_KEY_PATTERN = re.compile(
    r"\b(?:gsk|sk|hf|pk|rk|xoxb|xoxp|ghp|gho)_[A-Za-z0-9_-]{6,}\b|\bsk-[A-Za-z0-9_-]{8,}\b|\bAIza[0-9A-Za-z_-]{12,}\b"
)
_SECRET_KV_PATTERN = re.compile(
    r"(?i)\b(api[_-]?key|secret|password|passwd|token|authorization|jwt)\b\s*([:=])\s*['\"]?([^\s,'\";\}]+)['\"]?"
)
_EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
# Matches Vietnamese mobile/landline numbers (10-11 digits starting with 0 or +84), never short hotlines like 115.
_VN_PHONE_PATTERN = re.compile(
    r"(?<!\d)(?:\+?84[\s.-]?|0)(?:3|5|7|8|9)\d(?:[\s.-]?\d){7,8}(?!\d)"
)
_CITIZEN_ID_PATTERN = re.compile(r"(?<!\d)\d{12}(?!\d)|(?<!\d)\d{9}(?!\d)")
_HEALTH_FIELD_KV_PATTERN = re.compile(
    r"(?i)\b(health_notes|medication_schedules|medication_logs|daily_checkin|recent_messages|personal_context|symptoms_or_notes|doctor_or_clinic|user_message|raw_message)\b\s*([:=])\s*(\{[^}]*\}|\[[^\]]*\]|'[^']*'|\"[^\"]*\"|\S+)"
)

SENSITIVE_PAYLOAD_KEYS = frozenset(
    {
        "authorization",
        "jwt",
        "token",
        "api_key",
        "llm_api_key",
        "secret",
        "password",
        "password_hash",
        "email",
        "phone",
        "emergency_contact",
        "citizen_id",
        "cccd",
        "cmnd",
        "personal_context",
        "health_notes",
        "medication_schedules",
        "medication_logs",
        "daily_checkin",
        "recent_messages",
        "doctor_or_clinic",
        "symptoms_or_notes",
        "message",
        "reply",
    }
)


def scrub_sensitive_text(text: str) -> str:
    """Redact JWTs, bearer tokens, API keys, PII, and raw health fields from text."""
    if not text:
        return text
    cleaned = _JWT_PATTERN.sub("[REDACTED_JWT]", text)
    cleaned = _BEARER_PATTERN.sub("[REDACTED_AUTH]", cleaned)
    cleaned = _KNOWN_API_KEY_PATTERN.sub("[REDACTED_API_KEY]", cleaned)
    cleaned = _SECRET_KV_PATTERN.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED_SECRET]", cleaned)
    cleaned = _HEALTH_FIELD_KV_PATTERN.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED_HEALTH_DATA]", cleaned)
    cleaned = _EMAIL_PATTERN.sub("[REDACTED_EMAIL]", cleaned)
    cleaned = _VN_PHONE_PATTERN.sub("[REDACTED_PHONE]", cleaned)
    cleaned = _CITIZEN_ID_PATTERN.sub("[REDACTED_ID]", cleaned)
    return cleaned


def sanitize_log_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of a dict safe for structured metadata logging."""
    safe: dict[str, Any] = {}
    for key, value in payload.items():
        if key.lower() in SENSITIVE_PAYLOAD_KEYS:
            safe[key] = "[REDACTED]"
        elif isinstance(value, dict):
            safe[key] = sanitize_log_payload(value)
        elif isinstance(value, str):
            safe[key] = scrub_sensitive_text(value)
        else:
            safe[key] = value
    return safe


class SensitiveDataScrubbingFilter(logging.Filter):
    """Logging filter that guarantees secrets, JWTs, PII, and health payloads are scrubbed."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            rendered = record.getMessage()
            scrubbed = scrub_sensitive_text(rendered)
            record.msg = scrubbed
            record.args = ()
            if record.exc_info and record.exc_info[1] is not None:
                # Avoid leaking secret tokens inside formatted exception text via exc_text
                if record.exc_text:
                    record.exc_text = scrub_sensitive_text(record.exc_text)
        except Exception:
            record.msg = "[LOG_SCRUB_FALLBACK]"
            record.args = ()
        return True


def configure_logging(level: str = "INFO") -> logging.Logger:
    """Configure root/service loggers with the sensitive-data scrubbing filter."""
    resolved_level = getattr(logging, level.upper(), logging.INFO)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    scrub_filter = SensitiveDataScrubbingFilter()

    app_logger = logging.getLogger("mimamori.ai_service")
    app_logger.setLevel(resolved_level)
    app_logger.propagate = False
    if not any(isinstance(f, SensitiveDataScrubbingFilter) for f in app_logger.filters):
        app_logger.addFilter(scrub_filter)

    if not app_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)
        handler.addFilter(scrub_filter)
        app_logger.addHandler(handler)
    else:
        for handler in app_logger.handlers:
            handler.setFormatter(formatter)
            if not any(isinstance(f, SensitiveDataScrubbingFilter) for f in handler.filters):
                handler.addFilter(scrub_filter)

    # Also protect uvicorn / httpx loggers from leaking auth headers or URLs with tokens
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access", "httpx", "httpcore"):
        ext_logger = logging.getLogger(logger_name)
        for handler in ext_logger.handlers:
            if not any(isinstance(f, SensitiveDataScrubbingFilter) for f in handler.filters):
                handler.addFilter(scrub_filter)

    return app_logger


def get_logger(name: str = "mimamori.ai_service") -> logging.Logger:
    """Return a child logger inheriting the privacy-safe scrubbing configuration."""
    base = logging.getLogger("mimamori.ai_service")
    if not base.handlers:
        configure_logging()
    if name == "mimamori.ai_service":
        return base
    child = logging.getLogger(name)
    child.parent = base
    return child
