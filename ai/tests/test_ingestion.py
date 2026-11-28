from unittest.mock import MagicMock

import pytest
from filelock import FileLock
from qdrant_client import QdrantClient, models

from src.common.errors import IngestionError
from src.ingestion.service import IngestionService
from src.ingestion.vector_store import VectorStore
from tests.conftest import FakeEncoder


def local_service(settings, path=":memory:"):
    store = VectorStore(
        settings, QdrantClient(path) if path == ":memory:" else QdrantClient(path=path)
    )
    return IngestionService(settings, FakeEncoder(), store)


def points(service):
    return service.store.client.scroll(
        service.store.collection, limit=1000, with_payload=True, with_vectors=True
    )[0]


def test_repeat_update_cleanup_metadata_and_purge(corpus):
    settings, register = corpus
    register("# First\n" + "nội dung dự án " * 20 + "\n## Second\n予定を確認します。")
    service = local_service(settings)
    first = service.ingest("sample")
    before = points(service)
    service.ingest("sample")
    after = points(service)
    assert {point.id for point in before} == {point.id for point in after}
    assert len(after) == first.chunk_count
    for point in after:
        payload = point.payload
        for field in (
            "document_id",
            "source",
            "title",
            "section",
            "language",
            "version",
            "ingestion_timestamp",
            "sensitivity_class",
            "embedding_model",
            "embedding_revision",
            "chunking",
            "pipeline_id",
            "reviewed_by",
            "source_sha256",
            "content_sha256",
            "line_start",
            "line_end",
        ):
            assert payload[field]
        assert payload["token_count"] <= settings.chunk_max_tokens
        assert len(point.vector) == 3
    register("# Updated\nShort approved text.", version="2")
    second = service.ingest("sample")
    updated = points(service)
    assert second.document_id == first.document_id
    assert len(updated) == second.chunk_count < len(before)
    assert {point.id for point in before}.isdisjoint(point.id for point in updated)
    service.purge("sample")
    assert points(service) == []
    service.purge("sample")
    service.store.close()


def test_persistent_store_reopen(corpus, tmp_path):
    settings, _ = corpus
    path = str(tmp_path / "qdrant")
    service = local_service(settings, path)
    result = service.ingest("sample")
    ids = {point.id for point in points(service)}
    service.store.close()
    restored = local_service(settings, path)
    assert {point.id for point in points(restored)} == ids
    restored.ingest("sample")
    assert len(points(restored)) == result.chunk_count
    restored.store.close()


def test_rejection_and_embedding_failure_do_not_touch_index(corpus):
    settings, register = corpus
    encoder = FakeEncoder()
    store = MagicMock(spec=VectorStore)
    service = IngestionService(settings, encoder, store)
    register(approved=False)
    with pytest.raises(IngestionError, match="SOURCE_NOT_APPROVED"):
        service.ingest("sample")
    assert encoder.calls == 0
    store.ensure_collection.assert_not_called()
    register()
    encoder.encode = MagicMock(side_effect=IngestionError("EMBEDDING_FAILED", "Unavailable", 503))
    with pytest.raises(IngestionError, match="EMBEDDING_FAILED"):
        service.ingest("sample")
    store.ensure_collection.assert_not_called()
    store.replace_document.assert_not_called()


def test_failed_upsert_never_deletes_existing_points(corpus):
    settings, _ = corpus
    client = MagicMock(spec=QdrantClient)
    client.upsert.side_effect = RuntimeError("private upstream content")
    store = VectorStore(settings, client)
    with pytest.raises(IngestionError, match="INDEX_UNAVAILABLE"):
        store.replace_document(
            "doc",
            [models.PointStruct(id="018d9d72-30c0-728a-8c8f-4374ca690001", vector=[1.0, 0.0, 0.0])],
        )
    client.delete.assert_not_called()


def test_single_writer_busy(corpus):
    settings, _ = corpus
    service = IngestionService(settings, FakeEncoder(), MagicMock(spec=VectorStore))
    settings.state_dir.mkdir()
    with FileLock(settings.state_dir / "ingestion.lock"):
        with pytest.raises(IngestionError, match="INGESTION_BUSY"):
            service.ingest("sample")


def test_index_mismatch_is_rejected_and_new_pipeline_is_separate(corpus):
    settings, _ = corpus
    service = local_service(settings)
    service.store.client.create_collection(
        service.store.collection,
        vectors_config=models.VectorParams(size=4, distance=models.Distance.COSINE),
    )
    with pytest.raises(IngestionError, match="INDEX_CONFIG_MISMATCH"):
        service.ingest("sample")
    old_name = service.store.collection
    settings.embedding_revision = "a" * 40
    assert settings.collection_name != old_name
    service.store.close()
