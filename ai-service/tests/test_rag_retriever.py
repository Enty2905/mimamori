"""Tests for RAG knowledge metadata, category isolation, E5 prefixes, and uncertainty."""

from __future__ import annotations

import sys
import types
from pathlib import Path

from app.core.config import DEFAULT_KNOWLEDGE_DIR, Settings
from app.rag.knowledge_loader import ALLOWED_CATEGORIES, load_knowledge_documents
from app.rag.retriever import (
    ChromaKnowledgeRetriever,
    ChromaPrefixEmbeddingAdapter,
    HashDevEmbedder,
    HuggingFaceE5Embedder,
)


def test_knowledge_documents_cover_all_categories_and_valid_review_metadata():
    docs = load_knowledge_documents(DEFAULT_KNOWLEDGE_DIR)
    assert len(docs) >= 14

    categories = {d.category for d in docs}
    assert categories == set(ALLOWED_CATEGORIES)

    official_115_docs = [d for d in docs if d.review_status == "reviewed_official_hotline"]
    assert len(official_115_docs) == 1
    assert official_115_docs[0].category == "emergency_guidance"
    assert "115" in official_115_docs[0].content

    for doc in docs:
        assert doc.source
        assert doc.title
        assert doc.updated_date
        assert doc.version
        assert doc.category in ALLOWED_CATEGORIES
        assert doc.review_status != "approved"
        assert doc.review_status != "medically_approved"
        if doc.category in {"elderly_care", "general_health", "medication_safety"}:
            assert doc.review_status == "sample_educational_pending_review"


def test_e5_prefix_enforcement_hash_dev_and_huggingface_wrapper(monkeypatch):
    # 1) Offline hash_dev embedder applies "passage: " and "query: "
    hash_embedder = HashDevEmbedder(dimension=768)
    p_vecs = hash_embedder.embed_passages(["Hướng dẫn uống thuốc an toàn"])
    q_vecs = hash_embedder.embed_queries(["Làm sao uống thuốc an toàn?"])
    assert len(p_vecs) == 1 and len(p_vecs[0]) == 768
    assert len(q_vecs) == 1 and len(q_vecs[0]) == 768
    assert hash_embedder.last_formatted_passages == ["passage: Hướng dẫn uống thuốc an toàn"]
    assert hash_embedder.last_formatted_queries == ["query: Làm sao uống thuốc an toàn?"]

    # ChromaDB EmbeddingFunction adapter delegates passages to __call__ and queries to embed_query
    adapter = ChromaPrefixEmbeddingAdapter(hash_embedder)
    assert adapter.name() == "mimamori_prefix_embedder"
    adapter(["tài liệu mẫu"])
    assert hash_embedder.last_formatted_passages == ["passage: tài liệu mẫu"]
    adapter.embed_query(["câu hỏi mẫu"])
    assert hash_embedder.last_formatted_queries == ["query: câu hỏi mẫu"]

    # 2) HuggingFaceE5Embedder prefix contract verified via stub without downloading 1.11GB model
    captured_inputs: list[list[str]] = []

    class DummyVec:
        def __init__(self, vals: list[float]) -> None:
            self._vals = vals

        def tolist(self) -> list[float]:
            return self._vals

    class DummySentenceTransformer:
        def __init__(self, model_name: str, device: str = "cpu") -> None:
            self.model_name = model_name
            self.device = device

        def encode(self, texts, normalize_embeddings: bool = True):
            assert normalize_embeddings is True
            captured_inputs.append(list(texts))
            return [DummyVec([1.0, 0.0, 0.0]) for _ in texts]

    fake_module = types.ModuleType("sentence_transformers")
    fake_module.SentenceTransformer = DummySentenceTransformer  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "sentence_transformers", fake_module)

    hf_embedder = HuggingFaceE5Embedder(model_name="intfloat/multilingual-e5-base")
    hf_embedder.embed_passages(["Thông tin chăm sóc"])
    hf_embedder.embed_queries(["Tôi cần hỏi thông tin"])
    assert captured_inputs == [
        ["passage: Thông tin chăm sóc"],
        ["query: Tôi cần hỏi thông tin"],
    ]


def test_chromadb_persistence_and_strict_category_isolation(tmp_path: Path):
    chroma_dir = tmp_path / "chroma_isolated"
    embedder = HashDevEmbedder(dimension=768)
    retriever = ChromaKnowledgeRetriever(
        persist_dir=chroma_dir,
        collection_name="test_isolation",
        embedder=embedder,
        min_similarity_score=0.10,
    )
    indexed = retriever.ensure_indexed_from_dir(DEFAULT_KNOWLEDGE_DIR)
    assert indexed >= 14

    # Re-open PersistentClient on the same directory to verify disk persistence
    reopened = ChromaKnowledgeRetriever(
        persist_dir=chroma_dir,
        collection_name="test_isolation",
        embedder=embedder,
        min_similarity_score=0.10,
    )
    assert reopened.count() == indexed

    # Query with strict category="app_usage" must return ONLY app_usage documents
    app_res = reopened.retrieve("Hướng dẫn nhắc thuốc và trò chuyện trên ứng dụng", category="app_usage", top_k=3)
    assert app_res.has_sufficient_evidence is True
    assert all(ev.category == "app_usage" for ev in app_res.evidence_sources)

    # Query with strict category="medication_safety" must return ONLY medication_safety documents
    med_res = reopened.retrieve("Không nhớ đã uống thuốc chưa thì làm sao?", category="medication_safety", top_k=3)
    assert med_res.has_sufficient_evidence is True
    assert all(ev.category == "medication_safety" for ev in med_res.evidence_sources)

    # Query with strict category="emergency_guidance" returns reviewed official 115 hotline doc
    emerg_res = reopened.retrieve("Số điện thoại gọi cấp cứu 115 khi nguy hiểm", category="emergency_guidance", top_k=2)
    assert emerg_res.has_sufficient_evidence is True
    assert any(ev.review_status == "reviewed_official_hotline" for ev in emerg_res.evidence_sources)


def test_missing_evidence_triggers_explicit_uncertainty_note(app_client):
    # Completely off-topic query outside all 5 elderly companion categories
    resp = app_client.post(
        "/api/v1/companion/chat",
        json={
            "message": "Giá vàng SJC hôm nay tăng hay giảm và cách sửa bugi xe máy?",
            "include_general_knowledge": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["safety_triggered"] is False
    assert body["evidence_sources"] == []
    assert body["knowledge_boundary"] == "general_guidance_only"
    assert body["uncertainty_note"] is not None
    assert "chưa tìm thấy" in body["uncertainty_note"].lower()

    # With include_general_knowledge=False, service must refuse to hallucinate general answers
    resp_strict = app_client.post(
        "/api/v1/companion/chat",
        json={
            "message": "Giá vàng SJC hôm nay tăng hay giảm và cách sửa bugi xe máy?",
            "include_general_knowledge": False,
        },
    )
    assert resp_strict.status_code == 200
    body_strict = resp_strict.json()
    assert body_strict["evidence_sources"] == []
    assert body_strict["knowledge_boundary"] == "insufficient_evidence"
    assert body_strict["provider"] == "rag_uncertainty_gate"
    assert body_strict["uncertainty_note"] is not None
