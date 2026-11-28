"""Tests verifying PII, JWT, API key, and sensitive health data scrubbing in logs."""

from __future__ import annotations

import logging

from app.core.logging import (
    SensitiveDataScrubbingFilter,
    configure_logging,
    sanitize_log_payload,
    scrub_sensitive_text,
)


def test_scrub_sensitive_text_redacts_secrets_and_pii_but_keeps_115_hotline():
    sample_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjQyfQ.signature12345"
    sample_raw = (
        f"Authorization: Bearer {sample_jwt} "
        f"api_key=gsk_supersecretkey987654321 "
        f"sk-proj-abcdef1234567890 "
        f"email=elderly.user@example.com "
        f"phone=0912345678 "
        f"cccd=079055001234 "
        f"health_notes='Tăng huyết áp nặng' "
        f"gọi cấp cứu 115"
    )
    scrubbed = scrub_sensitive_text(sample_raw)

    assert sample_jwt not in scrubbed
    assert "gsk_supersecretkey987654321" not in scrubbed
    assert "sk-proj-abcdef1234567890" not in scrubbed
    assert "elderly.user@example.com" not in scrubbed
    assert "0912345678" not in scrubbed
    assert "079055001234" not in scrubbed
    assert "Tăng huyết áp nặng" not in scrubbed
    assert "115" in scrubbed  # Official emergency hotline must remain intact


def test_sanitize_log_payload_redacts_health_and_auth_keys():
    sanitized = sanitize_log_payload(
        {
            "risk_level": "low",
            "jwt": "eyJabc.def.ghi",
            "personal_context": {"health_notes": ["Suy tim"], "medication_logs": ["Amlodipine"]},
            "nested": {"phone": "0987654321", "status": "ok"},
        }
    )
    assert sanitized["risk_level"] == "low"
    assert sanitized["jwt"] == "[REDACTED]"
    assert sanitized["personal_context"] == "[REDACTED]"
    assert sanitized["nested"]["phone"] == "[REDACTED]"
    assert sanitized["nested"]["status"] == "ok"


def test_chat_endpoint_never_logs_user_message_health_notes_or_medications(app_client):
    captured_records: list[str] = []

    class MemoryHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured_records.append(self.format(record))

    logger = configure_logging("INFO")
    mem_handler = MemoryHandler()
    mem_handler.addFilter(SensitiveDataScrubbingFilter())
    logger.addHandler(mem_handler)

    try:
        # Also simulate an accidental raw JWT/API key log through the service logger
        logger.info(
            "Debug header Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig123456 key=gsk_testsecret999"
        )

        resp = app_client.post(
            "/api/v1/companion/chat",
            json={
                "conversation_id": "conv-privacy-1",
                "message": "Bí mật riêng tư: hôm nay bác uống thuốc huyết áp chưa?",
                "personal_context": {
                    "preferred_honorific": "bác",
                    "medication_logs": [
                        {
                            "medication_name": "SecretMedLosartan50",
                            "status": "PENDING",
                        }
                    ],
                    "daily_checkin": {
                        "mood": "TIRED",
                        "notes": "PrivateCheckinInsomniaNote",
                        "concerning_flag": True,
                    },
                    "health_notes": ["PrivateConditionArrhythmia"],
                },
            },
        )
        assert resp.status_code == 200
    finally:
        logger.removeHandler(mem_handler)

    joined_logs = "\n".join(captured_records)
    assert "eyJhbGciOiJIUzI1NiJ9" not in joined_logs
    assert "gsk_testsecret999" not in joined_logs
    assert "Bí mật riêng tư" not in joined_logs
    assert "SecretMedLosartan50" not in joined_logs
    assert "PrivateCheckinInsomniaNote" not in joined_logs
    assert "PrivateConditionArrhythmia" not in joined_logs
