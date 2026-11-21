"""Tests for FastAPI endpoints (/health, /status, /chat) and minimal schema validation."""

from __future__ import annotations

from app.core.config import Settings


def test_default_settings_bind_port_8001_and_no_hardcoded_secrets():
    cfg = Settings(_env_file=None)
    assert cfg.host == "127.0.0.1"
    assert cfg.port == 8001
    assert cfg.llm_api_key is None
    assert cfg.service_auth_token is None
    assert cfg.embedding_provider == "hash_dev"


def test_health_endpoint(app_client):
    resp = app_client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["port"] == 8001
    assert "Mimamori" in body["service"]


def test_status_endpoint(app_client):
    resp = app_client.get("/api/v1/companion/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert body["embedding_provider"] == "hash_dev"
    assert body["model_provider"] == "mock_companion_provider"
    assert body["model_provider_configured"] is True
    assert body["indexed_documents"] >= 14
    assert body["safety_layer_active"] is True
    assert set(body["categories"]) == {
        "elderly_care",
        "general_health",
        "medication_safety",
        "app_usage",
        "emergency_guidance",
    }


def test_chat_endpoint_with_minimal_personal_context(app_client):
    payload = {
        "conversation_id": "conv-123",
        "message": "Làm sao để ngủ ngon hơn vào buổi tối?",
        "personal_context": {
            "preferred_honorific": "bác",
            "medication_schedules": [
                {
                    "medication_name": "Amlodipine 5mg",
                    "dosage_amount": "1 viên",
                    "reminder_time": "08:00",
                    "days_of_week": "DAILY",
                }
            ],
            "medication_logs": [
                {
                    "medication_name": "Amlodipine 5mg",
                    "scheduled_time": "2026-11-21T08:00:00",
                    "status": "TAKEN",
                }
            ],
            "daily_checkin": {
                "checkin_date": "2026-11-21",
                "mood": "GOOD",
                "physical_health": "NORMAL",
                "sleep_quality": "FAIR",
                "concerning_flag": False,
            },
            "recent_messages": [
                {"role": "USER", "content": "Chào cháu buổi sáng"},
                {"role": "AI", "content": "Cháu chào bác ạ"},
            ],
            "health_notes": [
                {
                    "condition_name": "Tăng huyết áp nhẹ",
                    "status": "STABLE",
                    "severity": "MILD",
                    "summary": "Theo dõi huyết áp định kỳ",
                }
            ],
        },
    }
    resp = app_client.post("/api/v1/companion/chat", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["safety_triggered"] is False
    assert body["risk_level"] == "low"
    assert body["used_personal_context"] is True
    assert body["provider"] == "mock_companion_provider"
    assert body["knowledge_boundary"] == "retrieved_evidence"
    assert len(body["evidence_sources"]) >= 1
    assert "bác" in body["reply"].lower()


def test_chat_validation_errors_reject_blank_and_extra_pii_fields(app_client):
    # 1) Whitespace-only message
    r_blank = app_client.post("/api/v1/companion/chat", json={"message": "   \n  "})
    assert r_blank.status_code == 422
    assert r_blank.json()["error"] == "validation_error"

    # 2) Unexpected PII fields in PersonalContextPayload must be rejected
    r_extra = app_client.post(
        "/api/v1/companion/chat",
        json={
            "message": "Chào cháu",
            "personal_context": {
                "preferred_honorific": "bác",
                "email": "bac@example.com",
                "phone": "0912345678",
            },
        },
    )
    assert r_extra.status_code == 422
    assert r_extra.json()["error"] == "validation_error"

    # 3) Raw JWT or phone inside health_notes must be rejected
    r_pii_value = app_client.post(
        "/api/v1/companion/chat",
        json={
            "message": "Chào cháu",
            "personal_context": {
                "health_notes": ["Liên hệ số 0912345678 khi cần"],
            },
        },
    )
    assert r_pii_value.status_code == 422

    # 4) More than 6 recent_messages violates bounded minimal context
    r_too_many_msgs = app_client.post(
        "/api/v1/companion/chat",
        json={
            "message": "Chào cháu",
            "personal_context": {
                "recent_messages": [{"role": "user", "content": f"Tin {i}"} for i in range(7)]
            },
        },
    )
    assert r_too_many_msgs.status_code == 422
