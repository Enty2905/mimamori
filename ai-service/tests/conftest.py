"""Shared pytest fixtures keeping ChromaDB and embeddings isolated and offline."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

from app.core.config import DEFAULT_KNOWLEDGE_DIR, Settings  # noqa: E402
from main import create_app  # noqa: E402


@pytest.fixture
def test_settings(tmp_path: Path) -> Settings:
    """Return isolated test settings using hash_dev embeddings and a tmp Chroma path."""
    chroma_dir = tmp_path / "chroma_test"
    return Settings(
        environment="test",
        host="127.0.0.1",
        port=8001,
        log_level="INFO",
        embedding_provider="hash_dev",
        embedding_model_name="intfloat/multilingual-e5-base",
        embedding_dimension=768,
        chroma_persist_dir=str(chroma_dir),
        chroma_collection_name="test_companion_knowledge",
        knowledge_dir=str(DEFAULT_KNOWLEDGE_DIR),
        rag_top_k=3,
        rag_min_similarity_score=0.25,
        model_provider="mock",
    )


@pytest.fixture
def app_client(test_settings: Settings):
    """FastAPI TestClient entering lifespan with isolated temporary ChromaDB index."""
    os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
    application = create_app(settings=test_settings)
    with TestClient(application) as client:
        yield client
