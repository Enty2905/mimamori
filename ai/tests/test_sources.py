import hashlib
import json

import pytest

from src.common.errors import IngestionError
from src.ingestion.sources import SourceRegistry


def registry(settings):
    return SourceRegistry(settings.corpus_root, settings.manifest_path, settings.max_source_bytes)


def test_registered_source_and_stable_document_identity(corpus):
    settings, register = corpus
    source, text, extension = registry(settings).load("sample")
    assert extension == ".md" and "Safe" in text
    register("# Changed\nAnother approved revision.", version="2")
    assert registry(settings).load("sample")[0].document_id == source.document_id


@pytest.mark.parametrize(
    "values,code",
    [
        ({"approved": False}, "SOURCE_NOT_APPROVED"),
        ({"approved": "true"}, "INVALID_MANIFEST"),
        ({"sensitivity_class": "sensitive"}, "SENSITIVE_SOURCE"),
        ({"content_kind": "conversation"}, "SENSITIVE_SOURCE"),
        ({"path": "../outside.md"}, "UNSAFE_PATH"),
        ({"path": "/outside.md"}, "UNSAFE_PATH"),
        ({"path": "C:/outside.md"}, "UNSAFE_PATH"),
        ({"path": "nested\\outside.md"}, "UNSAFE_PATH"),
        ({"path": "source.pdf"}, "UNSAFE_PATH"),
        ({"sha256": "0" * 64}, "CHECKSUM_MISMATCH"),
    ],
)
def test_rejected_source_policies(corpus, values, code):
    settings, register = corpus
    register(**values)
    with pytest.raises(IngestionError, match=code):
        registry(settings).load("sample")


@pytest.mark.parametrize(
    "text",
    [
        "Contact person@example.invalid",
        "Bearer abcdefghijklmnopqrstuvwxyz",
        "-----BEGIN PRIVATE KEY-----",
        "patient_id: synthetic",
        '{"role": "user", "content": "synthetic conversation"}',
        '{"api_key": "synthetic"}',
        "user: raw conversation",
        "患者: raw text",
        "090-1234-5678",
        "+84 912345678",
    ],
)
def test_sensitive_content_rejected_even_if_manifest_says_public(corpus, text):
    settings, register = corpus
    register(text)
    with pytest.raises(IngestionError, match="SENSITIVE_CONTENT"):
        registry(settings).load("sample")


def test_unknown_tampered_oversized_and_invalid_utf8(corpus):
    settings, register = corpus
    with pytest.raises(IngestionError, match="SOURCE_NOT_FOUND"):
        registry(settings).load("unknown")
    (settings.corpus_root / "sample.md").write_text("tampered", encoding="utf-8")
    with pytest.raises(IngestionError, match="CHECKSUM_MISMATCH"):
        registry(settings).load("sample")
    register("x" * 100)
    settings.max_source_bytes = 10
    with pytest.raises(IngestionError, match="SOURCE_TOO_LARGE"):
        registry(settings).load("sample")
    settings.max_source_bytes = 100
    entry = register(sha256=hashlib.sha256(b"\xff").hexdigest())
    (settings.corpus_root / "sample.md").write_bytes(b"\xff")
    with pytest.raises(IngestionError, match="INVALID_ENCODING"):
        registry(settings).load("sample")
    settings.manifest_path.write_text(json.dumps({"schema_version": 1, "sources": [entry, entry]}))
    with pytest.raises(IngestionError, match="INVALID_MANIFEST"):
        registry(settings).entries()


def test_symlink_escape_rejected(corpus, tmp_path):
    settings, register = corpus
    outside = tmp_path / "outside.md"
    outside.write_text("outside", encoding="utf-8")
    link = settings.corpus_root / "link.md"
    try:
        link.symlink_to(outside)
    except OSError:
        pytest.skip("Host does not allow creating a symlink")
    register(path="link.md")
    with pytest.raises(IngestionError, match="UNSAFE_PATH"):
        registry(settings).load("sample")
