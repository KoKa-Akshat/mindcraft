#!/usr/bin/env python3
"""Build misconception → ingredient mapping via ontology tags + embedding similarity.

Two-phase approach (per Fable 5 architecture brief):
  Phase 1 (exact): ingredient.canonical_misconception_family + diagnostic_tags
                   → confidence 1.0, method "ontology_tag"
  Phase 2 (embed): sentence-transformer cosine similarity, concept-scoped
                   (only compare a misconception against ingredients whose
                    concept prefix matches the misconception's concept_ids)
                   → keep top-3 per misconception at cosine >= 0.45

Also unions in mis_* slugs from story cells (not in Eedi registry) so downstream
code can look up any distractor_taxonomy entry, not just the 1,749 Eedi ones.

Usage:
    cd ml && source mindcraft/bin/activate
    python scripts/enrich_ingredient_misconception_map.py
    # outputs: ml/data/misconception_ingredient_map_raw.json

After Fable 5 review, copy approved links to misconception_ingredient_map.json
(which serve.py loads at startup).
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

# ── paths ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
ONTOLOGY_PATH = ROOT / "data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
EEDI_MIS_PATH = ROOT / "data/eedi_misconceptions.json"
STORY_CELLS_DIR = ROOT / "data/story_cells"
OUT_PATH = ROOT / "data/misconception_ingredient_map_raw.json"

COSINE_THRESHOLD = 0.45
TOP_K = 3


def load_ontology_ingredients(ontology_path: Path) -> list[dict]:
    """Extract every ingredient from Layer 1 with concept context."""
    data = json.loads(ontology_path.read_text())
    out = []
    for concept in data.get("concepts", []):
        cid = concept.get("id", "")
        for ing in concept.get("ingredients", []):
            out.append({
                "ingredient_id": ing.get("id", ""),
                "concept_id": cid,
                "label": ing.get("label", ""),
                "failure_mode": ing.get("failure_mode", ""),
                "canonical_misconception_family": ing.get("canonical_misconception_family"),
                "diagnostic_tags": ing.get("diagnostic_tags", []),
            })
    return out


def load_eedi_misconceptions(path: Path) -> dict[str, dict]:
    """Load eedi_misconceptions.json — keyed by mis_* slug."""
    return json.loads(path.read_text())


def collect_story_cell_misconceptions(cells_dir: Path) -> set[str]:
    """Union all mis_* slugs referenced in story cell distractor_taxonomy."""
    slugs: set[str] = set()
    for f in cells_dir.glob("*.json"):
        try:
            data = json.loads(f.read_text())
        except Exception:
            continue
        for cell in data.get("cells", []):
            if cell.get("misconception_id"):
                slugs.add(cell["misconception_id"])
            for dt in cell.get("distractor_taxonomy", []):
                mid = dt.get("misconception_id")
                if mid:
                    slugs.add(mid)
    return slugs


def phase1_ontology_tags(
    ingredients: list[dict],
    all_mis_slugs: set[str],
) -> dict[str, list[dict]]:
    """Exact matches via ontology annotation fields."""
    result: dict[str, list[dict]] = defaultdict(list)
    seen: set[tuple[str, str]] = set()

    for ing in ingredients:
        ing_id = ing["ingredient_id"]

        cmf = ing.get("canonical_misconception_family")
        if cmf and cmf in all_mis_slugs:
            key = (cmf, ing_id)
            if key not in seen:
                seen.add(key)
                result[cmf].append({
                    "ingredient_id": ing_id,
                    "confidence": 1.0,
                    "method": "ontology_tag",
                    "cosine": None,
                })

        for tag in ing.get("diagnostic_tags", []):
            if tag and tag in all_mis_slugs:
                key = (tag, ing_id)
                if key not in seen:
                    seen.add(key)
                    result[tag].append({
                        "ingredient_id": ing_id,
                        "confidence": 1.0,
                        "method": "ontology_tag",
                        "cosine": None,
                    })

    return result


def phase2_embedding(
    ingredients: list[dict],
    eedi_misconceptions: dict[str, dict],
    phase1_covered: dict[str, list[dict]],
) -> dict[str, list[dict]]:
    """Embedding similarity, concept-scoped, for misconceptions not fully covered by phase 1."""
    try:
        from mindcraft_graph.representation.embeddings import (
            load_sentence_transformer,
            embed_texts,
        )
    except ImportError:
        print("WARNING: sentence_transformers not available — skipping embedding phase.")
        return {}

    import numpy as np

    print("Loading sentence transformer…")
    model = load_sentence_transformer()

    # Build concept → ingredients index
    concept_to_ings: dict[str, list[dict]] = defaultdict(list)
    for ing in ingredients:
        concept_to_ings[ing["concept_id"]].append(ing)

    # Only run embedding on misconceptions not already fully covered by ontology tags
    # (phase1 covered = has at least one ontology_tag link → still run embedding for
    #  additional candidates, but deduplicate after)
    mis_to_embed = {
        slug: data
        for slug, data in eedi_misconceptions.items()
        if data.get("eedi_name", "").strip()
    }

    if not mis_to_embed:
        return {}

    print(f"Embedding {len(mis_to_embed)} misconceptions…")
    mis_slugs = list(mis_to_embed.keys())
    mis_texts = [
        mis_to_embed[s]["eedi_name"].strip()
        for s in mis_slugs
    ]
    mis_embs = embed_texts(model, mis_texts, batch_size=128)

    result: dict[str, list[dict]] = defaultdict(list)

    for i, slug in enumerate(mis_slugs):
        data = mis_to_embed[slug]
        concept_ids: list[str] = data.get("concept_ids", [])

        # Gather candidate ingredients (concept-scoped for precision)
        candidate_ings: list[dict] = []
        for cid in concept_ids:
            candidate_ings.extend(concept_to_ings.get(cid, []))

        if not candidate_ings:
            continue

        # Embed candidate ingredient texts (failure_mode is the best signal)
        ing_texts = [
            f"{ing['label']}. {ing['failure_mode']}".strip()
            for ing in candidate_ings
        ]
        ing_embs = embed_texts(model, ing_texts, batch_size=64)

        # Cosine similarity
        mis_vec = mis_embs[i] / (np.linalg.norm(mis_embs[i]) + 1e-9)
        ing_norms = ing_embs / (np.linalg.norm(ing_embs, axis=1, keepdims=True) + 1e-9)
        scores = ing_norms @ mis_vec  # shape (n_candidates,)

        # Collect existing phase1 ingredient_ids for dedup
        existing_ids = {e["ingredient_id"] for e in phase1_covered.get(slug, [])}

        # Top-K above threshold
        ranked = sorted(
            ((float(scores[j]), candidate_ings[j]) for j in range(len(candidate_ings))),
            key=lambda x: -x[0],
        )
        added = 0
        for cosine, ing in ranked:
            if cosine < COSINE_THRESHOLD:
                break
            if added >= TOP_K:
                break
            if ing["ingredient_id"] in existing_ids:
                continue
            result[slug].append({
                "ingredient_id": ing["ingredient_id"],
                "confidence": round(float(cosine), 4),
                "method": "embedding",
                "cosine": round(float(cosine), 4),
            })
            existing_ids.add(ing["ingredient_id"])
            added += 1

    return result


def main():
    print(f"Loading ontology from {ONTOLOGY_PATH}…")
    ingredients = load_ontology_ingredients(ONTOLOGY_PATH)
    print(f"  {len(ingredients)} ingredients across all concepts")

    print(f"Loading Eedi misconceptions from {EEDI_MIS_PATH}…")
    eedi_mis = load_eedi_misconceptions(EEDI_MIS_PATH)
    print(f"  {len(eedi_mis)} Eedi misconceptions")

    print("Collecting story-cell misconception slugs…")
    story_slugs = collect_story_cell_misconceptions(STORY_CELLS_DIR)
    print(f"  {len(story_slugs)} story-cell mis slugs (union with Eedi)")

    all_mis_slugs = set(eedi_mis.keys()) | story_slugs
    print(f"  {len(all_mis_slugs)} total mis slugs to map")

    # Phase 1 — exact ontology tag matches
    print("\nPhase 1: ontology tag matching…")
    p1 = phase1_ontology_tags(ingredients, all_mis_slugs)
    p1_links = sum(len(v) for v in p1.values())
    print(f"  {len(p1)} misconceptions matched, {p1_links} total links")

    # Phase 2 — embedding similarity (Eedi only; story slugs rarely have eedi_name)
    print("\nPhase 2: embedding similarity (concept-scoped)…")
    p2 = phase2_embedding(ingredients, eedi_mis, p1)
    p2_links = sum(len(v) for v in p2.values())
    print(f"  {len(p2)} misconceptions with new embedding links, {p2_links} total links")

    # Merge
    merged: dict[str, list[dict]] = defaultdict(list)
    for slug, links in p1.items():
        merged[slug].extend(links)
    for slug, links in p2.items():
        # append embedding links that don't duplicate phase1
        existing = {e["ingredient_id"] for e in merged[slug]}
        for link in links:
            if link["ingredient_id"] not in existing:
                merged[slug].append(link)
                existing.add(link["ingredient_id"])

    # Add empty entries for all slugs with no links (still useful for registry)
    for slug in all_mis_slugs:
        if slug not in merged:
            merged[slug] = []

    # Stats
    nonempty = sum(1 for v in merged.values() if v)
    total_links = sum(len(v) for v in merged.values())
    print(f"\nMap totals: {len(merged)} misconceptions, {nonempty} with links, {total_links} total ingredient links")

    # Frequency: links per misconception
    link_counts = sorted(
        ((slug, len(links)) for slug, links in merged.items() if links),
        key=lambda x: -x[1],
    )
    if link_counts:
        print("Top 10 by ingredient count:")
        for slug, count in link_counts[:10]:
            print(f"  {count:2d}  {slug}")

    out_data = {
        "_meta": {
            "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            "model": "all-MiniLM-L6-v2",
            "cosine_threshold": COSINE_THRESHOLD,
            "top_k": TOP_K,
            "n_misconceptions": len(merged),
            "n_with_links": nonempty,
            "n_total_links": total_links,
            "review_status": "raw",
            "note": (
                "Phase 1 = ontology_tag (confidence 1.0); "
                "Phase 2 = embedding (confidence = cosine score). "
                "Copy approved entries to misconception_ingredient_map.json "
                "after Fable 5 review before loading in serve.py."
            ),
        },
        "map": dict(merged),
    }

    OUT_PATH.write_text(json.dumps(out_data, indent=2))
    print(f"\n✓ Written to {OUT_PATH}")
    print("Next: Fable 5 audits raw map → misconception_ingredient_map.json")


if __name__ == "__main__":
    sys.exit(main())
