import os
from uuid import uuid4

import pytest

from src.common.settings import Settings
from src.ingestion.service import IngestionService


@pytest.mark.model
@pytest.mark.integration
def test_real_multilingual_model_and_qdrant(tmp_path):
    if os.environ.get("RAG_RUN_MODEL_TESTS") != "1" or not os.environ.get("RAG_TEST_QDRANT_URL"):
        pytest.skip("Opt in to real model + Qdrant smoke")
    settings = Settings(
        qdrant_url=os.environ["RAG_TEST_QDRANT_URL"],
        state_dir=tmp_path,
        collection_prefix="spec005_model_" + uuid4().hex[:10],
    )
    service = IngestionService(settings)
    try:
        counts = {}
        client = service.store.client
        for key in ("reminders-ja", "reminders-vi"):
            first = service.ingest(key)
            counts[key] = first.chunk_count
            service.ingest(key)
        records = client.scroll(service.store.collection, limit=1000, with_vectors=True)[0]
        assert len(records) == sum(counts.values())
        assert {record.payload["language"] for record in records} == {"ja", "vi"}
        assert len({record.id for record in records}) == len(records)
        for record in records:
            assert len(record.vector) == settings.embedding_dimension
            assert record.payload["embedding_revision"] == settings.embedding_revision
            assert record.payload["token_count"] <= settings.chunk_max_tokens
            assert record.payload["source"].startswith("repo://mimamori/")
        print(f"Real pinned-model smoke: {counts}; {len(records)} unique traceable vectors.")
    finally:
        if service.store.client.collection_exists(service.store.collection):
            service.store.client.delete_collection(service.store.collection)
        service.store.close()
