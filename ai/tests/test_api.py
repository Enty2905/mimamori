from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from src.api.main import create_app
from src.common.errors import IngestionError
from src.common.settings import Settings
from src.ingestion.service import IngestionService


def test_liveness_without_credentials_and_internal_auth_fail_closed():
    service = MagicMock(spec=IngestionService)
    client = TestClient(create_app(Settings(internal_token=None), service))
    assert client.get("/health/live").json() == {"status": "ok"}
    assert client.get("/health/ready").status_code == 503
    assert client.post("/internal/v1/ingestions/sample").status_code == 503
    service.ingest.assert_not_called()


def test_auth_invalid_input_and_sanitized_errors(corpus):
    settings, _ = corpus
    service = MagicMock(spec=IngestionService)
    client = TestClient(create_app(settings, service))
    headers = {"X-Internal-Token": settings.internal_token.get_secret_value()}
    assert client.post("/internal/v1/ingestions/sample").status_code == 401
    assert (
        client.post(
            "/internal/v1/ingestions/sample", headers={"X-Internal-Token": "wrong"}
        ).status_code
        == 401
    )
    invalid = client.post("/internal/v1/ingestions/SECRET-RAW", headers=headers)
    assert invalid.status_code == 422 and "SECRET-RAW" not in invalid.text
    service.ingest.side_effect = IngestionError(
        "INDEX_UNAVAILABLE", "Vector index is unavailable.", 503
    )
    assert client.post("/internal/v1/ingestions/sample", headers=headers).status_code == 503
    service.ingest.side_effect = RuntimeError("NEVER expose confidential text")
    failed = client.post("/internal/v1/ingestions/sample", headers=headers)
    assert failed.status_code == 500 and "confidential" not in failed.text
    assert set(failed.json()) == {"code", "message", "timestamp"}


def test_ingest_purge_and_readiness(corpus):
    settings, _ = corpus
    service = MagicMock(spec=IngestionService)
    service.store = MagicMock()
    service.ingest.return_value = {
        "document_id": "doc",
        "source_id": "sample",
        "collection": "collection",
        "pipeline_id": "fingerprint",
        "chunk_count": 2,
        "source_sha256": "a" * 64,
    }
    service.purge.return_value = "doc"
    client = TestClient(create_app(settings, service))
    headers = {"X-Internal-Token": settings.internal_token.get_secret_value()}
    assert client.get("/health/ready", headers=headers).json() == {"status": "ready"}
    response = client.post("/internal/v1/ingestions/sample", headers=headers)
    assert response.status_code == 200 and response.json()["chunk_count"] == 2
    assert (
        client.delete("/internal/v1/ingestions/sample", headers=headers).json()["status"]
        == "purged"
    )
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
