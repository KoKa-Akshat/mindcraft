"""Embedding-based misconception enrichment for the Layer-1 concept ontology.

Matches each of the 1,749 Eedi misconceptions against the 179 ingredients in
the Layer-1 ontology using sentence-transformer cosine similarity.

For each ingredient it populates:
  canonical_misconception_family  — single best-matching misconception ID
  diagnostic_tags                 — top-3 misconception IDs (cosine >= threshold)

Writes the enriched ontology back in place and a human-review report.

Usage:
    cd ml
    source mindcraft/bin/activate
    python scripts/enrich_ontology_misconceptions.py \
        --ontology data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json \
        --misconceptions data/eedi_misconceptions.json \
        --report data/ontology_misconception_enrichment.json \
        [--threshold 0.55] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np


THRESHOLD_DEFAULT = 0.55
CROSS_CONCEPT_THRESHOLD = 0.60  # allow cross-concept when no same-concept match exists


def cosine_sim_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Compute cosine similarity between every row of a and every row of b.
    Returns shape (len(a), len(b)).
    """
    a_norm = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-9)
    b_norm = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-9)
    return a_norm @ b_norm.T


def load_model():
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        sys.exit("sentence-transformers required. Run: pip install sentence-transformers")
    print("Loading sentence-transformer model (all-MiniLM-L6-v2)...")
    return SentenceTransformer("all-MiniLM-L6-v2")


def build_ingredient_text(ing: dict) -> str:
    """Text prompt for an ingredient: label + failure_mode."""
    parts = [ing.get("label", ing.get("id", ""))]
    fm = ing.get("failure_mode", "")
    if fm:
        parts.append(fm)
    return ". ".join(parts)


def build_misconception_text(misc: dict) -> str:
    """Text prompt for a misconception: eedi_name."""
    return misc.get("eedi_name", "").strip()


def enrich(
    ontology_path: str,
    misconceptions_path: str,
    report_path: str,
    threshold: float = THRESHOLD_DEFAULT,
    dry_run: bool = False,
) -> None:
    print(f"Loading ontology: {ontology_path}")
    with open(ontology_path) as f:
        ontology = json.load(f)

    print(f"Loading misconceptions: {misconceptions_path}")
    with open(misconceptions_path) as f:
        misconceptions: dict[str, dict] = json.load(f)

    # ── Build ingredient list ───────────────────────────────────────────────
    # Each element: (concept_id, ingredient_dict, concept_idx, ing_idx)
    ingredient_entries: list[tuple[str, dict, int, int]] = []
    for ci, concept in enumerate(ontology["concepts"]):
        for ii, ing in enumerate(concept.get("ingredients", [])):
            ingredient_entries.append((concept["id"], ing, ci, ii))

    n_ings = len(ingredient_entries)
    print(f"  {n_ings} ingredients across {len(ontology['concepts'])} concepts")
    print(f"  {len(misconceptions)} misconceptions to match")

    # ── Embed ───────────────────────────────────────────────────────────────
    model = load_model()

    ing_texts = [build_ingredient_text(e[1]) for e in ingredient_entries]
    misc_ids = list(misconceptions.keys())
    misc_texts = [build_misconception_text(misconceptions[mid]) for mid in misc_ids]

    print("Embedding ingredients...")
    ing_vecs = model.encode(ing_texts, batch_size=64, show_progress_bar=True, convert_to_numpy=True)
    print("Embedding misconceptions...")
    misc_vecs = model.encode(misc_texts, batch_size=64, show_progress_bar=True, convert_to_numpy=True)

    # ── Cosine similarity: shape (n_ings, n_miscs) ─────────────────────────
    print("Computing cosine similarity matrix...")
    sim_matrix = cosine_sim_matrix(ing_vecs, misc_vecs)  # (n_ings, n_miscs)

    # Build quick lookup: concept_id → set of misconception indices
    concept_to_misc_indices: dict[str, list[int]] = {}
    for mi, mid in enumerate(misc_ids):
        for cid in misconceptions[mid].get("concept_ids", []):
            concept_to_misc_indices.setdefault(cid, []).append(mi)

    # ── Match + annotate ────────────────────────────────────────────────────
    review_records: list[dict] = []
    enriched_count = 0

    for ii, (concept_id, ing, ci, ing_idx) in enumerate(ingredient_entries):
        ing_id = ing.get("id", "")
        sims = sim_matrix[ii]  # shape (n_miscs,)

        # Candidate pool: same-concept misconceptions first
        same_concept_indices = concept_to_misc_indices.get(concept_id, [])

        candidates: list[tuple[float, int, bool]] = []  # (sim, misc_idx, is_same_concept)
        for mi in same_concept_indices:
            s = float(sims[mi])
            if s >= threshold:
                candidates.append((s, mi, True))

        # Add cross-concept at high threshold only if we have no same-concept hits
        if not candidates:
            for mi, s in enumerate(sims):
                if mi not in same_concept_indices and float(s) >= CROSS_CONCEPT_THRESHOLD:
                    candidates.append((float(s), mi, False))

        if not candidates:
            review_records.append({
                "ingredient_id": ing_id,
                "concept_id": concept_id,
                "status": "no_match",
                "top_candidates": _top_candidates(sims, misc_ids, misconceptions, n=3),
            })
            continue

        # Sort by similarity descending
        candidates.sort(key=lambda x: -x[0])

        top3_ids = [misc_ids[mi] for _, mi, _ in candidates[:3]]
        best_id = top3_ids[0]
        best_sim = candidates[0][0]

        # Write into the ontology in-place
        ontology["concepts"][ci]["ingredients"][ing_idx]["canonical_misconception_family"] = best_id
        ontology["concepts"][ci]["ingredients"][ing_idx]["diagnostic_tags"] = top3_ids
        enriched_count += 1

        review_records.append({
            "ingredient_id": ing_id,
            "concept_id": concept_id,
            "status": "matched",
            "canonical": best_id,
            "canonical_name": misconceptions[best_id].get("eedi_name", ""),
            "cosine": round(best_sim, 4),
            "diagnostic_tags": top3_ids,
            "diagnostic_names": [misconceptions[mid].get("eedi_name", "") for mid in top3_ids],
        })

    print(f"\nEnrichment complete: {enriched_count}/{n_ings} ingredients matched")
    no_match = n_ings - enriched_count
    if no_match:
        print(f"  {no_match} ingredients had no match above threshold {threshold}")

    # ── Write report ────────────────────────────────────────────────────────
    report = {
        "meta": {
            "ontology": str(ontology_path),
            "misconceptions": str(misconceptions_path),
            "threshold": threshold,
            "cross_concept_threshold": CROSS_CONCEPT_THRESHOLD,
            "total_ingredients": n_ings,
            "enriched": enriched_count,
            "no_match": no_match,
        },
        "matches": review_records,
    }
    Path(report_path).parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"Review report written: {report_path}")

    # ── Write enriched ontology ──────────────────────────────────────────────
    if dry_run:
        print("Dry-run: ontology not written.")
    else:
        with open(ontology_path, "w") as f:
            json.dump(ontology, f, indent=2, ensure_ascii=False)
        print(f"Enriched ontology written: {ontology_path}")


def _top_candidates(sims, misc_ids, misconceptions, n=3):
    top = sorted(enumerate(sims), key=lambda x: -x[1])[:n]
    return [
        {
            "misconception_id": misc_ids[mi],
            "name": misconceptions[misc_ids[mi]].get("eedi_name", ""),
            "cosine": round(float(s), 4),
        }
        for mi, s in top
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ontology", default="data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json")
    parser.add_argument("--misconceptions", default="data/eedi_misconceptions.json")
    parser.add_argument("--report", default="data/ontology_misconception_enrichment.json")
    parser.add_argument("--threshold", type=float, default=THRESHOLD_DEFAULT)
    parser.add_argument("--dry-run", action="store_true", help="Compute matches but don't write ontology")
    args = parser.parse_args()

    enrich(
        ontology_path=args.ontology,
        misconceptions_path=args.misconceptions,
        report_path=args.report,
        threshold=args.threshold,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
