from collections.abc import Callable
from typing import TypeVar

from qdrant_client import QdrantClient, models

from src.common.errors import IngestionError
from src.common.settings import Settings

T = TypeVar("T")


class VectorStore:
    def __init__(self, settings: Settings, client: QdrantClient | None = None) -> None:
        self.settings = settings
        self.client = client or QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key.get_secret_value() if settings.qdrant_api_key else None,
            timeout=settings.qdrant_timeout,
            check_compatibility=False,
        )
        self.collection = settings.collection_name

    def _call(self, operation: Callable[[], T]) -> T:
        try:
            return operation()
        except IngestionError:
            raise
        except Exception as error:
            raise IngestionError(
                "INDEX_UNAVAILABLE", "Vector index is unavailable.", 503
            ) from error

    def ready(self) -> None:
        self._call(self.client.get_collections)

    def ensure_collection(self) -> None:
        def ensure() -> None:
            if not self.client.collection_exists(self.collection):
                self.client.create_collection(
                    self.collection,
                    vectors_config=models.VectorParams(
                        size=self.settings.embedding_dimension, distance=models.Distance.COSINE
                    ),
                )
            info = self.client.get_collection(self.collection)
            vectors = info.config.params.vectors
            if not isinstance(vectors, models.VectorParams) or (
                vectors.size != self.settings.embedding_dimension
                or vectors.distance != models.Distance.COSINE
            ):
                raise IngestionError(
                    "INDEX_CONFIG_MISMATCH", "Existing index is incompatible.", 409
                )
            for key in ("document_id", "source_id", "language", "sensitivity_class"):
                if key not in info.payload_schema:
                    self.client.create_payload_index(
                        self.collection,
                        key,
                        field_schema=models.PayloadSchemaType.KEYWORD,
                        wait=True,
                    )

        self._call(ensure)

    def replace_document(self, document_id: str, points: list[models.PointStruct]) -> None:
        if not points:
            raise IngestionError("EMPTY_SOURCE", "Cannot replace a document with empty chunks.")

        def replace() -> None:
            for offset in range(0, len(points), 64):
                self.client.upsert(self.collection, points=points[offset : offset + 64], wait=True)
            # Only clean stale points after every replacement batch succeeds.
            self.client.delete(
                self.collection,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="document_id", match=models.MatchValue(value=document_id)
                            )
                        ],
                        must_not=[models.HasIdCondition(has_id=[point.id for point in points])],
                    )
                ),
                wait=True,
            )

        self._call(replace)

    def purge(self, document_id: str) -> None:
        def remove() -> None:
            if self.client.collection_exists(self.collection):
                self.client.delete(
                    self.collection,
                    points_selector=models.FilterSelector(
                        filter=models.Filter(
                            must=[
                                models.FieldCondition(
                                    key="document_id", match=models.MatchValue(value=document_id)
                                )
                            ]
                        )
                    ),
                    wait=True,
                )

        self._call(remove)

    def close(self) -> None:
        self.client.close()
