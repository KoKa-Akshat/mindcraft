#!/usr/bin/env python3
"""Calibrate Layer-1 `population_failure_prior` values from real ASSISTments data.

Workstream A of agent_work/engine/DATA_ENRICHMENT_PLAN.md, extended to combine
TWO ASSISTments releases (2009-2010 "skill builder" + 2012-2013 "school data
with affect predictions") into ONE calibration pass.

Datasets (schemas differ between releases — this script normalizes both):
  * 2009-2010 `skill_builder_data_corrected.csv` — columns include
    `skill_name`, `correct` (0/1 only in this release).
  * 2012-2013 `2012-2013-data-with-predictions-4-final.csv` — columns include
    `skill` (NOT `skill_name`), `correct` (here `correct` also carries partial-
    credit float values like 0.5/0.75/0.25 — these are dropped, same as nulls,
    per the "only 0 or 1" rule). NOTE: some individual skill names in this file
    legitimately contain commas as punctuation (e.g. "Order of Operations
    +,-,/,* () positive reals" — the same skill the 2009-2010 file spells with
    periods). Verified exhaustively (see SKILL_OVERRIDES below) that ALL
    comma-containing values in this column are one of 5 known atomic skill
    names, NOT multi-skill tagging — so the `skill` field is treated as a
    single opaque skill name per row, same as `skill_name`, no splitting.

Rules (per the original spec, now applied to combined evidence):
  * error_rate = 1 - mean(correct), using only rows where correct is 0 or 1
  * evidence is merged at the skill-name level ACROSS datasets first (raw n /
    errors summed), THEN mapped to concepts and aggregated — i.e. one
    calibration over the union of evidence, not two calibrations averaged
  * a skill mapping to k concepts distributes its (combined) evidence evenly
  * per concept: final_prior = sum(error_rate_i * n_i) / sum(n_i) across all
    contributing skills' combined n_i
  * clamp to [0.15, 0.85]
  * apply only when the concept has n >= 500 (distributed) combined
    observations; smaller samples are flagged "insufficient — kept prior"
  * ONLY population_failure_prior.overall changes; every other ontology field
    is preserved byte-for-byte modulo JSON re-serialization (2-space indent)

Usage:
    python3 ml/scripts/calibrate_from_assistments.py \
        --csv data/assistments/skill_builder_data_corrected.csv \
        --csv2012 data/assistments/big2012/2012-2013-data-with-predictions-4-final.csv \
        [--dry-run]           # print diffs, write nothing
        [--report-unmapped]   # print unmapped skill names by frequency

Either dataset file may be absent (both are large + gitignored); a missing
file is skipped with a warning, and calibration proceeds on whatever is
available. Erroring out only if NEITHER dataset is found.

Outputs (real run):
  * mutated ontology JSON (population_failure_prior.overall only)
  * audit report at ml/data/assistments/calibration_report.json (combined
    stats + a per-dataset breakdown per skill for auditability)
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ONTOLOGY_PATH = (
    REPO_ROOT
    / "ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
)
REPORT_PATH = REPO_ROOT / "ml/data/assistments/calibration_report.json"
DEFAULT_CSV_2009 = REPO_ROOT / "data/assistments/skill_builder_data_corrected.csv"
DEFAULT_CSV_2012 = (
    REPO_ROOT / "data/assistments/big2012/2012-2013-data-with-predictions-4-final.csv"
)

MIN_OBSERVATIONS = 500
CLAMP_LO, CLAMP_HI = 0.15, 0.85

# Column names differ between the two ASSISTments releases.
DATASETS = [
    {
        "key": "2009_2010",
        "label": "ASSISTments 2009-2010 skill builder",
        "default_path": DEFAULT_CSV_2009,
        "skill_col": "skill_name",
        "correct_col": "correct",
    },
    {
        "key": "2012_2013",
        "label": "ASSISTments 2012-2013 school data with affect predictions",
        "default_path": DEFAULT_CSV_2012,
        "skill_col": "skill",
        "correct_col": "correct",
    },
]

# ---------------------------------------------------------------------------
# Skill -> concept_id mapping
#
# Matching rule: keys are matched against the lower-cased skill_name with a
# *prefix word boundary* (regex \b + key). Plain substring matching is unsafe:
# "angle" is a substring of "Triangle", so `\bangle` is required. A key may end
# mid-word on purpose (e.g. "probabilit" matches both "probability" and
# "probabilities"). ALL matching keys contribute; the union of their concept
# ids receives the skill's evidence, distributed evenly.
#
# SKILL_OVERRIDES (exact, lower-cased skill name) beats keyword matching and is
# used where substring logic misleads (e.g. "Circle Graph" is a pie chart, not
# circle geometry; "Greatest Common Factor" is not polynomial factoring).
# ---------------------------------------------------------------------------

# Starter table straight from DATA_ENRICHMENT_PLAN.md §A.
STARTER_KEYWORD_MAP: dict[str, list[str]] = {
    "fraction": ["fractions_decimals"],
    "decimal": ["fractions_decimals"],
    "percent": ["ratios_proportions"],
    "ratio": ["ratios_proportions"],
    "proportion": ["ratios_proportions"],
    "scale factor": ["ratios_proportions"],
    "order of operation": ["order_of_operations"],
    "pemdas": ["order_of_operations"],
    "solving equation": ["basic_equations", "linear_equations"],
    "linear equation": ["linear_equations"],
    "linear function": ["linear_equations", "functions_basics"],
    "slope": ["linear_equations"],
    "two-step": ["basic_equations"],
    "one-step": ["basic_equations"],
    "inequalit": ["linear_inequalities"],  # was "inequality"; matches plural
    "system": ["systems_of_linear_equations"],
    "exponent": ["exponent_rules"],
    "power": ["exponent_rules"],
    "polynomial": ["polynomials"],
    "factor": ["factoring_polynomials"],
    "quadratic": ["quadratic_equations"],
    "radical": ["radical_expressions"],
    "square root": ["radical_expressions"],
    "function": ["functions_basics"],
    "probabilit": ["basic_probability"],  # was "probability"; matches plural
    "statistic": ["descriptive_statistics"],
    "mean": ["descriptive_statistics"],
    "median": ["descriptive_statistics"],
    "box and whisker": ["descriptive_statistics"],
    "histogram": ["descriptive_statistics"],
    "scatter": ["descriptive_statistics"],
    "area": ["area_volume"],
    "volume": ["area_volume"],
    "surface area": ["area_volume"],
    "perimeter": ["area_volume"],
    "triangle": ["triangles_congruence", "right_triangle_geometry"],
    "pythagorean": ["right_triangle_geometry"],
    "angle": ["lines_angles"],
    "transformation": ["geometric_transformations"],
    "translation": ["geometric_transformations"],
    "reflection": ["geometric_transformations"],
    "rotation": ["geometric_transformations"],
    "circle": ["circles_geometry"],
    "coordinate": ["lines_angles"],
    "number line": ["number_properties"],
    "integer": ["number_properties"],
    "place value": ["number_properties"],
    "rounding": ["number_properties"],
    "prime": ["number_properties"],
    "divisibility": ["number_properties"],
    "measurement": ["measurement_units"],
    "unit conversion": ["measurement_units"],  # was bare "unit"/"conversion";
    # those hit "Unit Rate" and "Conversion of Fraction Decimals Percents"
    "sequence": ["sequences_series"],
    "pattern": ["sequences_series"],
    "algebraic expression": ["algebraic_manipulation"],
    "simplif": ["algebraic_manipulation"],  # was "simplify"; matches
    # "simplifying"/"simplification"
}

# Extensions from the --dry-run --report-unmapped pass against the real CSV
# (hand-verified against all 110 distinct skill names in the file).
EXTENDED_KEYWORD_MAP: dict[str, list[str]] = {
    "equation solving": ["basic_equations", "linear_equations"],  # ASSISTments
    # phrasing is "Equation Solving ..." not "Solving Equation"; step-count
    # variants are split precisely via SKILL_OVERRIDES below
    "venn": ["descriptive_statistics"],  # Venn Diagram = data interpretation
    "whole numbers": ["number_properties"],  # Add/Sub/Mult Whole Numbers
    "absolute value": ["number_properties"],
    "table": ["descriptive_statistics"],  # "Table" = reading data tables
    "similar figure": ["ratios_proportions"],  # similarity = proportional reasoning
    "counting": ["basic_probability"],  # Counting Methods (no combinatorics
    # concept exists in L1 v2.6; counting is probability-unit content)
    "range": ["descriptive_statistics"],
    "mode": ["descriptive_statistics"],
    "stem and leaf": ["descriptive_statistics"],
    "unit rate": ["ratios_proportions"],
    "rate": ["ratios_proportions"],
    "least common multiple": ["number_properties"],
    "scientific notation": ["exponent_rules"],
    "solving for a variable": ["algebraic_manipulation"],  # literal equations
    "circumference": ["circles_geometry"],
    "estimation": ["number_properties"],
    "real numbers": ["number_properties"],  # Ordering/Computation with Real Numbers
    "congruence": ["triangles_congruence"],
    "algebraic solving": ["algebraic_manipulation"],
    "nets of 3d": ["area_volume"],
    "intercept": ["linear_equations"],
    "midpoint": ["lines_angles"],
    "distributive": ["algebraic_manipulation"],
    # --- round 2: extensions found in the combined 2009-10 + 2012-13 dry run --
    "prism": ["area_volume"],  # Properties/Classification Prism(s) — siblings
    # (Volume Prism, Surface Area (Rectangular) Prism) already map here
    "expression": ["algebraic_manipulation"],  # Picking/Recognizing/Writing
    # Expressions (from choices/diagrams); "Simplifying Expressions..." already
    # hits this same target via "simplif", so no dilution there
    "graph shape": ["functions_basics"],
    "metric": ["measurement_units"],
    "commutative": ["algebraic_manipulation"],
    "associative": ["algebraic_manipulation"],
    "sampling": ["descriptive_statistics"],
    "symbolization": ["algebraic_manipulation"],
    "common multiple": ["number_properties"],  # also matches "Least Common
    # Multiple" (already number_properties) — no dilution, just redundant
    "bar graph": ["descriptive_statistics"],
    "odd and even": ["number_properties"],
    "ruler": ["measurement_units"],
    "elapsed time": ["measurement_units"],
    "properties of numbers": ["number_properties"],
    "distance formula": ["right_triangle_geometry"],  # derives from Pythagorean thm
    "line symmetry": ["geometric_transformations"],
    "combining like terms": ["algebraic_manipulation"],
    "inverse relation": ["functions_basics"],
    "pyramid": ["area_volume"],  # Properties/Classification of Pyramid — sibling
    # of Volume Pyramid / Surface Area Pyramid, already this target
}

# Exact skill-name overrides (lower-cased). Exclusive: keyword matching is
# skipped for these skills. These fix cases where keyword matching is
# actively wrong, verified in the dry-run diff:
SKILL_OVERRIDES: dict[str, list[str]] = {
    # pie charts, NOT circle geometry ("circle" key would pollute 6,208 rows)
    "circle graph": ["descriptive_statistics"],
    # integer arithmetic, NOT polynomial factoring ("factor" key, 5,639 rows)
    "greatest common factor": ["number_properties"],
    # proportional scaling, NOT polynomial factoring ("factor" key)
    "scale factor": ["ratios_proportions"],
    # triangle AREA belongs to area_volume only ("triangle" key would also
    # credit triangles_congruence + right_triangle_geometry, 10,839 rows)
    "area triangle": ["area_volume"],
    # angle-sum fact; not right-triangle work
    "interior angles triangle": ["lines_angles", "triangles_congruence"],
    # polynomial vocabulary; "exponent" keyword hit is incidental
    "parts of a polyomial. terms. coefficient. monomial. exponent. variable": [
        "polynomials"
    ],
    # one/two-step -> basic_equations; multi-step -> linear_equations
    "equation solving two or fewer steps": ["basic_equations"],
    "equation solving more than two steps": ["linear_equations"],
    # source misspells "proportionally"; scaling dimensions of shapes
    "effect of changing dimensions of a shape prportionally": [
        "area_volume",
        "ratios_proportions",
    ],
    # --- 2012-2013 dataset punctuation variants -----------------------------
    # The 2012-2013 file spells these 3 skills with literal commas instead of
    # the 2009-2010 file's periods. Exhaustively verified (raw skill-field
    # scan) that ALL 5 comma-containing values in the 2012-2013 `skill` column
    # are one of these known atomic names — never genuine multi-skill tags —
    # so they're mapped as single opaque strings, same as their period twins.
    "order of operations +,-,/,* () positive reals": ["order_of_operations"],
    "angles - obtuse, acute, and right": ["lines_angles"],
    "parts of a polyomial, terms, coefficient, monomial, exponent, variable": [
        "polynomials"
    ],
    # 2012-2013-only skill (no 2009-2010 counterpart): writing numbers in
    # expanded / standard / word form — place-value representation.
    "expanded, standard and word notation": ["number_properties"],
    # --- round 2 fixes: bug caught in the combined dry run --------------------
    # Both silently matched the "factor" keyword -> factoring_polynomials,
    # which is wrong: these are number-theory skills (integer factors of a
    # number), not polynomial factoring. Same fix pattern as
    # "greatest common factor" above, applied to two more sibling skills that
    # only appear in the 2012-2013 file.
    "common factor": ["number_properties"],
    "prime factor": ["number_properties"],  # was also union-diluted via "prime"
    # --- round 2 additions: new unmapped skills, hand-verified -----------------
    "properties and classification quadrilaterals": ["lines_angles"],
    "properties and classification polygons with 5 or more sides": ["lines_angles"],
    "point plotting": ["lines_angles"],
    "x-y graph reading": ["lines_angles"],
    "line plot": ["descriptive_statistics"],
    "line of best-fit": ["descriptive_statistics"],
    "choose an equation from given information": ["basic_equations", "linear_equations"],
    "substitution": ["systems_of_linear_equations", "algebraic_manipulation"],
    "equal as balance concept": ["basic_equations"],
    "calculation with + - * /": ["order_of_operations"],
    "parallel and perpendicular lines": ["lines_angles", "linear_equations"],
    "definition pi": ["circles_geometry"],
}

KEYWORD_MAP: dict[str, list[str]] = {**STARTER_KEYWORD_MAP, **EXTENDED_KEYWORD_MAP}

_COMPILED = [
    (re.compile(r"\b" + re.escape(key)), concepts)
    for key, concepts in KEYWORD_MAP.items()
]


def map_skill(skill_name: str) -> list[str]:
    """Return the sorted, deduped concept ids for a skill name ([] = unmapped)."""
    s = skill_name.strip().lower()
    if s in SKILL_OVERRIDES:
        return sorted(set(SKILL_OVERRIDES[s]))
    hits: set[str] = set()
    for pattern, concepts in _COMPILED:
        if pattern.search(s):
            hits.update(concepts)
    return sorted(hits)


# ---------------------------------------------------------------------------


def load_skill_stats(
    csv_path: Path, skill_col: str, correct_col: str
) -> tuple[dict[str, dict], int, int, int]:
    """Group rows by skill name -> {n, errors} for one dataset's CSV.

    Returns (stats, total_rows, blank_skill_rows, non_binary_correct_rows).
    `skill_col`/`correct_col` let this same function serve both ASSISTments
    schemas (`skill_name` in 2009-2010 vs `skill` in 2012-2013). No splitting
    on commas: verified the 2012-2013 `skill` column's comma occurrences are
    all internal punctuation in known atomic skill names (see SKILL_OVERRIDES),
    never genuine multi-skill tagging.
    """
    stats: dict[str, dict] = defaultdict(lambda: {"n": 0, "errors": 0})
    total_rows = 0
    blank_skill_rows = 0
    non_binary_rows = 0
    with open(csv_path, encoding="utf-8-sig", errors="replace", newline="") as f:
        for row in csv.DictReader(f):
            total_rows += 1
            correct = (row.get(correct_col) or "").strip()
            if correct not in ("0", "1"):
                non_binary_rows += 1  # nulls + partial-credit floats, dropped
                continue
            skill = (row.get(skill_col) or "").strip()
            if not skill:
                blank_skill_rows += 1
                continue
            stats[skill]["n"] += 1
            if correct == "0":
                stats[skill]["errors"] += 1
    return dict(stats), total_rows, blank_skill_rows, non_binary_rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--csv", type=Path, default=DEFAULT_CSV_2009,
                     help="2009-2010 skill builder CSV path")
    ap.add_argument("--csv2012", type=Path, default=DEFAULT_CSV_2012,
                     help="2012-2013 school-data CSV path")
    ap.add_argument("--ontology", type=Path, default=ONTOLOGY_PATH)
    ap.add_argument("--report", type=Path, default=REPORT_PATH)
    ap.add_argument(
        "--dry-run", action="store_true", help="print diffs without writing anything"
    )
    ap.add_argument(
        "--report-unmapped",
        action="store_true",
        help="print unmapped skill names by frequency",
    )
    args = ap.parse_args()

    paths_by_key = {"2009_2010": args.csv, "2012_2013": args.csv2012}
    active_datasets = []
    for spec in DATASETS:
        path = paths_by_key[spec["key"]]
        if not path.exists():
            print(f"[skip] {spec['label']}: not found at {path}", file=sys.stderr)
            continue
        active_datasets.append({**spec, "path": path})
    if not active_datasets:
        print("No ASSISTments CSVs found (neither 2009-2010 nor 2012-2013). Abort.",
              file=sys.stderr)
        return 1

    ontology = json.loads(args.ontology.read_text(encoding="utf-8"))
    concept_index = {c["id"]: c for c in ontology["concepts"]}

    # Sanity: every mapped concept id must exist in the ontology.
    all_targets = {
        cid
        for concepts in list(KEYWORD_MAP.values()) + list(SKILL_OVERRIDES.values())
        for cid in concepts
    }
    unknown = all_targets - set(concept_index)
    if unknown:
        print(f"Mapping targets missing from ontology: {sorted(unknown)}", file=sys.stderr)
        return 1

    # ---- load + combine evidence across datasets, at the skill-name level ----
    # combined[skill] = {"n": float, "errors": float, "by_dataset": {key: {...}}}
    combined: dict[str, dict] = defaultdict(
        lambda: {"n": 0, "errors": 0, "by_dataset": {}}
    )
    dataset_meta = []
    for spec in active_datasets:
        skill_stats, total_rows, blank_rows, non_binary_rows = load_skill_stats(
            spec["path"], spec["skill_col"], spec["correct_col"]
        )
        for skill, st in skill_stats.items():
            c = combined[skill]
            c["n"] += st["n"]
            c["errors"] += st["errors"]
            c["by_dataset"][spec["key"]] = {
                "rows": st["n"],
                "errors": st["errors"],
                "error_rate": round(st["errors"] / st["n"], 4) if st["n"] else None,
            }
        dataset_meta.append(
            {
                "key": spec["key"],
                "label": spec["label"],
                "path": str(spec["path"]),
                "total_rows": total_rows,
                "rows_with_blank_skill": blank_rows,
                "rows_non_binary_correct": non_binary_rows,
                "distinct_skills": len(skill_stats),
            }
        )

    # Aggregate combined evidence per concept.
    per_concept: dict[str, dict] = defaultdict(
        lambda: {"weighted_error_sum": 0.0, "n": 0.0, "skills": []}
    )
    unmapped: dict[str, int] = {}
    mapped_row_count = 0
    for skill, st in sorted(combined.items(), key=lambda kv: -kv[1]["n"]):
        concepts = map_skill(skill)
        if not concepts:
            unmapped[skill] = st["n"]
            continue
        mapped_row_count += st["n"]
        error_rate = st["errors"] / st["n"]
        share = st["n"] / len(concepts)
        for cid in concepts:
            agg = per_concept[cid]
            agg["weighted_error_sum"] += error_rate * share
            agg["n"] += share
            agg["skills"].append(
                {
                    "skill_name": skill,
                    "rows": st["n"],
                    "error_rate": round(error_rate, 4),
                    "weight": round(share, 1),
                    "by_dataset": st["by_dataset"],
                }
            )

    # Compute new priors + build report entries.
    concept_reports = []
    applied = 0
    for cid in sorted(per_concept):
        agg = per_concept[cid]
        n = agg["n"]
        raw_prior = agg["weighted_error_sum"] / n
        new_prior = round(min(CLAMP_HI, max(CLAMP_LO, raw_prior)), 3)
        old_prior = concept_index[cid]["population_failure_prior"].get("overall")
        sufficient = n >= MIN_OBSERVATIONS
        entry = {
            "concept_id": cid,
            "old_prior": old_prior,
            "new_prior": new_prior if sufficient else old_prior,
            "raw_error_rate": round(raw_prior, 4),
            "clamped": bool(raw_prior < CLAMP_LO or raw_prior > CLAMP_HI),
            "n_observations": round(n, 1),
            "applied": sufficient,
            "reason": "calibrated" if sufficient else "insufficient — kept prior",
            "mapped_skills": agg["skills"],
        }
        concept_reports.append(entry)
        if sufficient:
            applied += 1
            if not args.dry_run:
                concept_index[cid]["population_failure_prior"]["overall"] = new_prior

    untouched = sorted(set(concept_index) - set(per_concept))

    total_rows_all = sum(d["total_rows"] for d in dataset_meta)
    blank_rows_all = sum(d["rows_with_blank_skill"] for d in dataset_meta)
    non_binary_all = sum(d["rows_non_binary_correct"] for d in dataset_meta)

    # ---- console output -----------------------------------------------------
    print("Datasets:")
    for d in dataset_meta:
        print(f"  {d['label']}: {d['total_rows']:,} rows, "
              f"{d['distinct_skills']} distinct skills  ({d['path']})")
    print()
    print(f"Combined raw rows:       {total_rows_all:,}")
    print(f"  blank skill field:     {blank_rows_all:,} (dropped)")
    print(f"  non-binary correct:    {non_binary_all:,} (dropped — nulls + partial credit)")
    print(f"  mapped to concepts:    {mapped_row_count:,.0f}")
    print(f"  unmapped skills:       {len(unmapped)} skills / {sum(unmapped.values()):,.0f} rows")
    print(f"Distinct skills (union): {len(combined)}")
    print(f"Concepts with evidence:  {len(per_concept)} (applied: {applied}, "
          f"insufficient: {len(per_concept) - applied})")
    print(f"Concepts untouched:      {len(untouched)}")
    print()
    print(f"{'concept':35} {'old':>6} {'new':>6} {'raw':>7} {'n':>9}  status")
    for e in concept_reports:
        print(
            f"{e['concept_id']:35} {e['old_prior']:>6} "
            f"{(e['new_prior'] if e['applied'] else '—'):>6} "
            f"{e['raw_error_rate']:>7} {e['n_observations']:>9,.0f}  {e['reason']}"
            + ("  [clamped]" if e["clamped"] and e["applied"] else "")
        )

    if args.report_unmapped:
        print("\nUnmapped skills (by combined row count):")
        for skill, n in sorted(unmapped.items(), key=lambda kv: -kv[1]):
            print(f"{n:7,.0f}  {skill}")

    if args.dry_run:
        print("\n[dry-run] nothing written.")
        return 0

    # ---- writes ---------------------------------------------------------------
    # NOTE: the checked-in ontology file has NO trailing newline — match it so
    # the diff is purely the changed prior values.
    args.ontology.write_text(
        json.dumps(ontology, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    report = {
        "meta": {
            "generated": date.today().isoformat(),
            "script": "ml/scripts/calibrate_from_assistments.py",
            "datasets": dataset_meta,
            "combined_total_rows": total_rows_all,
            "combined_rows_with_blank_skill": blank_rows_all,
            "combined_rows_non_binary_correct": non_binary_all,
            "combined_rows_mapped_to_concepts": round(mapped_row_count),
            "combined_rows_unmapped": round(sum(unmapped.values())),
            "distinct_skills_union": len(combined),
            "min_observations": MIN_OBSERVATIONS,
            "clamp": [CLAMP_LO, CLAMP_HI],
            "concepts_calibrated": applied,
            "concepts_insufficient": len(per_concept) - applied,
            "concepts_untouched": len(untouched),
        },
        "concepts": concept_reports,
        "untouched_concept_ids": untouched,
        "unmapped_skills": [
            {"skill_name": s, "rows": round(n)}
            for s, n in sorted(unmapped.items(), key=lambda kv: -kv[1])
        ],
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"\nWrote ontology: {args.ontology}")
    print(f"Wrote report:   {args.report}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
