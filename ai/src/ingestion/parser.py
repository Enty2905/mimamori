import re
import unicodedata
from dataclasses import dataclass

from src.common.errors import IngestionError


@dataclass(frozen=True)
class Section:
    index: int
    name: str
    text: str
    line_start: int
    line_end: int


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text.replace("\r\n", "\n").replace("\r", "\n"))
    if any(unicodedata.category(char) in {"Cc", "Cf"} and char not in "\n\t" for char in text):
        raise IngestionError("INVALID_TEXT", "Source contains unsupported control characters.")
    lines = [re.sub(r"[^\S\n]+", " ", line).strip() for line in text.split("\n")]
    # Keep blank lines: section line numbers continue to reference the source.
    result = "\n".join(lines)
    if not result.strip():
        raise IngestionError("EMPTY_SOURCE", "Source contains no indexable text.")
    return result


def parse(text: str, extension: str) -> list[Section]:
    normalized = normalize(text)
    if extension == ".txt":
        return [Section(0, "Document", normalized.strip(), 1, len(normalized.splitlines()))]
    if extension != ".md":
        raise IngestionError("UNSUPPORTED_FORMAT", "Only Markdown and plain text are supported.")
    sections: list[Section] = []
    headings: list[tuple[int, str]] = []
    lines: list[str] = []
    start = 1
    name = "Document"
    in_code = False

    def flush(end: int) -> None:
        body = "\n".join(lines).strip()
        if body:
            sections.append(Section(len(sections), name, body, start, end))

    for number, line in enumerate(normalized.split("\n"), 1):
        if line.startswith(("```", "~~~")):
            in_code = not in_code
        heading = None if in_code else re.match(r"^(#{1,6})\s+(.+?)\s*#*$", line)
        if heading:
            flush(number - 1)
            level, label = len(heading[1]), heading[2]
            headings = [entry for entry in headings if entry[0] < level] + [(level, label)]
            name = " / ".join(label for _, label in headings)
            if len(name) > 512:
                raise IngestionError("SECTION_TOO_LONG", "Source section heading is too long.")
            lines = [label]
            start = number
        else:
            lines.append(line)
    flush(len(normalized.split("\n")))
    return sections
