import hashlib
import json
from datetime import date

import pytest

from src.common.settings import Settings


@pytest.fixture
def corpus(tmp_path):
    root = tmp_path / "corpus"
    root.mkdir()
    manifest_path = root / "manifest.json"
    settings = Settings(
        corpus_root=root,
        manifest_path=manifest_path,
        state_dir=tmp_path / "state",
        embedding_dimension=3,
        chunk_max_tokens=32,
        chunk_overlap_tokens=4,
        internal_token="test-internal-token-never-production-12345",
    )

    def register(text="# Guide\nSafe project instructions.\n", **overrides):
        raw = text.encode("utf-8")
        (root / "sample.md").write_bytes(raw)
        entry = {
            "key": "sample",
            "path": "sample.md",
            "source": "repo://mimamori/sample.md",
            "title": "Synthetic guide",
            "language": "vi",
            "version": "1",
            "sha256": hashlib.sha256(raw).hexdigest(),
            "approved": True,
            "reviewed_by": "test fixture",
            "reviewed_at": date.today().isoformat(),
            "sensitivity_class": "public",
            "content_kind": "project_knowledge",
            **overrides,
        }
        manifest_path.write_text(
            json.dumps({"schema_version": 1, "sources": [entry]}), encoding="utf-8"
        )
        return entry

    register()
    return settings, register


class FakeEncoder:
    """Deterministic unit-test double; never a runtime embedding fallback."""

    def __init__(self):
        self.calls = 0

    def prepare(self):
        self.calls += 1

    def count_tokens(self, text):
        return len(text)

    def encode(self, texts):
        self.calls += 1
        return [[1.0, 0.0, 0.0] for _ in texts]
