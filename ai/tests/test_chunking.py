import unicodedata

import pytest

from src.chunking.windows import split_sections
from src.common.errors import IngestionError
from src.ingestion.parser import normalize, parse
from src.ingestion.sources import Source
from tests.conftest import FakeEncoder


def test_normalization_and_section_trace():
    raw = "# Guide\r\n\r\nCafe\u0301\t text  \r\n## Details\r\n予定。\r\n"
    sections = parse(raw, ".md")
    assert sections[0].text == "Guide\n\nCafé text"
    assert sections[1].name == "Guide / Details"
    assert (sections[1].line_start, sections[1].line_end) == (4, 6)
    assert unicodedata.is_normalized("NFC", normalize(raw))


@pytest.mark.parametrize("text", ["", " \n\t", "bad\x00text", "hidden\u202etext"])
def test_invalid_text(text):
    with pytest.raises(IngestionError):
        parse(text, ".txt")


@pytest.mark.parametrize(
    "body",
    [
        "確認の予定を端末に保存します。" * 15,
        "Lịch nhắc được lưu trên thiết bị. " * 15,
        "longword" * 40,
    ],
)
def test_token_budget_overlap_complete_coverage_and_stable_ids(corpus, body):
    _, register = corpus
    source = Source.model_validate(register())
    sections = parse(body, ".txt")
    chunks = split_sections(source.document_id, source.version, sections, FakeEncoder(), 32, 4, "p")
    repeated = split_sections(
        source.document_id, source.version, sections, FakeEncoder(), 32, 4, "p"
    )
    assert [chunk.id for chunk in chunks] == [chunk.id for chunk in repeated]
    assert len({chunk.id for chunk in chunks}) == len(chunks)
    assert all(chunk.token_count <= 32 for chunk in chunks)
    assert chunks[0].start == 0 and chunks[-1].end == len(sections[0].text)
    assert all(
        b.start <= a.end and b.start > a.start for a, b in zip(chunks, chunks[1:], strict=False)
    )
    assert all(
        FakeEncoder().count_tokens(sections[0].text[b.start : a.end]) <= 4
        for a, b in zip(chunks, chunks[1:], strict=False)
    )


def test_heading_and_character_bounds(corpus):
    with pytest.raises(IngestionError, match="SECTION_TOO_LONG"):
        parse("# " + "x" * 513, ".md")

    class CompressedCounter:
        def count_tokens(self, text):
            assert len(text) <= 128
            return 1 if text else 0

    _, register = corpus
    source = Source.model_validate(register())
    chunks = split_sections(
        source.document_id,
        "1",
        parse("x" * 1000, ".txt"),
        CompressedCounter(),
        32,
        0,
        "p",
        max_characters=128,
    )
    assert len(chunks) == 8
    assert "".join(chunk.text for chunk in chunks) == "x" * 1000


def test_configuration_changes_identity_and_chunk_limit(corpus):
    settings, register = corpus
    source = Source.model_validate(register())
    sections = parse("abc " * 100, ".txt")
    original = settings.pipeline_id
    settings.chunk_overlap_tokens = 3
    assert settings.pipeline_id != original
    with pytest.raises(IngestionError, match="TOO_MANY_CHUNKS"):
        split_sections(source.document_id, "1", sections, FakeEncoder(), 32, 4, original, 1)
