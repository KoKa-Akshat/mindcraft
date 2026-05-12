#!/usr/bin/env python3
"""Create raw past-paper ingestion records from locally approved PDFs.

This script does not download papers. Put permitted PDFs under:

  ml/data/past_papers/<EXAM_KEY>/*.pdf

It writes:

  ml/data/past_paper_index/paper_sources.jsonl
  ml/data/past_paper_index/paper_questions_raw.jsonl

If pypdf is installed, text is extracted. Otherwise the script still creates
source records and marks extraction as pending.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "past_papers"
DEFAULT_OUTPUT = ROOT / "data" / "past_paper_index"


@dataclass
class PaperSource:
    source_id: str
    exam: str
    subject: str
    year: int | None
    session: str | None
    paper: str | None
    timezone: str | None
    file_path: str
    license_note: str
    ingested_at: str
    extraction_status: str


@dataclass
class RawQuestion:
    question_id: str
    source_id: str
    exam: str
    question_number: str
    part: str | None
    raw_text: str
    page_start: int | None
    page_end: int | None
    extraction_status: str


def stable_hash(value: str, length: int = 10) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:length]


def infer_metadata(path: Path, exam: str) -> dict:
    name = path.stem.lower()
    year_match = re.search(r"(20\d{2})", name)
    session_match = re.search(r"(may|november|nov|june|march|december|dec)", name)
    paper_match = re.search(r"(paper|p)[-_ ]?(\d)", name)
    tz_match = re.search(r"(tz|timezone)[-_ ]?(\d)", name)
    return {
        "year": int(year_match.group(1)) if year_match else None,
        "session": session_match.group(1).title() if session_match else None,
        "paper": f"Paper {paper_match.group(2)}" if paper_match else None,
        "timezone": f"TZ{tz_match.group(2)}" if tz_match else None,
        "subject": exam.replace("_", " "),
    }


def iter_pdfs(input_dir: Path, exam: str | None) -> Iterable[tuple[str, Path]]:
    if exam:
        yield from ((exam, path) for path in sorted((input_dir / exam).glob("*.pdf")))
        return

    for exam_dir in sorted(p for p in input_dir.iterdir() if p.is_dir()):
        for path in sorted(exam_dir.glob("*.pdf")):
            yield exam_dir.name, path


def extract_pages(path: Path) -> list[str] | None:
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:
        return None

    reader = PdfReader(str(path))
    pages: list[str] = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return pages


QUESTION_SPLIT = re.compile(r"\n\s*(\d{1,2})[\).]\s+")


def split_questions(text: str) -> list[tuple[str, str]]:
    """Best-effort split. OCR cleanup and markscheme alignment happen later."""
    matches = list(QUESTION_SPLIT.finditer(text))
    if not matches:
        cleaned = re.sub(r"\s+", " ", text).strip()
        return [("unknown", cleaned)] if cleaned else []

    questions: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        qnum = match.group(1)
        body = re.sub(r"\s+", " ", text[start:end]).strip()
        if body:
            questions.append((qnum, body))
    return questions


def write_jsonl(path: Path, rows: Iterable[dict]) -> int:
    count = 0
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=True) + "\n")
            count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--exam", default=None, help="Optional exam folder, e.g. IB_AI_SL")
    parser.add_argument("--license-note", default="approved local study material")
    args = parser.parse_args()

    now = datetime.now(UTC).isoformat()
    sources: list[PaperSource] = []
    questions: list[RawQuestion] = []

    for exam, path in iter_pdfs(args.input_dir, args.exam):
        meta = infer_metadata(path, exam)
        source_id = f"{exam.lower()}_{stable_hash(str(path.resolve()))}"
        pages = extract_pages(path)
        extraction_status = "text_extracted" if pages is not None else "pending_pypdf"
        sources.append(PaperSource(
            source_id=source_id,
            exam=exam,
            subject=meta["subject"],
            year=meta["year"],
            session=meta["session"],
            paper=meta["paper"],
            timezone=meta["timezone"],
            file_path=str(path),
            license_note=args.license_note,
            ingested_at=now,
            extraction_status=extraction_status,
        ))

        if pages is None:
            continue

        joined = "\n".join(pages)
        for qnum, body in split_questions(joined):
            qid = f"{source_id}_q{qnum}_{stable_hash(body, 6)}"
            questions.append(RawQuestion(
                question_id=qid,
                source_id=source_id,
                exam=exam,
                question_number=qnum,
                part=None,
                raw_text=body,
                page_start=None,
                page_end=None,
                extraction_status="raw_split",
            ))

    source_count = write_jsonl(args.output_dir / "paper_sources.jsonl", (asdict(s) for s in sources))
    question_count = write_jsonl(args.output_dir / "paper_questions_raw.jsonl", (asdict(q) for q in questions))
    print(f"Wrote {source_count} sources and {question_count} raw questions to {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
