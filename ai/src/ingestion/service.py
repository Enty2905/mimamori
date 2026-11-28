import hashlib
from datetime import UTC, datetime

from filelock import FileLock, Timeout
from pydantic import BaseModel
from qdrant_client import models

from src.chunking.windows import split_sections
from src.common.errors import IngestionError
from src.common.settings import Settings
from src.embeddings.sentence_encoder import Encoder, SentenceEncoder, validate_vectors
from src.ingestion.parser import parse
from src.ingestion.sources import SourceRegistry
from src.ingestion.vector_store import VectorStore


class IngestionResult(BaseModel):
    document_id: str
    source_id: str
    collection: str
    pipeline_id: str
    chunk_count: int
    source_sha256: str


class IngestionService:
    def __init__(
        self,
        settings: Settings,
        encoder: Encoder | None = None,
        store: VectorStore | None = None,
    ) -> None:
        self.settings = settings
        self.registry = SourceRegistry(
            settings.corpus_root, settings.manifest_path, settings.max_source_bytes
        )
        self.encoder = encoder or SentenceEncoder(settings)
        self.store = store or VectorStore(settings)

    def _lock(self) -> FileLock:
        self.settings.state_dir.mkdir(parents=True, exist_ok=True)
        return FileLock(self.settings.state_dir / "ingestion.lock", timeout=0)

    def ingest(self, key: str) -> IngestionResult:
        try:
            with self._lock():
                return self._ingest(key)
        except Timeout as error:
            raise IngestionError(
                "INGESTION_BUSY", "Another ingestion is in progress.", 409
            ) from error

    def _ingest(self, key: str) -> IngestionResult:
        # No model/index side effects until provenance and privacy checks pass.
        source, text, extension = self.registry.load(key)
        sections = parse(text, extension)
        self.encoder.prepare()
        chunks = split_sections(
            source.document_id,
            source.version,
            sections,
            self.encoder,
            self.settings.chunk_max_tokens,
            self.settings.chunk_overlap_tokens,
            self.settings.pipeline_id,
            self.settings.max_chunks,
            self.settings.chunk_max_characters,
        )
        vectors = self.encoder.encode([chunk.text for chunk in chunks])
        validate_vectors(vectors, len(chunks), self.settings.embedding_dimension)
        now = datetime.now(UTC).isoformat()
        points = [
            models.PointStruct(
                id=chunk.id,
                vector=vector,
                payload={
                    "document_id": source.document_id,
                    "source_id": source.key,
                    "source": source.source,
                    "title": source.title,
                    "language": source.language,
                    "version": source.version,
                    "section": chunk.section.name,
                    "section_index": chunk.section.index,
                    "line_start": chunk.section.line_start,
                    "line_end": chunk.section.line_end,
                    "char_start": chunk.start,
                    "char_end": chunk.end,
                    "source_sha256": source.sha256,
                    "content_sha256": hashlib.sha256(chunk.text.encode()).hexdigest(),
                    "reviewed_by": source.reviewed_by,
                    "reviewed_at": source.reviewed_at.isoformat(),
                    "sensitivity_class": source.sensitivity_class,
                    "content_kind": source.content_kind,
                    "ingestion_timestamp": now,
                    "pipeline_id": self.settings.pipeline_id,
                    **self.settings.pipeline,
                    "token_count": chunk.token_count,
                    "text": chunk.text,
                },
            )
            for chunk, vector in zip(chunks, vectors, strict=True)
        ]
        self.store.ensure_collection()
        self.store.replace_document(source.document_id, points)
        return IngestionResult(
            document_id=source.document_id,
            source_id=key,
            collection=self.store.collection,
            pipeline_id=self.settings.pipeline_id,
            chunk_count=len(points),
            source_sha256=source.sha256,
        )

    def purge(self, key: str) -> str:
        # Revoked/missing local bytes may still be purged using their registered identity.
        source = self.registry.source(key)
        try:
            with self._lock():
                self.store.purge(source.document_id)
        except Timeout as error:
            raise IngestionError(
                "INGESTION_BUSY", "Another ingestion is in progress.", 409
            ) from error
        return source.document_id
