# Mimamori AI / RAG service

Internal Python 3.13 service for ingestion, chunking, embeddings, retrieval,
RAG orchestration and evaluation. Dependency and environment management uses
`uv`.

```text
uv sync
uv run pytest
uv run uvicorn src.api.main:app --reload
```

The service currently contains bootstrap code only. Model training remains a
Phase 2 concern under `training/`.
