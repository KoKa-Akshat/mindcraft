#!/usr/bin/env python3
"""Analyze misconception frequency in the Eedi question bank.

Answers: which misconceptions are the most common traps per concept?
         which distractor positions (A/B/C/D) carry the highest-frequency errors?
         which misconceptions appear across multiple concepts (deep cognitive blocks)?

Inputs:
  data/eedi/train.csv            — 1,869 questions with 4 misconception IDs per question
  data/eedi/misconception_mapping.csv  — numeric misconception ID → English label
  ml/data/eedi_misconceptions.json     — our mis_* slug registry with concept_ids

Output:
  ml/data/eedi_misconception_frequency.json — used for story cell priority ordering

Usage:
    cd <repo-root>
    python3 ml/scripts/analyze_misconception_frequency.py

No virtualenv needed — uses only stdlib + pandas (usually available).
"""
from __future__ import annotations

import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
TRAIN_CSV = ROOT / "data/eedi/train.csv"
MIS_MAP_CSV = ROOT / "data/eedi/misconception_mapping.csv"
EEDI_MIS_JSON = ROOT / "ml/data/eedi_misconceptions.json"
ONT_PATH = ROOT / "ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
OUT_PATH = ROOT / "ml/data/eedi_misconception_frequency.json"


def load_misconception_mapping(path: Path) -> dict[str, str]:
    """MisconceptionId (int string) → MisconceptionName."""
    result: dict[str, str] = {}
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            mid = str(row.get("MisconceptionId", "")).strip()
            name = row.get("MisconceptionName", "").strip()
            if mid and name:
                result[mid] = name
    return result


def load_eedi_slugs(path: Path) -> dict[str, dict]:
    """mis_slug → {eedi_numeric_id, concept_ids[]}."""
    data = json.loads(path.read_text())
    # eedi_misconceptions.json is keyed by slug with optional "numeric_id" field
    return data


def numeric_to_slug_map(eedi_slugs: dict[str, dict]) -> dict[str, str]:
    """eedi_misconception_id (int) → mis_slug. Built from eedi_misconceptions.json."""
    result: dict[str, str] = {}
    for slug, info in eedi_slugs.items():
        nid = info.get("eedi_misconception_id")
        if nid is not None:
            result[str(int(nid))] = slug
    return result


def load_concept_names(path: Path) -> dict[str, str]:
    """concept_id → human name from Layer 1 ontology."""
    data = json.loads(path.read_text())
    return {c["id"]: c.get("label", c["id"]) for c in data.get("concepts", [])}


def analyze(
    train_csv: Path,
    mis_map: dict[str, str],
    numeric_to_slug: dict[str, str],
    eedi_slugs: dict[str, dict],
) -> dict:
    """
    Returns:
      per_concept: {concept_id: [{slug, label, count, rank}]}
      per_slug:    {slug: {count, concepts[], label}}
      cross_concept: [{slug, label, concept_count, concept_ids[]}]  — appears in 3+ concepts
      distractor_positions: {slug: {A: n, B: n, C: n, D: n}}
    """
    # per-concept raw counters
    concept_counter: dict[str, Counter] = defaultdict(Counter)
    # raw slug counters (global)
    global_counter: Counter = Counter()
    # distractor position counters (A=0, B=1, C=2, D=3)
    position_counter: dict[str, Counter] = defaultdict(Counter)
    # slug → set of concept_ids (from eedi_misconceptions.json)
    slug_to_concepts: dict[str, set[str]] = {}

    def get_slug(numeric_id: str) -> str | None:
        nid = str(numeric_id).strip()
        if not nid or nid in ("", "nan", "None"):
            return None
        # CSV stores as "1672.0" — normalize to integer string
        try:
            nid = str(int(float(nid)))
        except ValueError:
            return None
        return numeric_to_slug.get(nid)

    with open(train_csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Use SubjectId (numeric) + ConstructName to map to our concept slug
            # eedi_misconceptions.json stores concept_ids per misconception
            for pos, col in enumerate(["MisconceptionAId", "MisconceptionBId",
                                       "MisconceptionCId", "MisconceptionDId"]):
                raw = row.get(col, "").strip()
                slug = get_slug(raw)
                if not slug:
                    continue
                global_counter[slug] += 1
                pos_label = chr(ord("A") + pos)
                position_counter[slug][pos_label] += 1
                # concept_ids from our registry
                info = eedi_slugs.get(slug, {})
                concept_ids: list[str] = info.get("concept_ids", [])
                slug_to_concepts.setdefault(slug, set()).update(concept_ids)
                for cid in concept_ids:
                    concept_counter[cid][slug] += 1

    # Build per_concept sorted lists
    per_concept: dict[str, list[dict]] = {}
    for cid, counter in concept_counter.items():
        ranked = []
        for rank, (slug, count) in enumerate(counter.most_common(), 1):
            label = eedi_slugs.get(slug, {}).get("eedi_name", slug)
            ranked.append({"slug": slug, "label": label, "count": count, "rank": rank})
        per_concept[cid] = ranked

    # Build per_slug summary
    per_slug: dict[str, dict] = {}
    for slug, count in global_counter.most_common():
        label = eedi_slugs.get(slug, {}).get("eedi_name", slug)
        per_slug[slug] = {
            "count": count,
            "label": label,
            "concept_ids": sorted(slug_to_concepts.get(slug, set())),
            "positions": dict(position_counter[slug]),
        }

    # Cross-concept misconceptions (appear in 3+ concept_ids)
    cross_concept = []
    for slug, concepts in slug_to_concepts.items():
        if len(concepts) >= 3:
            label = eedi_slugs.get(slug, {}).get("eedi_name", slug)
            cross_concept.append({
                "slug": slug,
                "label": label,
                "concept_count": len(concepts),
                "concept_ids": sorted(concepts),
                "global_count": global_counter.get(slug, 0),
            })
    cross_concept.sort(key=lambda x: (-x["concept_count"], -x["global_count"]))

    return {
        "per_concept": per_concept,
        "per_slug": per_slug,
        "cross_concept": cross_concept,
    }


def main() -> None:
    if not TRAIN_CSV.exists():
        print(f"ERROR: {TRAIN_CSV} not found. Download from Kaggle 'Eedi 2024' competition.")
        sys.exit(1)

    print("Loading misconception mapping…")
    mis_map = load_misconception_mapping(MIS_MAP_CSV)
    print(f"  {len(mis_map)} numeric IDs")

    print("Loading Eedi slug registry…")
    eedi_slugs = load_eedi_slugs(EEDI_MIS_JSON)
    numeric_to_slug = numeric_to_slug_map(eedi_slugs)
    mapped = sum(1 for v in eedi_slugs.values() if v.get("eedi_misconception_id") is not None)
    print(f"  {len(eedi_slugs)} slugs, {mapped} with numeric_id mapping")

    print("Loading concept names from Layer 1 ontology…")
    concept_names = load_concept_names(ONT_PATH)

    print(f"Analyzing {TRAIN_CSV.name}…")
    result = analyze(TRAIN_CSV, mis_map, numeric_to_slug, eedi_slugs)

    # Stats
    total_concepts = len(result["per_concept"])
    total_slugs = len(result["per_slug"])
    print(f"  {total_concepts} concepts with misconception data")
    print(f"  {total_slugs} unique misconception slugs observed")
    print(f"  {len(result['cross_concept'])} cross-concept misconceptions (≥3 concepts)")

    print("\nTop 20 global misconceptions by frequency:")
    for slug, info in list(result["per_slug"].items())[:20]:
        print(f"  {info['count']:4d}  {slug}  |  {info['label'][:70]}")

    print("\nTop cross-concept misconceptions (deep cognitive blocks):")
    for item in result["cross_concept"][:10]:
        print(f"  {item['concept_count']} concepts, {item['global_count']} hits: {item['slug']}")
        print(f"    → {', '.join(item['concept_ids'][:5])}")
        print(f"    \"{item['label'][:80]}\"")

    # Per-concept summary
    print("\nTop 3 misconceptions per concept (for story cell prioritization):")
    for cid in sorted(result["per_concept"].keys()):
        name = concept_names.get(cid, cid)
        top3 = result["per_concept"][cid][:3]
        if not top3:
            continue
        print(f"\n  {name} ({cid})")
        for r in top3:
            print(f"    {r['rank']:2d}. [{r['count']:3d}]  {r['slug']}")
            print(f"         \"{r['label'][:80]}\"")

    out_data = {
        "_meta": {
            "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "source": str(TRAIN_CSV.name),
            "n_questions": "see train.csv",
            "n_concepts": total_concepts,
            "n_slugs_observed": total_slugs,
            "n_cross_concept": len(result["cross_concept"]),
            "note": (
                "per_concept: sorted by frequency desc — top slug = highest-priority story cell target. "
                "cross_concept: misconceptions appearing in 3+ concepts = deep cognitive blocks "
                "that cross-concept story cells should target first."
            ),
        },
        "per_concept": result["per_concept"],
        "per_slug": result["per_slug"],
        "cross_concept": result["cross_concept"],
    }

    OUT_PATH.write_text(json.dumps(out_data, indent=2))
    print(f"\n✓ Written to {OUT_PATH}")
    print("Use per_concept[conceptId][0] to find highest-priority story cell target per concept.")
    print("Use cross_concept[:10] for cross-concept story cells that hit the deepest blocks.")


if __name__ == "__main__":
    main()
