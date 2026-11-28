import math
import os
from typing import Protocol

from src.common.errors import IngestionError
from src.common.settings import Settings


class Encoder(Protocol):
    def prepare(self) -> None: ...
    def count_tokens(self, text: str) -> int: ...
    def encode(self, texts: list[str]) -> list[list[float]]: ...


class SentenceEncoder:
    """Lazy local inference. No model download or GPU allocation during API startup."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._model = None

    def prepare(self) -> None:
        if self._model is not None:
            return
        os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
        os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
        try:
            import torch
            from sentence_transformers import SentenceTransformer

            torch.set_num_threads(self.settings.cpu_threads)
            model = SentenceTransformer(
                self.settings.embedding_model,
                revision=self.settings.embedding_revision,
                cache_folder=str(self.settings.model_cache),
                trust_remote_code=False,
                token=False,
                device="cpu",
                local_files_only=self.settings.model_local_only,
            )
            if model.get_embedding_dimension() != self.settings.embedding_dimension:
                raise IngestionError(
                    "MODEL_DIMENSION", "Model dimension differs from configuration.", 409
                )
            special = model.tokenizer.num_special_tokens_to_add(pair=False)
            if self.settings.chunk_max_tokens + special > model.max_seq_length:
                raise IngestionError(
                    "MODEL_TOKEN_LIMIT", "Chunk size exceeds the model token limit.", 409
                )
            self._model = model
        except IngestionError:
            raise
        except Exception as error:
            raise IngestionError(
                "MODEL_UNAVAILABLE", "Embedding model is unavailable.", 503
            ) from error

    def count_tokens(self, text: str) -> int:
        self.prepare()
        return len(
            self._model.tokenizer.encode(
                text, add_special_tokens=False, truncation=False, verbose=False
            )
        )

    def encode(self, texts: list[str]) -> list[list[float]]:
        self.prepare()
        if any(self.count_tokens(text) > self.settings.chunk_max_tokens for text in texts):
            raise IngestionError("MODEL_TOKEN_LIMIT", "Input exceeds the embedding token limit.")
        try:
            vectors = self._model.encode(
                texts,
                batch_size=self.settings.embedding_batch_size,
                show_progress_bar=False,
                normalize_embeddings=True,
                convert_to_numpy=True,
            ).tolist()
        except Exception as error:
            raise IngestionError(
                "EMBEDDING_FAILED", "Embedding could not be completed.", 503
            ) from error
        validate_vectors(vectors, len(texts), self.settings.embedding_dimension)
        return vectors


def validate_vectors(vectors: list[list[float]], count: int, dimension: int) -> None:
    if len(vectors) != count or any(
        len(vector) != dimension
        or not all(math.isfinite(value) for value in vector)
        or sum(value * value for value in vector) <= 0
        for vector in vectors
    ):
        raise IngestionError("INVALID_VECTORS", "Embedding output is invalid.", 503)
