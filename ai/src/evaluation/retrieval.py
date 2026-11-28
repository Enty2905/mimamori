"""Frozen synthetic engineering benchmark. Never persist real user queries."""

import argparse
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from src.common.settings import Settings
from src.ingestion.service import IngestionService
from src.retrieval.contracts import RetrievalRequest
from src.retrieval.service import RetrievalService

CASES = Path(__file__).with_name("questions-v1.json")


def evaluate(service: RetrievalService, cases: list[dict], k: int) -> dict:
    rows = []
    for case in cases:
        result = service.retrieve(
            RetrievalRequest(
                query=case["query"],
                language=case["language"],
                top_k=k,
                max_context_tokens=384,
            )
        )
        relevant = set(case["relevant_sections"])
        found = {chunk.section.split(" / ")[-1] for chunk in result.chunks}
        matched = relevant & found
        rows.append(
            {
                "id": case["id"],
                "language": case["language"],
                "status": result.status,
                "reason": result.reason,
                "hit": bool(matched),
                "recall": len(matched) / len(relevant) if relevant else None,
                "no_context_correct": result.status == "no_context" if not relevant else None,
                "retrieved_sections": sorted(found),
            }
        )
    positive = [row for row in rows if row["recall"] is not None]
    negative = [row for row in rows if row["no_context_correct"] is not None]
    return {
        "k": k,
        "answerable_count": len(positive),
        "unanswerable_count": len(negative),
        "hit_at_k": sum(row["hit"] for row in positive) / len(positive) if positive else None,
        "recall_at_k": sum(row["recall"] for row in positive) / len(positive) if positive else None,
        "no_context_accuracy": sum(row["no_context_correct"] for row in negative) / len(negative)
        if negative
        else None,
        "rows": rows,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    endpoint = os.environ.get("RAG_TEST_QDRANT_URL")
    if not endpoint:
        parser.error("Set RAG_TEST_QDRANT_URL to a local test Qdrant server")
    settings = Settings(qdrant_url=endpoint, collection_prefix="spec006_eval_" + uuid4().hex[:10])
    engine = IngestionService(settings)
    try:
        for key in ("reminders-ja", "reminders-vi"):
            engine.ingest(key)
        service = RetrievalService(engine)
        dataset = json.loads(CASES.read_text(encoding="utf-8"))
        report = {
            "dataset_version": dataset["version"],
            "recorded_at": datetime.now(UTC).isoformat(),
            "pipeline_id": settings.pipeline_id,
            "embedding_model": settings.embedding_model,
            "embedding_revision": settings.embedding_revision,
            "score_threshold": settings.retrieval_min_score,
            "context_budget": 384,
            "corpus_sha256": {
                key: value.sha256 for key, value in engine.registry.entries().items()
            },
            "limitations": (
                "Small authored engineering fixtures; "
                "not clinical evaluation or calibrated confidence."
            ),
            "metrics": [
                {
                    "language": language,
                    **evaluate(
                        service,
                        [case for case in dataset["cases"] if case["language"] == language],
                        k,
                    ),
                }
                for language in ("ja", "vi")
                for k in (1, 3)
            ],
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(
            json.dumps(
                [
                    {
                        name: item[name]
                        for name in (
                            "language",
                            "k",
                            "hit_at_k",
                            "recall_at_k",
                            "no_context_accuracy",
                        )
                    }
                    for item in report["metrics"]
                ]
            )
        )
    finally:
        if engine.store.client.collection_exists(engine.store.collection):
            engine.store.client.delete_collection(engine.store.collection)
        engine.store.close()


if __name__ == "__main__":
    main()
