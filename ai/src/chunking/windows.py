import hashlib
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID, uuid5

from src.common.errors import IngestionError
from src.ingestion.parser import Section


class TokenCounter(Protocol):
    def count_tokens(self, text: str) -> int: ...


@dataclass(frozen=True)
class Chunk:
    id: str
    section: Section
    text: str
    start: int
    end: int
    token_count: int


def split_sections(
    document_id: str,
    version: str,
    sections: list[Section],
    counter: TokenCounter,
    max_tokens: int,
    overlap: int,
    pipeline_id: str,
    max_chunks: int = 2048,
    max_characters: int = 2048,
) -> list[Chunk]:
    if max_tokens < 1 or overlap < 0 or overlap >= max_tokens or max_characters < 1:
        raise ValueError("Invalid chunk window")
    chunks: list[Chunk] = []
    for section in sections:
        text = section.text
        start = 0
        while start < len(text):
            low, high = start + 1, min(len(text), start + max_characters)
            end = start
            while low <= high:
                middle = (low + high) // 2
                if counter.count_tokens(text[start:middle]) <= max_tokens:
                    end, low = middle, middle + 1
                else:
                    high = middle - 1
            if end == start:
                raise IngestionError("TOKEN_LIMIT", "A source character exceeds the token budget.")
            # Prefer sentence/paragraph endings in the latter half of the safe window.
            if end < len(text):
                boundaries = [
                    pos + 1
                    for pos in range(start + (end - start) // 2, end)
                    if text[pos] in "\n。！？.!?"
                ]
                if boundaries:
                    end = boundaries[-1]
            body = text[start:end].strip()
            # Token counts are not strictly monotonic for all tokenizers. Recheck.
            while body and counter.count_tokens(body) > max_tokens:
                end -= 1
                body = text[start:end].strip()
            if end <= start:
                raise IngestionError("TOKEN_LIMIT", "Unable to construct a bounded chunk.")
            if body:
                identity = (
                    f"{version}:{pipeline_id}:{section.index}:{section.name}:{start}:{end}:{body}"
                )
                chunk_id = str(
                    uuid5(UUID(document_id), hashlib.sha256(identity.encode()).hexdigest())
                )
                chunks.append(
                    Chunk(chunk_id, section, body, start, end, counter.count_tokens(body))
                )
                if len(chunks) > max_chunks:
                    raise IngestionError("TOO_MANY_CHUNKS", "Source exceeds the chunk limit.", 413)
            if end == len(text):
                break
            next_start = end
            if overlap:
                low, high = start + 1, end
                while low <= high:
                    middle = (low + high) // 2
                    if counter.count_tokens(text[middle:end]) <= overlap:
                        next_start, high = middle, middle - 1
                    else:
                        low = middle + 1
                while next_start < end and counter.count_tokens(text[next_start:end]) > overlap:
                    next_start += 1
            start = max(start + 1, next_start)
    if not chunks:
        raise IngestionError("EMPTY_SOURCE", "Source contains no indexable chunks.")
    return chunks
