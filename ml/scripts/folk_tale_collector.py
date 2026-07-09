#!/usr/bin/env python3
"""Enrich folk_catalog.json tales with math-teaching signals via Groq.

Reads:  ml/data/folk_tales/folk_catalog.json  (built by build_folk_catalog.py)
Writes: ml/data/folk_tales/folk_tale_bank.json (catalog + enrichment fields)
Cache:  ml/data/folk_tales/.enrichment_cache.json (keyed by tale id; not committed)

Enrichment is a single Groq call per tale asking for math_theme_tags,
concept_affinity_scores, math_skin_score, quality_score, katha_voice_sample,
and keywords (see SYSTEM_PROMPT below — schema is fixed by the build spec).

CLI:
    python3 ml/scripts/folk_tale_collector.py --batch 20      # enrich next 20
    python3 ml/scripts/folk_tale_collector.py --export-top    # sync top 100 -> app
    python3 ml/scripts/folk_tale_collector.py --dry-run               # print prompts only
    python3 ml/scripts/folk_tale_collector.py --batch 10 --dry-run
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ML_DIR = SCRIPT_DIR.parent
REPO_ROOT = ML_DIR.parent

sys.path.insert(0, str(ML_DIR))
from generation.llm_client import complete  # noqa: E402

CATALOG_PATH = ML_DIR / "data" / "folk_tales" / "folk_catalog.json"
BANK_PATH = ML_DIR / "data" / "folk_tales" / "folk_tale_bank.json"
CACHE_PATH = ML_DIR / "data" / "folk_tales" / ".enrichment_cache.json"
MATH_SKIN_TOP_PATH = REPO_ROOT / "app" / "src" / "data" / "mathSkinTop.json"

ALLOWED_TAGS = [
    "ratio", "proportion", "pattern", "growth", "geometry", "measurement",
    "probability", "sequence", "balance", "transformation", "symmetry",
    "counting", "area", "number_theory",
]

ALLOWED_CONCEPTS = [
    "fractions_decimals", "ratios_proportions", "linear_equations", "quadratic_equations",
    "geometric_transformations", "area_volume", "probability", "sequences_series",
    "descriptive_statistics", "right_triangle_geometry", "triangles_congruence",
    "circles_geometry", "lines_angles", "coordinate_geometry", "functions_basics",
    "algebraic_manipulation", "exponent_rules", "factoring_polynomials",
    "number_properties", "basic_probability", "linear_inequalities",
    "systems_of_linear_equations", "polynomial_operations", "absolute_value",
    "complex_numbers", "rational_expressions", "logarithmic_functions", "matrices",
    "combinatorics", "trigonometry_basics", "vectors_basics", "data_interpretation",
]

SYSTEM_PROMPT = f"""You are a math curriculum designer tagging folk tales for adaptive math tutoring.
For the tale provided, output a JSON object with EXACTLY these fields:

{{
  "math_theme_tags": ["..."],          // subset of allowed tags only
  "concept_affinity_scores": {{"...": 0.0}},  // only concept IDs with score > 0.1
  "math_skin_score": 0.0,             // 0-1: how naturally this tale wraps math
  "quality_score": 0.0,               // 0-1: narrative richness/engagement
  "katha_voice_sample": "...",        // ≤80 char opening sentence in warm storyteller voice
  "keywords": ["..."]                 // 5-10 concrete nouns/verbs from the tale
}}

Allowed math_theme_tags (use ONLY these, no others):
{", ".join(ALLOWED_TAGS)}

Allowed concept IDs (only these, no others):
{", ".join(ALLOWED_CONCEPTS)}

For math_skin_score: 1.0 = tale has concrete quantities/objects that map naturally
to math problems. 0.0 = purely abstract narrative with no numeric grounding.

Return ONLY the JSON object, no prose, no markdown fences."""


def build_user_prompt(tale: dict) -> str:
    characters = tale.get("characters") or []
    characters_summary = "; ".join(
        f"{c.get('name', '?')} ({c.get('role', '?')})" for c in characters
    ) or "unspecified"
    return (
        f"Title: {tale.get('title', '')}\n"
        f"Culture: {tale.get('culture', '')}\n"
        f"Setting: {tale.get('setting', '')}\n"
        f"Synopsis: {tale.get('synopsis', '')}\n"
        f"Characters: {characters_summary}\n\n"
        "Tag this tale for math tutoring use."
    )


def _extract_json_object(text: str) -> dict | None:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Strip markdown fences if the model added them anyway.
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass
    # Fall back to the first {...} block found anywhere in the text.
    brace = re.search(r"\{.*\}", text, re.S)
    if brace:
        try:
            return json.loads(brace.group(0))
        except json.JSONDecodeError:
            pass
    return None


def _sanitize_enrichment(raw: dict) -> dict:
    tags = [t for t in raw.get("math_theme_tags", []) if t in ALLOWED_TAGS]
    scores = {
        k: float(v)
        for k, v in (raw.get("concept_affinity_scores", {}) or {}).items()
        if k in ALLOWED_CONCEPTS and isinstance(v, (int, float)) and float(v) > 0.1
    }

    def _clamp01(x, default=0.0):
        try:
            return max(0.0, min(1.0, float(x)))
        except (TypeError, ValueError):
            return default

    keywords = raw.get("keywords", [])
    if not isinstance(keywords, list):
        keywords = []
    keywords = [str(k) for k in keywords][:10]

    voice = str(raw.get("katha_voice_sample", ""))[:80]

    return {
        "math_theme_tags": tags,
        "concept_affinity_scores": scores,
        "math_skin_score": _clamp01(raw.get("math_skin_score"), 0.0),
        "quality_score": _clamp01(raw.get("quality_score"), 0.0),
        "katha_voice_sample": voice,
        "keywords": keywords,
    }


def load_catalog() -> list[dict]:
    if not CATALOG_PATH.exists():
        print(f"[error] catalog not found at {CATALOG_PATH}. Run build_folk_catalog.py first.")
        sys.exit(1)
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_cache() -> dict:
    if CACHE_PATH.exists():
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}


def save_cache(cache: dict) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)
        f.write("\n")


def enrich_tale(tale: dict, dry_run: bool = False) -> dict | None:
    prompt = build_user_prompt(tale)
    if dry_run:
        print(f"--- {tale['id']} ---")
        print("SYSTEM:", SYSTEM_PROMPT[:120], "...")
        print("USER:")
        print(prompt)
        print()
        return None
    try:
        raw_text = complete(prompt, system=SYSTEM_PROMPT, max_tokens=600, temperature=0.4)
    except Exception as exc:  # noqa: BLE001
        print(f"  [warn] LLM call failed for {tale['id']}: {exc}")
        return None
    parsed = _extract_json_object(raw_text)
    if parsed is None:
        print(f"  [warn] could not parse LLM JSON for {tale['id']}, skipping. Raw: {raw_text[:200]!r}")
        return None
    return _sanitize_enrichment(parsed)


def run_batch(batch_size: int, dry_run: bool) -> None:
    catalog = load_catalog()
    cache = load_cache()

    unenriched = [t for t in catalog if not t.get("enriched") and t["id"] not in cache]
    todo = unenriched[:batch_size]
    print(f"Catalog size: {len(catalog)}. Unenriched (and uncached): {len(unenriched)}. "
          f"Processing this batch: {len(todo)}.")

    processed = 0
    for tale in todo:
        enrichment = enrich_tale(tale, dry_run=dry_run)
        if dry_run:
            continue
        if enrichment is None:
            continue
        cache[tale["id"]] = enrichment
        processed += 1
        if processed % 5 == 0:
            save_cache(cache)
            print(f"  ...cached {processed}/{len(todo)} so far")

    if dry_run:
        print(f"--dry-run: printed {len(todo)} prompts, no LLM calls made, no writes.")
        return

    save_cache(cache)
    print(f"Enriched {processed}/{len(todo)} tales this run. Cache now has {len(cache)} entries.")

    write_bank(catalog, cache)


def write_bank(catalog: list[dict], cache: dict) -> None:
    bank = []
    for tale in catalog:
        entry = dict(tale)
        if tale["id"] in cache:
            entry.update(cache[tale["id"]])
            entry["enriched"] = True
        bank.append(entry)

    BANK_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(BANK_PATH, "w", encoding="utf-8") as f:
        json.dump(bank, f, indent=2, ensure_ascii=False)
        f.write("\n")
    enriched_count = sum(1 for t in bank if t.get("enriched"))
    print(f"Wrote {len(bank)} tales to {BANK_PATH} ({enriched_count} enriched).")


def export_top(top_n: int = 100) -> None:
    if not BANK_PATH.exists():
        print(f"[error] {BANK_PATH} not found — run an enrichment batch first.")
        sys.exit(1)
    with open(BANK_PATH, "r", encoding="utf-8") as f:
        bank = json.load(f)

    enriched = [t for t in bank if t.get("enriched") and t.get("math_skin_score") is not None]
    enriched.sort(key=lambda t: t.get("math_skin_score", 0.0), reverse=True)
    top = enriched[:top_n]

    existing = {"_meta": {"version": "1.0", "note": "", "count": 0}, "tales": []}
    if MATH_SKIN_TOP_PATH.exists():
        with open(MATH_SKIN_TOP_PATH, "r", encoding="utf-8") as f:
            existing = json.load(f)

    existing_tales = existing.get("tales", [])
    by_id = {t["id"]: t for t in existing_tales}
    added, updated = 0, 0
    for t in top:
        if t["id"] in by_id:
            updated += 1
        else:
            added += 1
        by_id[t["id"]] = t

    merged_tales = list(by_id.values())
    out = {
        "_meta": {
            "version": "1.0",
            "note": "Seed folk tales for storyMatch.ts — grows via folk_tale_collector.py into ml/data/folk_tales/",
            "count": len(merged_tales),
        },
        "tales": merged_tales,
    }

    MATH_SKIN_TOP_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MATH_SKIN_TOP_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Merged top {len(top)} tales into {MATH_SKIN_TOP_PATH}: "
          f"{added} added, {updated} updated, {len(merged_tales)} total.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--batch", type=int, default=0, help="enrich the next N unenriched tales")
    parser.add_argument("--export-top", action="store_true", help="merge top 100 by math_skin_score into app/src/data/mathSkinTop.json")
    parser.add_argument("--top-n", type=int, default=100, help="how many tales to export with --export-top")
    parser.add_argument("--dry-run", action="store_true", help="print prompts only, no LLM calls, no writes")
    args = parser.parse_args()

    if args.export_top:
        export_top(top_n=args.top_n)
        return

    if args.batch > 0 or args.dry_run:
        run_batch(batch_size=args.batch if args.batch > 0 else 20, dry_run=args.dry_run)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
