#!/usr/bin/env python3
"""Build the problem-bank embedding index used by /classify-problem."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "ml"))

from mindcraft_graph.problem_classifier import strip_math_delimiters  # noqa: E402
from mindcraft_graph.representation import embeddings  # noqa: E402

APP_DATA = REPO / "app/src/data"
QUESTION_BANK = REPO / "app/src/lib/questionBank.ts"
OUT_INDEX = REPO / "ml/data/bank_index.npz"
OUT_META = REPO / "ml/data/bank_index_meta.json"
JSON_BANKS = [
    APP_DATA / "eediQuestions.json",
    APP_DATA / "actMasterQuestionBank.generated.json",
    APP_DATA / "generatedQuestions.json",
]


def _infer_format(question: dict) -> str:
    fmt = question.get("format")
    if fmt:
        return str(fmt)
    if question.get("visual_type") == "svg" or question.get("visual_data"):
        return "diagram"
    text = str(question.get("question", "")).lower()
    if "number line" in text:
        return "number_line"
    if "table" in text:
        return "table"
    if any(token in text for token in ("graph", "coordinate", "plotted", "parabola")):
        return "coordinate_graph"
    if len(text.split()) > 18:
        return "word_problem"
    return "symbolic_expression"


def _append_question(rows: list[dict], question: dict, source: str):
    text = str(question.get("question") or "").strip()
    concept_id = str(question.get("conceptId") or question.get("concept_id") or "").strip()
    question_id = str(question.get("id") or question.get("question_id") or "").strip()
    if not text or not concept_id or not question_id:
        return
    rows.append({
        "id": question_id,
        "conceptId": concept_id,
        "format": _infer_format(question),
        "examTag": question.get("examTag") or question.get("exam_tag"),
        "source": source,
        "text": strip_math_delimiters(text),
    })


def _load_json_bank(path: Path) -> list[dict]:
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    if isinstance(data, dict):
        data = data.get("questions") or data.get("items") or []
    rows: list[dict] = []
    for item in data:
        if isinstance(item, dict):
            _append_question(rows, item, path.name)
    return rows


def _parse_inline_question_bank() -> list[dict]:
    source = QUESTION_BANK.read_text()
    rows: list[dict] = []
    object_pattern = re.compile(r"\{\s*id:'(?P<id>[^']+)'(?P<body>.*?)(?=\n\s*\{ id:'|\n\])", re.S)
    for match in object_pattern.finditer(source):
        body = match.group("body")
        concept = re.search(r"conceptId:'([^']+)'", body)
        question = re.search(r"question:'((?:\\'|[^'])*)'", body)
        if not concept or not question:
            continue
        fmt = re.search(r"format:'([^']+)'", body)
        exam = re.search(r"examTag:'([^']+)'", body)
        visual = "visual_type:'svg'" in body or "visual_data:" in body
        _append_question(rows, {
            "id": match.group("id"),
            "conceptId": concept.group(1),
            "question": question.group(1).replace("\\'", "'"),
            "format": fmt.group(1) if fmt else None,
            "examTag": exam.group(1) if exam else None,
            "visual_type": "svg" if visual else "none",
        }, "questionBank.ts")
    return rows


def load_bank_rows() -> list[dict]:
    seen: set[str] = set()
    rows: list[dict] = []
    for path in JSON_BANKS:
        rows.extend(_load_json_bank(path))
    rows.extend(_parse_inline_question_bank())
    unique: list[dict] = []
    for row in rows:
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        unique.append(row)
    return unique


def main() -> int:
    rows = load_bank_rows()
    if not rows:
        raise SystemExit("No bank rows found")
    model = embeddings.load_sentence_transformer()
    vectors = embeddings.embed_texts(model, [row["text"] for row in rows])
    np.savez_compressed(OUT_INDEX, embeddings=vectors)
    meta = [{k: v for k, v in row.items() if k != "text"} for row in rows]
    OUT_META.write_text(json.dumps(meta, indent=2))
    counts: dict[str, int] = {}
    for row in meta:
        counts[row["source"]] = counts.get(row["source"], 0) + 1
    print(f"Wrote {OUT_INDEX} and {OUT_META}")
    print(f"Rows: {len(rows)} | sources: {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
