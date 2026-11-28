import os
from uuid import uuid4

import pytest

from src.ingestion.service import IngestionService
from src.ingestion.vector_store import VectorStore
from tests.conftest import FakeEncoder


@pytest.mark.integration
def test_real_qdrant_repeat_update_filter_and_purge(corpus):
    url = os.environ.get("RAG_TEST_QDRANT_URL")
    if not url:
        pytest.skip("Set RAG_TEST_QDRANT_URL to run real Qdrant integration")
    settings, register = corpus
    settings.qdrant_url = url
    settings.collection_prefix = "spec005_test_" + uuid4().hex[:10]
    service = IngestionService(settings, FakeEncoder(), VectorStore(settings))
    try:
        register("# Trace\n" + "Approved engineering sample. " * 20)
        first = service.ingest("sample")
        client, collection = service.store.client, service.store.collection
        first_ids = {point.id for point in client.scroll(collection, limit=1000)[0]}
        service.ingest("sample")
        assert client.count(collection, exact=True).count == first.chunk_count
        assert {point.id for point in client.scroll(collection, limit=1000)[0]} == first_ids
        register("# Trace\nShort new version.", version="2")
        result = service.ingest("sample")
        assert client.count(collection, exact=True).count == result.chunk_count
        assert result.chunk_count < first.chunk_count
        payloads = client.scroll(collection, limit=1000)[0]
        assert all(point.payload["version"] == "2" for point in payloads)
        service.purge("sample")
        assert client.count(collection, exact=True).count == 0
    finally:
        if service.store.client.collection_exists(service.store.collection):
            service.store.client.delete_collection(service.store.collection)
        service.store.close()
