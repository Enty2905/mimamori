# Mimamori internal AI service

Python 3.13 + uv. Spec 005 implements approved-source ingestion, normalization,
traceable deterministic chunks, pinned sentence-transformers embeddings and
Qdrant storage. FastAPI exposes authenticated operator endpoints and health.
Medication flows do not depend on this service.

See the [ingestion run guide](../docs/run-ingestion.md).

```powershell
uv sync --locked
uv run python -m src.ingestion.cli list
uv run python -m pytest -ra -m "not integration"
```

Spec 006 adds authenticated query retrieval with current-source metadata filters,
bounded traceable context, explicit no-context responses, a Spring internal client
and a frozen ja/vi evaluation baseline. See the
[retrieval run guide](../docs/run-retrieval.md).
Spring Boot owns public generation/SSE and mobile access. Training remains Phase 2.
