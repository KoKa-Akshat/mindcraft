#!/usr/bin/env python3
"""Convert McCreary learning-graph exports into live dynamic_graphs files.

Source: mindcraft-content-engine's data/mccreary_concept_graphs/*.json — Dan
McCreary's pre-authored learning-graphs, already fetched and converted into
that repo's ConceptGraph schema by its learning_graph_ingestion.py.

Target: ml/data/dynamic_graphs/{subject_id}.json — the exact format
loaders/dynamic_concept_loader.py expects (the same shape the 4 original
book_ingestion.py-derived graphs use: euclid_elements.json et al.).

The two schemas are near-identical by design (the content-engine's
ConceptRecord was written against MindCraft's namespacing contract, and its
`dependencies` direction was confirmed against McCreary's own
learning-graph.csv: dependencies = prerequisites, same as here). The real
differences this script handles:

  1. `groups[].color` is sometimes a nested dict
     ({"color": "red", "classifierName": ...}) in the McCreary exports; the
     existing dynamic_graphs files use a plain color string. Flattened.
  2. Concepts carry a `description` field the 4 existing files don't have.
     Dropped — the loader ignores it, the content-engine repo remains the
     canonical home of per-concept prose, and duplicating 26k prose blobs
     into the live data dir would just create a second divergent copy.
  3. Five graphs (deep-learning-course, fluid-power-systems,
     graph-algorithms, intelligent-textbooks, neurodiversity-course) use
     bare JSON integers as taxonomy group codes (e.g. taxonomy_id: 3) where
     the target schema's Concept.tags is string-typed. Coerced to their
     string form ("3") — a lossless type conversion of the same group code,
     not a content change.

Every converted graph is validated through the REAL loader
(load_dynamic_concept_graph — namespacing, no self-loops, no dangling deps,
DAG check) before it is written into the live directory. A graph that fails
validation is reported and skipped, never silently dropped or "fixed" into
something it isn't.

Idempotent/rerunnable: output is deterministic; rerunning rewrites the same
bytes. The 4 original book graphs are protected — this script refuses to
overwrite them even if a future source file collides on subject_id.

Usage:
    python ml/scripts/convert_mccreary_graphs.py            # convert + validate + write
    python ml/scripts/convert_mccreary_graphs.py --dry-run  # validate only, write nothing
    python ml/scripts/convert_mccreary_graphs.py --strict   # exit 1 if any source fails
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path
from typing import Any

ML_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML_DIR))

from mindcraft_graph.loaders.dynamic_concept_loader import (  # noqa: E402
    DynamicGraphError,
    load_dynamic_concept_graph,
)

DEFAULT_SOURCE_DIR = Path(
    "/Users/akoirala/Developer/mindcraft-content-engine/data/mccreary_concept_graphs"
)
TARGET_DIR = ML_DIR / "data" / "dynamic_graphs"

# The 4 original book_ingestion.py-derived graphs. Never overwritten here —
# they came from a different pipeline and are the loader's reference fixtures.
PROTECTED_SUBJECTS = {
    "euclid_elements",
    "adam_smith_wealth_of_nations",
    "darwin_origin_of_species",
    "marcus_aurelius_meditations",
}

CONCEPT_FIELDS = ("id", "label", "subject_id", "dependencies", "taxonomy_id", "level")


def convert_graph(data: dict[str, Any]) -> dict[str, Any]:
    """Reshape one McCreary ConceptGraph dict into the dynamic_graphs format.

    Structural reshaping only — no validation here (the loader owns that),
    and no "repairs": a cycle or dangling dep in the source passes through
    and fails loud at the validation step.
    """
    groups: dict[str, Any] = {}
    for key, group in (data.get("groups") or {}).items():
        color = group.get("color")
        if isinstance(color, dict):
            color = color.get("color", "SteelBlue")
        groups[key] = {
            "classifier_name": group.get("classifier_name", key),
            "color": color if isinstance(color, str) else "SteelBlue",
        }

    concepts = []
    for concept in data.get("concepts", []):
        record = {field: concept[field] for field in CONCEPT_FIELDS if field in concept}
        # Some McCreary exports use bare integers as taxonomy group codes;
        # the target schema is string-typed. Same code, JSON string form.
        if isinstance(record.get("taxonomy_id"), int):
            record["taxonomy_id"] = str(record["taxonomy_id"])
        concepts.append(record)

    out: dict[str, Any] = {
        "subject_id": data.get("subject_id", ""),
        "title": data.get("title", data.get("subject_id", "")),
        "version": data.get("version", "0.1.0"),
    }
    if data.get("created"):
        out["created"] = data["created"]
    out["groups"] = groups
    out["concepts"] = concepts
    return out


def validate_via_loader(converted: dict[str, Any], name: str) -> str | None:
    """Round-trip the converted dict through the real loader. Returns None on
    success, or the failure reason. Uses a temp file so only the loader's
    public entrypoint is exercised — exactly what serve.py runs at startup."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp) / f"{name}.json"
        tmp_path.write_text(json.dumps(converted))
        try:
            load_dynamic_concept_graph(tmp_path)
        except (DynamicGraphError, ValueError, KeyError) as exc:
            return str(exc)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--target-dir", type=Path, default=TARGET_DIR)
    parser.add_argument("--dry-run", action="store_true", help="validate only, write nothing")
    parser.add_argument("--strict", action="store_true", help="exit 1 if any source graph fails")
    args = parser.parse_args()

    if not args.source_dir.is_dir():
        print(f"ERROR: source directory not found: {args.source_dir}", file=sys.stderr)
        return 1
    args.target_dir.mkdir(parents=True, exist_ok=True)

    sources = sorted(args.source_dir.glob("*.json"))
    converted_count = 0
    unchanged_count = 0
    failures: list[tuple[str, str]] = []
    seen_subjects: set[str] = set()

    for src in sources:
        try:
            data = json.loads(src.read_text())
        except (json.JSONDecodeError, OSError) as exc:
            failures.append((src.name, f"unreadable source: {exc}"))
            continue

        subject_id = data.get("subject_id") or src.stem
        if subject_id in PROTECTED_SUBJECTS:
            failures.append((src.name, f"subject_id {subject_id!r} collides with a protected original graph"))
            continue
        if subject_id in seen_subjects:
            failures.append((src.name, f"duplicate subject_id {subject_id!r} in source batch"))
            continue
        seen_subjects.add(subject_id)

        converted = convert_graph(data)
        reason = validate_via_loader(converted, subject_id)
        if reason is not None:
            failures.append((src.name, reason))
            continue

        target = args.target_dir / f"{subject_id}.json"
        payload = json.dumps(converted, indent=2, ensure_ascii=False) + "\n"
        if target.exists() and target.read_text() == payload:
            unchanged_count += 1
        elif not args.dry_run:
            target.write_text(payload)
        converted_count += 1
        n_concepts = len(converted["concepts"])
        print(f"  ok   {subject_id:<40} {n_concepts:>4} concepts")

    print()
    print(f"Converted + validated: {converted_count}/{len(sources)}"
          f" ({unchanged_count} already up to date)")
    if failures:
        print(f"FAILED validation ({len(failures)}):")
        for name, reason in failures:
            print(f"  FAIL {name}: {reason}")
    if args.dry_run:
        print("(dry run — nothing written)")
    return 1 if (failures and args.strict) else 0


if __name__ == "__main__":
    raise SystemExit(main())
