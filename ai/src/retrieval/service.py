import hashlib
import math
from datetime import date, datetime

from filelock import Timeout
from qdrant_client import models

from src.common.errors import IngestionError
from src.ingestion.parser import normalize
from src.ingestion.service import IngestionService
from src.retrieval.contracts import RetrievalRequest, RetrievalResponse, RetrievedChunk


class RetrievalService:
    def __init__(self, ingestion: IngestionService):
        self.engine = ingestion
        self.settings = ingestion.settings

    def retrieve(self, request: RetrievalRequest) -> RetrievalResponse:
        try:
            with self.engine._lock():
                return self._retrieve(request)
        except Timeout:
            return self.empty("BUSY")
        except IngestionError as error:
            return self.empty(
                "INVALID_INDEX" if error.code == "INDEX_CONFIG_MISMATCH" else "UNAVAILABLE"
            )
        except Exception:
            return self.empty("UNAVAILABLE")

    def empty(self, reason):
        return RetrievalResponse.empty(self.settings.pipeline_id, reason)

    def _retrieve(self, request: RetrievalRequest) -> RetrievalResponse:
        query = normalize(request.query).strip()
        sources = {
            key: source
            for key, source in self.engine.registry.entries().items()
            if source.approved
            and source.reviewed_at <= date.today()
            and source.sensitivity_class == "public"
            and source.content_kind in {"project_knowledge", "care_reference"}
            and source.language == request.language
            and (not request.source_ids or key in request.source_ids)
            and (
                not request.document_ids
                or source.document_id in {str(v) for v in request.document_ids}
            )
        }
        if not sources:
            return self.empty("NO_MATCH")
        store = self.engine.store
        client = store.client
        if not client.collection_exists(store.collection):
            return self.empty("NO_MATCH")
        info = client.get_collection(store.collection)
        vectors = info.config.params.vectors
        if not isinstance(vectors, models.VectorParams) or (
            vectors.size != self.settings.embedding_dimension
            or vectors.distance != models.Distance.COSINE
        ):
            return self.empty("INVALID_INDEX")
        encoder = self.engine.encoder
        encoder.prepare()
        if encoder.count_tokens(query) > self.settings.chunk_max_tokens:
            return self.empty("QUERY_TOO_LONG")
        vector = encoder.encode([query])[0]
        allowed = [
            models.Filter(
                must=[
                    match("source_id", key),
                    match("document_id", source.document_id),
                    match("version", source.version),
                    match("source_sha256", source.sha256),
                ]
            )
            for key, source in sources.items()
        ]
        hits = client.query_points(
            collection_name=store.collection,
            query=vector,
            query_filter=models.Filter(
                must=[
                    match("language", request.language),
                    match("sensitivity_class", "public"),
                    match("pipeline_id", self.settings.pipeline_id),
                ],
                should=allowed,
            ),
            limit=request.top_k,
            with_payload=True,
            with_vectors=False,
        ).points
        if not hits:
            return self.empty("NO_MATCH")
        ranked = sorted(hits, key=lambda item: (-item.score, str(item.id)))
        chunks, text_parts = [], []
        total = 0
        eligible = invalid = False
        for hit in ranked:
            if not math.isfinite(hit.score) or hit.score < self.settings.retrieval_min_score:
                continue
            eligible = True
            payload = hit.payload or {}
            source = sources.get(payload.get("source_id"))
            if source is None:
                invalid = True
                continue
            try:
                text = payload["text"]
                if (
                    not isinstance(text, str)
                    or len(text) > self.settings.chunk_max_characters
                    or payload.get("content_sha256") != hashlib.sha256(text.encode()).hexdigest()
                    or payload.get("source") != source.source
                    or payload.get("title") != source.title
                    or payload.get("language") != source.language
                    or payload.get("version") != source.version
                    or payload.get("source_sha256") != source.sha256
                    or payload.get("document_id") != source.document_id
                    or payload.get("pipeline_id") != self.settings.pipeline_id
                    or payload.get("sensitivity_class") != "public"
                ):
                    raise ValueError("Invalid provenance")
                datetime.fromisoformat(payload["ingestion_timestamp"])
                tokens = encoder.count_tokens(text)
                if tokens < 1 or tokens > self.settings.chunk_max_tokens:
                    raise ValueError("Invalid chunk size")
                chunk = RetrievedChunk(
                    chunk_id=hit.id,
                    document_id=source.document_id,
                    source_id=source.key,
                    source=source.source,
                    title=source.title,
                    section=payload["section"],
                    language=source.language,
                    version=source.version,
                    ingestion_timestamp=payload["ingestion_timestamp"],
                    text=text,
                    score=hit.score,
                    token_count=tokens,
                    source_sha256=source.sha256,
                )
            except (KeyError, ValueError, TypeError):
                invalid = True
                continue
            proposed = encoder.count_tokens("\n\n".join([*text_parts, chunk.text]))
            if proposed > request.max_context_tokens:
                continue
            chunks.append(chunk)
            text_parts.append(chunk.text)
            total = proposed
        if not chunks:
            return self.empty(
                "INVALID_INDEX"
                if invalid
                else ("BUDGET_EXHAUSTED" if eligible else "LOW_CONFIDENCE")
            )
        return RetrievalResponse(
            status="context",
            reason="NONE",
            pipeline_id=self.settings.pipeline_id,
            context_tokens=total,
            chunks=chunks,
        )


def match(key: str, value: str):
    return models.FieldCondition(key=key, match=models.MatchValue(value=value))
