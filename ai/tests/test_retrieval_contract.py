import json
from pathlib import Path
from types import SimpleNamespace

from src.evaluation.retrieval import evaluate
from src.retrieval.contracts import RetrievalResponse


def test_shared_examples_match_python_schema():
    root = Path(__file__).resolve().parents[2] / "docs" / "api"
    for name in ("rag-context-example.json", "rag-no-context-example.json"):
        result = RetrievalResponse.model_validate(json.loads((root / name).read_text()))
        assert result.schema_version == 1


def test_published_openapi_matches_running_contract():
    from src.api.main import create_app

    application = create_app()
    try:
        artifact = Path(__file__).resolve().parents[2] / "docs/api/internal-rag-openapi.json"
        assert json.loads(artifact.read_text(encoding="utf-8")) == application.openapi()
    finally:
        application.state.ingestion.store.close()


def test_metrics_distinguish_hit_recall_and_unanswerable():
    class Service:
        def retrieve(self, request):
            return SimpleNamespace(
                status="context" if request.query == "positive" else "no_context",
                reason="NONE" if request.query == "positive" else "NO_MATCH",
                chunks=[SimpleNamespace(section="Doc / A")] if request.query == "positive" else [],
            )

    result = evaluate(
        Service(),
        [
            {"id": "p", "language": "vi", "query": "positive", "relevant_sections": ["A", "B"]},
            {"id": "n", "language": "vi", "query": "negative", "relevant_sections": []},
        ],
        3,
    )
    assert result["hit_at_k"] == 1.0
    assert result["recall_at_k"] == 0.5
    assert result["no_context_accuracy"] == 1.0
