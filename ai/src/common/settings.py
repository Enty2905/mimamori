import hashlib
import json
from pathlib import Path

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

AI_ROOT = Path(__file__).resolve().parents[2]
NORMALIZATION = "unicode-nfc-lines-v1"
CHUNKING = "section-token-window-v1"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RAG_", extra="ignore")

    corpus_root: Path = AI_ROOT / "datasets" / "approved"
    manifest_path: Path = AI_ROOT / "datasets" / "approved" / "manifest.json"
    state_dir: Path = AI_ROOT / "artifacts"
    model_cache: Path = AI_ROOT / "models"
    internal_token: SecretStr | None = None
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: SecretStr | None = None
    qdrant_timeout: float = Field(default=10, ge=1, le=60)
    collection_prefix: str = Field(default="mimamori_kb", pattern=r"^[a-z][a-z0-9_]{0,39}$")
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    embedding_revision: str = Field(
        default="e8f8c211226b894fcb81acc59f3b34ba3efd5f42", pattern=r"^[a-f0-9]{40}$"
    )
    embedding_dimension: int = Field(default=384, ge=1, le=8192)
    embedding_batch_size: int = Field(default=16, ge=1, le=128)
    model_local_only: bool = False
    cpu_threads: int = Field(default=2, ge=1, le=16)
    chunk_max_tokens: int = Field(default=96, ge=8, le=4096)
    chunk_overlap_tokens: int = Field(default=16, ge=0, le=1024)
    chunk_max_characters: int = Field(default=2048, ge=128, le=16384)
    max_source_bytes: int = Field(default=262144, ge=1, le=1048576)
    max_chunks: int = Field(default=2048, ge=1, le=10000)
    retrieval_min_score: float = Field(default=0.45, ge=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def valid_overlap(self) -> "Settings":
        if self.chunk_overlap_tokens >= self.chunk_max_tokens:
            raise ValueError("Chunk overlap must be below chunk size")
        return self

    @property
    def pipeline(self) -> dict[str, str | int | bool]:
        return {
            "normalization": NORMALIZATION,
            "chunking": CHUNKING,
            "embedding_model": self.embedding_model,
            "embedding_revision": self.embedding_revision,
            "embedding_dimension": self.embedding_dimension,
            "normalize_embeddings": True,
            "chunk_max_tokens": self.chunk_max_tokens,
            "chunk_overlap_tokens": self.chunk_overlap_tokens,
            "chunk_max_characters": self.chunk_max_characters,
        }

    @property
    def pipeline_id(self) -> str:
        return hashlib.sha256(json.dumps(self.pipeline, sort_keys=True).encode()).hexdigest()

    @property
    def collection_name(self) -> str:
        return f"{self.collection_prefix}_{self.pipeline_id[:20]}"
