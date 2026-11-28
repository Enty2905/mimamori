"""Curated Vietnamese knowledge base loader with strict category & metadata validation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from app.schemas.companion import KnowledgeCategory

ALLOWED_CATEGORIES: tuple[KnowledgeCategory, ...] = (
    "elderly_care",
    "general_health",
    "medication_safety",
    "app_usage",
    "emergency_guidance",
)

ALLOWED_REVIEW_STATUSES: frozenset[str] = frozenset(
    {
        "reviewed_official_hotline",
        "sample_educational_pending_review",
        "sample_app_guide",
    }
)

REQUIRED_METADATA_FIELDS: tuple[str, ...] = (
    "doc_id",
    "title",
    "category",
    "source",
    "updated_date",
    "version",
    "review_status",
    "content",
)


class KnowledgeValidationError(ValueError):
    """Raised when a knowledge document fails schema, category, or review-status checks."""


@dataclass(frozen=True)
class KnowledgeDocument:
    """Validated curated knowledge document ready for ChromaDB indexing."""

    doc_id: str
    title: str
    category: KnowledgeCategory
    source: str
    updated_date: str
    version: str
    review_status: str
    content: str

    def to_chroma_metadata(self) -> dict[str, str]:
        """Return flat string metadata dictionary compatible with ChromaDB."""
        return {
            "doc_id": self.doc_id,
            "title": self.title,
            "category": self.category,
            "source": self.source,
            "updated_date": self.updated_date,
            "version": self.version,
            "review_status": self.review_status,
        }


def _validate_doc_dict(raw: dict[str, Any], expected_category: str | None = None) -> KnowledgeDocument:
    missing = [field for field in REQUIRED_METADATA_FIELDS if not str(raw.get(field, "")).strip()]
    if missing:
        raise KnowledgeValidationError(
            f"Knowledge document '{raw.get('doc_id', '<unknown>')}' missing fields: {missing}"
        )

    category = str(raw["category"]).strip()
    if category not in ALLOWED_CATEGORIES:
        raise KnowledgeValidationError(
            f"Unsupported knowledge category '{category}' in doc '{raw['doc_id']}'"
        )

    if expected_category and category != expected_category:
        raise KnowledgeValidationError(
            f"Category isolation error: doc '{raw['doc_id']}' has category '{category}' inside '{expected_category}'"
        )

    review_status = str(raw["review_status"]).strip()
    if review_status not in ALLOWED_REVIEW_STATUSES:
        raise KnowledgeValidationError(
            f"Invalid review_status '{review_status}' in doc '{raw['doc_id']}'. "
            f"Unverified medical claims must never be marked approved."
        )

    if review_status == "reviewed_official_hotline" and category != "emergency_guidance":
        raise KnowledgeValidationError(
            f"Only 'emergency_guidance' official 115 hotline docs may use 'reviewed_official_hotline'"
        )

    return KnowledgeDocument(
        doc_id=str(raw["doc_id"]).strip(),
        title=str(raw["title"]).strip(),
        category=category,  # type: ignore[arg-type]
        source=str(raw["source"]).strip(),
        updated_date=str(raw["updated_date"]).strip(),
        version=str(raw["version"]).strip(),
        review_status=review_status,
        content=str(raw["content"]).strip(),
    )


def _parse_markdown_with_frontmatter(path: Path, expected_category: str | None) -> KnowledgeDocument:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        raise KnowledgeValidationError(f"Markdown doc '{path}' must start with YAML frontmatter '---'")
    parts = text.split("---", 2)
    if len(parts) < 3:
        raise KnowledgeValidationError(f"Malformed YAML frontmatter in '{path}'")
    meta = yaml.safe_load(parts[1]) or {}
    if not isinstance(meta, dict):
        raise KnowledgeValidationError(f"Frontmatter in '{path}' must be a mapping")
    meta = dict(meta)
    meta.setdefault("doc_id", path.stem)
    meta["content"] = parts[2].strip()
    return _validate_doc_dict(meta, expected_category=expected_category)


def load_knowledge_documents(knowledge_dir: str | Path) -> list[KnowledgeDocument]:
    """Load and strictly validate all JSON/Markdown knowledge documents across the 5 categories."""
    root = Path(knowledge_dir)
    if not root.exists():
        raise FileNotFoundError(f"Knowledge directory does not exist: {root}")

    documents: list[KnowledgeDocument] = []
    seen_ids: set[str] = set()

    for file_path in sorted(root.rglob("*")):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in {".json", ".md"}:
            continue

        expected_cat: str | None = None
        if file_path.stem in ALLOWED_CATEGORIES:
            expected_cat = file_path.stem
        elif file_path.parent.name in ALLOWED_CATEGORIES:
            expected_cat = file_path.parent.name

        if file_path.suffix.lower() == ".json":
            payload = json.loads(file_path.read_text(encoding="utf-8"))
            items = payload if isinstance(payload, list) else [payload]
            for item in items:
                if not isinstance(item, dict):
                    raise KnowledgeValidationError(f"Expected JSON object in '{file_path}'")
                doc = _validate_doc_dict(item, expected_category=expected_cat)
                if doc.doc_id in seen_ids:
                    raise KnowledgeValidationError(f"Duplicate doc_id '{doc.doc_id}'")
                seen_ids.add(doc.doc_id)
                documents.append(doc)
        else:
            doc = _parse_markdown_with_frontmatter(file_path, expected_category=expected_cat)
            if doc.doc_id in seen_ids:
                raise KnowledgeValidationError(f"Duplicate doc_id '{doc.doc_id}'")
            seen_ids.add(doc.doc_id)
            documents.append(doc)

    loaded_categories = {doc.category for doc in documents}
    missing_categories = [c for c in ALLOWED_CATEGORIES if c not in loaded_categories]
    if missing_categories:
        raise KnowledgeValidationError(
            f"Knowledge base must cover all 5 categories; missing: {missing_categories}"
        )

    return documents
