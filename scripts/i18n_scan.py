#!/usr/bin/env python3
"""Scan source files to extract user-visible literals and i18n keys.

This tool inspects HTML and JavaScript/TypeScript sources for static text
that is likely exposed to end users. It outputs two JSON artifacts:

* reports/i18n/raw-literals.json — list of literal occurrences with context.
* reports/i18n/used-keys.json — list of unique i18n keys referenced via
  translation helpers or attributes.

The scanner is heuristic-based and aims to provide broad coverage without
requiring per-project configuration. For HTML sources it extracts text node
content along with selected attributes that are commonly rendered in the UI
(`placeholder`, `title`, `value`, etc.). For script sources it records string
literals that do not appear to be i18n keys as well as translation helper
invocations such as `t('key')`.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence


EXTENSIONS = {".html", ".js", ".mjs", ".ts", ".tsx"}
SKIP_DIR_NAMES = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "node_modules",
    "vendor",
    "tmp",
    "dist",
    "build",
    "coverage",
    "__pycache__",
}
HTML_ATTRS = {
    "placeholder",
    "title",
    "value",
    "alt",
    "aria-label",
    "aria-placeholder",
    "aria-description",
}

TRANSLATION_HELPERS = (
    r"\bt\s*\(\s*([\"\'])((?:\\.|(?!\1).)+)\1",
    r"\bi18n\.t\s*\(\s*([\"\'])((?:\\.|(?!\1).)+)\1",
    r"\btranslate\s*\(\s*([\"\'])((?:\\.|(?!\1).)+)\1",
)

STRING_LITERAL_REGEXES = (
    (re.compile(r"([\"\'])((?:\\.|(?!\1).)+)\1"), 2),
    (re.compile(r"`([^`]+)`"), 1),
)
HTML_ATTR_REGEX = re.compile(
    r"(data-i18n|" + "|".join(re.escape(attr) for attr in sorted(HTML_ATTRS)) + r")\s*=\s*([\"\'])((?:\\.|(?!\2).)+)\2"
)


@dataclass
class LiteralEntry:
    file: str
    line: int
    text: str
    context: str

    def to_dict(self) -> dict:
        return {
            "file": self.file,
            "line": self.line,
            "text": self.text,
            "context": self.context,
        }


def iter_source_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue

        # Skip directories that are known to contain dependencies or build artifacts.
        if any(part in SKIP_DIR_NAMES for part in path.parts[:-1]):
            continue

        if path.suffix.lower() in EXTENSIONS:
            yield path


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def extract_html_literals(path: Path, rel_path: str, lines: Sequence[str], used_keys: set[str]) -> List[LiteralEntry]:
    entries: List[LiteralEntry] = []

    for idx, line in enumerate(lines, start=1):
        # Text nodes between tags.
        for match in re.finditer(r">([^<>]+)<", line):
            text = clean_text(match.group(1))
            if text:
                entries.append(
                    LiteralEntry(
                        file=rel_path,
                        line=idx,
                        text=text,
                        context=line.strip(),
                    )
                )

        # Attributes, including data-i18n keys.
        for match in HTML_ATTR_REGEX.finditer(line):
            attr = match.group(1)
            value = clean_text(match.group(3))
            if not value:
                continue
            if attr == "data-i18n":
                used_keys.add(value)
            else:
                entries.append(
                    LiteralEntry(
                        file=rel_path,
                        line=idx,
                        text=value,
                        context=f"{attr} attribute",
                    )
                )

    return entries


def is_translation_prefix(fragment: str) -> bool:
    fragment = fragment.rstrip()
    return bool(re.search(r"(\bt|i18n\.t|translate)\s*\($", fragment))


def extract_script_literals(
    rel_path: str,
    lines: Sequence[str],
    used_keys: set[str],
) -> List[LiteralEntry]:
    entries: List[LiteralEntry] = []

    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()

        # Translation helpers.
        for pattern in TRANSLATION_HELPERS:
            for match in re.finditer(pattern, line):
                key = clean_text(match.group(2))
                if key:
                    used_keys.add(key)

        is_import_like = stripped.startswith("import ") or (
            stripped.startswith("export ") and " from " in stripped
        ) or stripped.startswith("from ")

        # General string literals.
        for regex, group_index in STRING_LITERAL_REGEXES:
            for match in regex.finditer(line):
                literal = clean_text(match.group(group_index))

                if not literal:
                    continue

                # Skip translation keys captured above.
                prefix = line[: match.start()]
                if is_translation_prefix(prefix):
                    continue
                if re.search(r"data-i18n\s*=\s*$", prefix):
                    continue
                if re.search(r"\bfrom\s*$", prefix) or re.search(r"\brequire\s*\($", prefix):
                    continue
                if is_import_like:
                    continue

                # Basic heuristic filters for non user-facing strings.
                if not re.search(r"[A-Za-z]", literal):
                    continue
                if len(literal) <= 2 and not literal.isalpha():
                    continue
                if "/" in literal and " " not in literal:
                    continue
                if " " not in literal and literal[:1] and not literal[:1].isupper():
                    continue

                entries.append(
                    LiteralEntry(
                        file=rel_path,
                        line=idx,
                        text=literal,
                        context=stripped,
                    )
                )

    return entries


def ensure_entry(entries: List[LiteralEntry], rel_path: str) -> None:
    if not entries:
        entries.append(
            LiteralEntry(
                file=rel_path,
                line=0,
                text="<no user-facing text detected>",
                context="auto-generated placeholder",
            )
        )


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    reports_dir = repo_root / "reports" / "i18n"
    reports_dir.mkdir(parents=True, exist_ok=True)

    raw_entries: List[LiteralEntry] = []
    used_keys: set[str] = set()
    files_scanned = 0
    total_lines = 0

    for path in iter_source_files(repo_root):
        rel_path = path.relative_to(repo_root).as_posix()
        try:
            contents = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        lines = contents.splitlines()
        files_scanned += 1
        total_lines += len(lines)

        if path.suffix.lower() == ".html":
            entries = extract_html_literals(path, rel_path, lines, used_keys)
        else:
            entries = extract_script_literals(rel_path, lines, used_keys)

        ensure_entry(entries, rel_path)
        raw_entries.extend(entries)

    summary_entry = LiteralEntry(
        file="__summary__",
        line=0,
        text=f"Total lines: {total_lines}; Files scanned: {files_scanned}",
        context="scan summary",
    )
    raw_entries.append(summary_entry)

    for existing in reports_dir.glob("raw-literals*.json"):
        existing.unlink()

    max_items = 2000
    chunks = [raw_entries[i : i + max_items] for i in range(0, len(raw_entries), max_items)]

    for index, chunk in enumerate(chunks):
        filename = "raw-literals.json" if index == 0 else f"raw-literals-{index + 1}.json"
        output_path = reports_dir / filename
        with output_path.open("w", encoding="utf-8") as fh:
            json.dump([entry.to_dict() for entry in chunk], fh, ensure_ascii=False, indent=2)

    used_keys_output = sorted(used_keys)
    used_keys_path = reports_dir / "used-keys.json"
    with used_keys_path.open("w", encoding="utf-8") as fh:
        json.dump(used_keys_output, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
