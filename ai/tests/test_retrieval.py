import json
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from filelock import FileLock
from qdrant_client import models

from src.api.main import create_app
from src.retrieval.contracts import RetrievalRequest, RetrievalResponse
from src.retrieval.service import RetrievalService
from tests.test_ingestion import local_service


def request(**values):
    return RetrievalRequest(query="Guide", language="vi", **values)


def test_ranked_bounded_traceable_context(corpus):
    settings, register = corpus
    register("# First\nSafe instructions.\n## Second\nMore instructions.")
    engine = local_service(settings)
    engine.ingest("sample")
    response = RetrievalService(engine).retrieve(request(top_k=2, max_context_tokens=32))
    assert response.status == "context" and response.reason == "NONE"
    assert 0 < response.context_tokens <= 32
    assert len(response.chunks) <= 2
    assert all(chunk.source_id == "sample" and chunk.section for chunk in response.chunks)
    assert len({chunk.chunk_id for chunk in response.chunks}) == len(response.chunks)
    assert response == RetrievalService(engine).retrieve(request(top_k=2, max_context_tokens=32))
    engine.store.close()


@pytest.mark.parametrize(
    "changes",
    [
        {"approved": False},
        {"version": "2"},
        {"sha256": "0" * 64},
        {"language": "ja"},
        {"sensitivity_class": "private"},
        {"content_kind": "conversation"},
    ],
)
def test_revoked_stale_or_sensitive_source_is_never_returned(corpus, changes):
    settings, register = corpus
    engine = local_service(settings)
    engine.ingest("sample")
    register(**changes)
    response = RetrievalService(engine).retrieve(request())
    assert response.status == "no_context" and response.chunks == []
    engine.store.close()


def test_filters_missing_index_low_score_busy_and_failure(corpus):
    settings, _ = corpus
    engine = local_service(settings)
    retrieval = RetrievalService(engine)
    assert retrieval.retrieve(request()).reason == "NO_MATCH"
    engine.ingest("sample")
    assert retrieval.retrieve(request(source_ids=["other"])).reason == "NO_MATCH"
    assert retrieval.retrieve(request(document_ids=[uuid4()])).reason == "NO_MATCH"
    assert (
        retrieval.retrieve(RetrievalRequest(query="x" * 33, language="vi")).reason
        == "QUERY_TOO_LONG"
    )
    engine.encoder.encode = lambda texts: [[0.0, 1.0, 0.0] for _ in texts]
    assert retrieval.retrieve(request()).reason == "LOW_CONFIDENCE"
    with FileLock(settings.state_dir / "ingestion.lock"):
        assert retrieval.retrieve(request()).reason == "BUSY"
    engine.store.client.query_points = MagicMock(side_effect=RuntimeError("secret details"))
    assert retrieval.retrieve(request()).reason == "UNAVAILABLE"
    engine.store.close()


def test_invalid_payload_and_index_fail_closed(corpus):
    settings, _ = corpus
    engine = local_service(settings)
    engine.ingest("sample")
    engine.store.client.set_payload(engine.store.collection, {"text": "tampered"}, models.Filter())
    assert RetrievalService(engine).retrieve(request()).reason == "INVALID_INDEX"
    engine.store.close()


def test_budget_exhaustion_preserves_whole_chunks_and_filters(corpus):
    settings, register = corpus
    settings = settings.model_copy(update={"chunk_max_tokens": 96})
    register("# Guide\n" + "Safe instructions. " * 3)
    engine = local_service(settings)
    try:
        document = engine.ingest("sample")
        retrieval = RetrievalService(engine)
        filters = {"source_ids": ["sample"], "document_ids": [document.document_id]}
        assert (
            retrieval.retrieve(request(max_context_tokens=32, **filters)).reason
            == "BUDGET_EXHAUSTED"
        )
        result = retrieval.retrieve(request(max_context_tokens=96, **filters))
        assert result.status == "context"
        assert all(str(chunk.document_id) == document.document_id for chunk in result.chunks)
    finally:
        engine.store.close()


def test_incompatible_vector_configuration_is_rejected_before_embedding(corpus):
    settings, _ = corpus
    engine = local_service(settings)
    try:
        engine.store.client.create_collection(
            engine.store.collection,
            vectors_config=models.VectorParams(size=4, distance=models.Distance.COSINE),
        )
        assert RetrievalService(engine).retrieve(request()).reason == "INVALID_INDEX"
        assert engine.encoder.calls == 0
    finally:
        engine.store.close()


def test_api_auth_validation_privacy_and_contract(corpus):
    settings, _ = corpus
    engine = local_service(settings)
    engine.ingest("sample")
    with TestClient(create_app(settings, engine)) as client:
        route = "/internal/v1/retrievals"
        body = {"query": "Guide", "language": "vi"}
        assert client.post(route, content=b"x" * 16385).status_code == 413
        headers = {"X-Internal-Token": settings.internal_token.get_secret_value()}
        assert client.post(route, json=body).status_code == 401
        for invalid in [
            {"query": "", "language": "vi"},
            {"query": "x" * 1025, "language": "vi"},
            {**body, "top_k": 9},
            {**body, "max_context_tokens": 1025},
            {**body, "language": "en"},
            {**body, "source_ids": ["../secret"]},
            {**body, "arbitrary_filter": {"sensitivity_class": "private"}},
        ]:
            response = client.post(route, json=invalid, headers=headers)
            assert response.status_code == 422
            assert "secret" not in response.text and "input" not in response.text
        response = client.post(route, json=body, headers=headers)
        result = RetrievalResponse.model_validate(response.json())
        assert response.status_code == 200 and result.status == "context"
        assert "query" not in response.json()
        assert "Guide" not in repr(RetrievalRequest(**body))
        assert json.loads(result.model_dump_json())["schema_version"] == 1
