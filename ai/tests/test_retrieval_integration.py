import json
import os
from uuid import uuid4

import pytest

from src.common.settings import Settings
from src.evaluation.retrieval import CASES, evaluate
from src.ingestion.service import IngestionService
from src.retrieval.contracts import RetrievalRequest
from src.retrieval.service import RetrievalService


@pytest.mark.integration
@pytest.mark.model
def test_real_retrieval_and_frozen_evaluation(tmp_path):
    if os.environ.get("RAG_RUN_MODEL_TESTS") != "1" or not os.environ.get("RAG_TEST_QDRANT_URL"):
        pytest.skip("Opt in to real model and Qdrant retrieval")
    settings = Settings(
        qdrant_url=os.environ["RAG_TEST_QDRANT_URL"],
        state_dir=tmp_path,
        collection_prefix="spec006_test_" + uuid4().hex[:10],
    )
    engine = IngestionService(settings)
    try:
        for key in ("reminders-ja", "reminders-vi"):
            engine.ingest(key)
        count = engine.store.client.count(engine.store.collection).count
        service = RetrievalService(engine)
        cases = json.loads(CASES.read_text(encoding="utf-8"))["cases"]
        report = evaluate(service, cases, 3)
        assert report["answerable_count"] == 10 and report["unanswerable_count"] == 4
        # Deliberately modest engineering smoke floor, not a clinical quality claim.
        assert report["hit_at_k"] >= 0.6
        for language, query in [
            ("ja", "通知が出ると服薬済みになりますか？"),
            ("vi", "Thông báo xuất hiện có nghĩa là đã uống thuốc chưa?"),
        ]:
            result = service.retrieve(RetrievalRequest(query=query, language=language))
            assert result.status == "context" and result.context_tokens <= 384
            assert all(chunk.language == language for chunk in result.chunks)
            assert (
                service.retrieve(
                    RetrievalRequest(
                        query=query,
                        language=language,
                        source_ids=["not-approved"],
                    )
                ).reason
                == "NO_MATCH"
            )
        assert engine.store.client.count(engine.store.collection).count == count
    finally:
        if engine.store.client.collection_exists(engine.store.collection):
            engine.store.client.delete_collection(engine.store.collection)
        engine.store.close()
