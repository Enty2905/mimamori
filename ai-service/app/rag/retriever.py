"""ChromaDB retriever with E5 passage/query prefixes, offline hash fallback, and uncertainty flags."""

from __future__ import annotations

import hashlib
import math
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Sequence

import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
from chromadb.config import Settings as ChromaSettings

from app.core.config import Settings
from app.core.logging import get_logger
from app.rag.knowledge_loader import KnowledgeDocument, load_knowledge_documents
from app.safety.policies import normalize_vietnamese
from app.schemas.companion import EvidenceSource, KnowledgeCategory

logger = get_logger("mimamori.ai_service.rag")

_VI_STOPWORDS: frozenset[str] = frozenset(
    {
        "a",
        "ai",
        "ba",
        "bac",
        "ban",
        "bao",
        "bay",
        "bi",
        "biet",
        "bo",
        "cac",
        "cach",
        "can",
        "chau",
        "chi",
        "cho",
        "chua",
        "co",
        "con",
        "cu",
        "cua",
        "cung",
        "da",
        "dang",
        "day",
        "de",
        "den",
        "di",
        "do",
        "duoc",
        "gi",
        "giup",
        "hay",
        "hoac",
        "hoi",
        "hom",
        "khi",
        "khong",
        "la",
        "lai",
        "lam",
        "len",
        "luc",
        "ma",
        "minh",
        "moi",
        "mot",
        "muon",
        "nay",
        "nen",
        "neu",
        "ngay",
        "nguoi",
        "nha",
        "nhe",
        "nhieu",
        "nhu",
        "nhung",
        "noi",
        "o",
        "ong",
        "phai",
        "qua",
        "ra",
        "rat",
        "roi",
        "sao",
        "se",
        "tai",
        "the",
        "thi",
        "toi",
        "trong",
        "tu",
        "va",
        "vao",
        "ve",
        "voi",
        "vua",
        "xem",
    }
)


class BasePrefixEmbedder(ABC):
    """Embedding wrapper guaranteeing E5 'passage: ' / 'query: ' prefixes."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Identifier for the active embedding implementation."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Model identifier reported in service status."""

    @property
    def default_min_similarity_score(self) -> float:
        """Default cosine similarity threshold calibrated for this embedder."""
        return 0.25

    @staticmethod
    def format_passage(text: str) -> str:
        stripped = text.strip()
        return stripped if stripped.startswith("passage: ") else f"passage: {stripped}"

    @staticmethod
    def format_query(text: str) -> str:
        stripped = text.strip()
        return stripped if stripped.startswith("query: ") else f"query: {stripped}"

    @abstractmethod
    def embed_passages(self, texts: Sequence[str]) -> list[list[float]]:
        """Embed knowledge passages (automatically enforcing 'passage: ' prefix)."""

    @abstractmethod
    def embed_queries(self, texts: Sequence[str]) -> list[list[float]]:
        """Embed search queries (automatically enforcing 'query: ' prefix)."""


class HashDevEmbedder(BasePrefixEmbedder):
    """Fast, deterministic offline feature-hashing embedder for CPU dev & automated tests.

    Applies explicit 'passage: '/'query: ' prefix formatting, strips the prefix token
    before hashing content features (including Vietnamese accent-folded word unigrams,
    bigrams, and character 3-4 grams), and returns L2-normalized dense vectors.
    """

    def __init__(self, dimension: int = 768) -> None:
        self._dimension = dimension
        self.last_formatted_passages: list[str] = []
        self.last_formatted_queries: list[str] = []

    @property
    def provider_name(self) -> str:
        return "hash_dev"

    @property
    def model_name(self) -> str:
        return f"deterministic-hash-dev-{self._dimension}d"

    def _embed_single(self, prefixed_text: str) -> list[float]:
        body = prefixed_text
        for prefix in ("passage: ", "query: "):
            if body.startswith(prefix):
                body = body[len(prefix) :]
                break

        folded = normalize_vietnamese(body)
        lowered = body.lower()

        raw_tokens = re.findall(r"[a-z0-9]+", folded)
        content_tokens = [tok for tok in raw_tokens if tok not in _VI_STOPWORDS and len(tok) >= 2]
        if not content_tokens:
            content_tokens = raw_tokens

        orig_tokens = re.findall(r"\w+", lowered)

        vec = [0.0] * self._dimension

        def _add_feature(feature: str, weight: float) -> None:
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
            val = int.from_bytes(digest, "little", signed=False)
            idx = val % self._dimension
            sign = 1.0 if ((val >> 63) & 1) == 0 else -1.0
            vec[idx] += sign * weight

        for tok in content_tokens:
            _add_feature(f"w:{tok}", 2.2)
            if len(tok) >= 3:
                for i in range(len(tok) - 2):
                    _add_feature(f"c3:{tok[i : i + 3]}", 0.55)
            if len(tok) >= 4:
                for i in range(len(tok) - 3):
                    _add_feature(f"c4:{tok[i : i + 4]}", 0.65)

        for i in range(len(content_tokens) - 1):
            _add_feature(f"bg:{content_tokens[i]}_{content_tokens[i + 1]}", 1.8)

        for tok in orig_tokens:
            if len(tok) >= 2 and normalize_vietnamese(tok) not in _VI_STOPWORDS:
                _add_feature(f"ow:{tok}", 0.9)

        norm = math.sqrt(sum(v * v for v in vec))
        if norm == 0.0:
            vec[0] = 1.0
            return vec
        return [v / norm for v in vec]

    def embed_passages(self, texts: Sequence[str]) -> list[list[float]]:
        formatted = [self.format_passage(t) for t in texts]
        self.last_formatted_passages = formatted
        return [self._embed_single(item) for item in formatted]

    def embed_queries(self, texts: Sequence[str]) -> list[list[float]]:
        formatted = [self.format_query(t) for t in texts]
        self.last_formatted_queries = formatted
        return [self._embed_single(item) for item in formatted]


class HuggingFaceE5Embedder(BasePrefixEmbedder):
    """Lazy-loading intfloat/multilingual-e5-base wrapper for CPU/GPU RAG retrieval."""

    def __init__(self, model_name: str = "intfloat/multilingual-e5-base") -> None:
        self._model_name = model_name
        self._model = None
        self.last_formatted_passages: list[str] = []
        self.last_formatted_queries: list[str] = []

    @property
    def provider_name(self) -> str:
        return "huggingface_e5"

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def default_min_similarity_score(self) -> float:
        """Calibrated E5 cosine similarity threshold separating in-domain Vietnamese from OOD."""
        return 0.795

    def _get_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise RuntimeError(
                    "EMBEDDING_PROVIDER=huggingface_e5 requires 'sentence-transformers' to be installed."
                ) from exc
            self._model = SentenceTransformer(self._model_name, device="cpu")
        return self._model

    def embed_passages(self, texts: Sequence[str]) -> list[list[float]]:
        formatted = [self.format_passage(t) for t in texts]
        self.last_formatted_passages = formatted
        if not formatted:
            return []
        model = self._get_model()
        vectors = model.encode(formatted, normalize_embeddings=True)
        return [vec.tolist() for vec in vectors]

    def embed_queries(self, texts: Sequence[str]) -> list[list[float]]:
        formatted = [self.format_query(t) for t in texts]
        self.last_formatted_queries = formatted
        if not formatted:
            return []
        model = self._get_model()
        vectors = model.encode(formatted, normalize_embeddings=True)
        return [vec.tolist() for vec in vectors]


def build_embedder(settings: Settings) -> BasePrefixEmbedder:
    """Instantiate configured embedding provider without downloading weights eagerly."""
    if settings.embedding_provider == "huggingface_e5":
        return HuggingFaceE5Embedder(model_name=settings.embedding_model_name)
    return HashDevEmbedder(dimension=settings.embedding_dimension)


class ChromaPrefixEmbeddingAdapter(EmbeddingFunction[Documents]):
    """ChromaDB EmbeddingFunction adapter enforcing E5 'passage: ' / 'query: ' prefixes."""

    def __init__(self, embedder: BasePrefixEmbedder) -> None:
        self._embedder = embedder

    def __call__(self, input: Documents) -> Embeddings:
        return self._embedder.embed_passages(list(input))

    def embed_query(self, input: Documents) -> Embeddings:
        return self._embedder.embed_queries(list(input))

    @staticmethod
    def name() -> str:
        return "mimamori_prefix_embedder"

    def default_space(self) -> str:
        return "cosine"

    def supported_spaces(self) -> list[str]:
        return ["cosine", "l2", "ip"]

    def get_config(self) -> dict[str, str]:
        return {
            "provider": self._embedder.provider_name,
            "model_name": self._embedder.model_name,
        }

    @staticmethod
    def build_from_config(config: dict[str, object]) -> "ChromaPrefixEmbeddingAdapter":
        provider = str(config.get("provider", "hash_dev"))
        if provider == "huggingface_e5":
            return ChromaPrefixEmbeddingAdapter(
                HuggingFaceE5Embedder(model_name=str(config.get("model_name", "intfloat/multilingual-e5-base")))
            )
        return ChromaPrefixEmbeddingAdapter(HashDevEmbedder())


@dataclass(frozen=True)
class RetrievalResult:
    """Structured RAG retrieval output separating evidence from missing-evidence uncertainty."""

    evidence_sources: list[EvidenceSource]
    has_sufficient_evidence: bool
    best_score: float
    uncertainty_note: Optional[str]


class ChromaKnowledgeRetriever:
    """Persistent ChromaDB retriever with category isolation and uncertainty reporting."""

    def __init__(
        self,
        *,
        persist_dir: str | Path,
        collection_name: str,
        embedder: BasePrefixEmbedder,
        min_similarity_score: Optional[float] = None,
    ) -> None:
        self._persist_dir = Path(persist_dir)
        self._persist_dir.mkdir(parents=True, exist_ok=True)
        self._collection_name = collection_name
        self._embedder = embedder
        self._min_similarity_score = (
            embedder.default_min_similarity_score
            if min_similarity_score is None
            else float(min_similarity_score)
        )

        self._client = chromadb.PersistentClient(
            path=str(self._persist_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self._collection = self._get_or_create_compatible_collection()

    def _get_or_create_compatible_collection(self):
        existing = self._client.get_or_create_collection(
            name=self._collection_name,
            embedding_function=None,
            metadata={
                "hnsw:space": "cosine",
                "embedding_provider": self._embedder.provider_name,
                "embedding_model": self._embedder.model_name,
            },
        )
        col_meta = existing.metadata or {}
        provider_mismatch = bool(
            col_meta.get("embedding_provider")
            and col_meta.get("embedding_provider") != self._embedder.provider_name
        )
        model_mismatch = bool(
            col_meta.get("embedding_model")
            and col_meta.get("embedding_model") != self._embedder.model_name
        )
        if provider_mismatch or model_mismatch:
            logger.warning(
                "Embedding config changed (%s/%s -> %s/%s); rebuilding local Chroma collection",
                col_meta.get("embedding_provider"),
                col_meta.get("embedding_model"),
                self._embedder.provider_name,
                self._embedder.model_name,
            )
            self._client.delete_collection(name=self._collection_name)
            existing = self._client.get_or_create_collection(
                name=self._collection_name,
                embedding_function=None,
                metadata={
                    "hnsw:space": "cosine",
                    "embedding_provider": self._embedder.provider_name,
                    "embedding_model": self._embedder.model_name,
                },
            )
        return existing

    @property
    def embedder(self) -> BasePrefixEmbedder:
        return self._embedder

    def count(self) -> int:
        return self._collection.count()

    def index_documents(self, documents: Sequence[KnowledgeDocument]) -> int:
        """Upsert curated documents using explicit 'passage: ' embeddings."""
        if not documents:
            return 0
        ids = [doc.doc_id for doc in documents]
        passages = [f"{doc.title}. {doc.content}" for doc in documents]
        metadatas = [doc.to_chroma_metadata() for doc in documents]
        embeddings = self._embedder.embed_passages(passages)
        self._collection.upsert(
            ids=ids,
            documents=passages,
            metadatas=metadatas,
            embeddings=embeddings,
        )
        return len(documents)

    def ensure_indexed_from_dir(self, knowledge_dir: str | Path) -> int:
        """Load curated docs from disk and upsert them into ChromaDB."""
        docs = load_knowledge_documents(knowledge_dir)
        return self.index_documents(docs)

    def retrieve(
        self,
        query: str,
        *,
        category: Optional[KnowledgeCategory] = None,
        top_k: int = 3,
        min_score: Optional[float] = None,
    ) -> RetrievalResult:
        """Query ChromaDB with optional strict category isolation and uncertainty detection."""
        total = self._collection.count()
        if total == 0:
            return RetrievalResult(
                evidence_sources=[],
                has_sufficient_evidence=False,
                best_score=0.0,
                uncertainty_note=(
                    "Kho tài liệu tham khảo hiện chưa có dữ liệu nên cháu chưa thể trích dẫn nguồn xác thực."
                ),
            )

        threshold = self._min_similarity_score if min_score is None else min_score
        query_embedding = self._embedder.embed_queries([query])
        n_results = min(max(top_k, 1), total)
        query_kwargs: dict = {
            "query_embeddings": query_embedding,
            "n_results": n_results,
            "include": ["documents", "metadatas", "distances"],
        }
        if category is not None:
            query_kwargs["where"] = {"category": category}

        raw = self._collection.query(**query_kwargs)
        ids_list = (raw.get("ids") or [[]])[0]
        docs_list = (raw.get("documents") or [[]])[0]
        metas_list = (raw.get("metadatas") or [[]])[0]
        dists_list = (raw.get("distances") or [[]])[0]

        evidence: list[EvidenceSource] = []
        best_score = 0.0

        for doc_id, doc_text, meta, dist in zip(ids_list, docs_list, metas_list, dists_list):
            similarity = max(0.0, min(1.0, 1.0 - float(dist)))
            if similarity > best_score:
                best_score = similarity
            if similarity < threshold or not meta:
                continue

            excerpt = str(doc_text or "")
            if len(excerpt) > 360:
                excerpt = excerpt[:357].rstrip() + "..."

            evidence.append(
                EvidenceSource(
                    doc_id=str(meta.get("doc_id", doc_id)),
                    title=str(meta.get("title", "")),
                    category=str(meta.get("category", "general_health")),  # type: ignore[arg-type]
                    source=str(meta.get("source", "")),
                    updated_date=str(meta.get("updated_date", "")),
                    version=str(meta.get("version", "")),
                    review_status=str(meta.get("review_status", "")),
                    score=round(similarity, 4),
                    excerpt=excerpt,
                )
            )

        if not evidence:
            return RetrievalResult(
                evidence_sources=[],
                has_sufficient_evidence=False,
                best_score=round(best_score, 4),
                uncertainty_note=(
                    "Cháu chưa tìm thấy tài liệu tham khảo khớp đủ tin cậy trong kho tri thức cho câu hỏi này; "
                    "nội dung trả lời chỉ mang tính trò chuyện/hướng dẫn chung, không thay thế tư vấn y tế."
                ),
            )

        return RetrievalResult(
            evidence_sources=evidence,
            has_sufficient_evidence=True,
            best_score=round(best_score, 4),
            uncertainty_note=None,
        )
