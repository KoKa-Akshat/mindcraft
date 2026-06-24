#!/usr/bin/env python3
"""Build the ACT diagnostic dataset from Akshat's annotated question bank.

Input  : ACT_Question_Bank xlsx ("Question Intelligence" sheet, 450 rows).
Output : ml/data/act/
           act_questions.json    one clean record per annotated question
           act_concept_map.json  topic -> ontology concept_id crosswalk +
                                  ranked "main concepts" for the diagnostic
           act_diagnostic.json    the minimally-invasive diagnostic spec
                                  (concept confidence checks + probe questions)

This does NOT need the embedding model. It reconciles the co-founder's human
topic taxonomy (primary_topic / concept_path / skill_gap_if_wrong) with the
engine ontology (data/ontology_complete.json) so diagnostic events can be
emitted with concept_ids the engine already understands.

Usage:
  python scripts/build_act_diagnostic.py \
      --xlsx "/path/to/ACT_Question_Bank (1).xlsx"
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
ONTOLOGY_PATH = ROOT / "data" / "ontology_complete.json"
OUTPUT_DIR = ROOT / "data" / "act"

# Sentinel concept_id for topics with no ontology home yet (number theory /
# divisibility). Surfaced in the coverage report so the co-founder can decide
# whether to add a concept to the ontology.
GAP = "__ontology_gap__"

# Crosswalk: Akshat's primary_topic label -> (ontology concept_id, match_quality,
# [candidate concept_ids]). "exact" = label matches an ontology concept name;
# "related" = nearest single concept; "broad" = label spans several concepts and
# we pick a representative primary; GAP = no ontology concept exists yet.
TOPIC_TO_CONCEPT: dict[str, tuple[str, str, list[str]]] = {
    "Algebraic Structure and Symbolic Manipulation": (
        "polynomials", "broad",
        ["polynomials", "factoring_polynomials", "rational_expressions",
         "exponent_rules", "radical_expressions", "basic_equations"],
    ),
    "Area and Volume": ("area_volume", "exact", ["area_volume"]),
    "Ratios and Proportions": ("ratios_proportions", "exact", ["ratios_proportions"]),
    "Linear Equations": ("linear_equations", "exact", ["linear_equations"]),
    "Geometry of Circles": ("circles_geometry", "exact", ["circles_geometry"]),
    "Quadratic Equations": ("quadratic_equations", "exact", ["quadratic_equations"]),
    "Units, Measurement, and Dimensional Reasoning": (
        "ratios_proportions", "related", ["ratios_proportions", "fractions_decimals"],
    ),
    "Descriptive Statistics": ("descriptive_statistics", "exact", ["descriptive_statistics"]),
    "Number Properties, Factors, and Divisibility": (
        GAP, "gap", ["factoring_polynomials", "fractions_decimals"],
    ),
    "Basics of Functions": ("functions_basics", "exact", ["functions_basics"]),
    "Basic Probability": ("basic_probability", "exact", ["basic_probability"]),
    "Trigonometry Basics": ("trigonometry_basics", "exact", ["trigonometry_basics"]),
    "Complex Numbers": ("complex_numbers", "exact", ["complex_numbers"]),
    "Logarithmic Functions": ("logarithmic_functions", "exact", ["logarithmic_functions"]),
    "Sequences and Series": ("sequences_series", "exact", ["sequences_series"]),
    "Linear Inequalities": ("linear_inequalities", "exact", ["linear_inequalities"]),
    "Lines and Angles": ("lines_angles", "exact", ["lines_angles"]),
    "Conic Sections": ("conic_sections", "exact", ["conic_sections"]),
    "Matrices": ("matrices", "exact", ["matrices"]),
    "Basic One-Variable Equations": ("basic_equations", "exact", ["basic_equations"]),
    # Long-tail single-question labels from earlier annotation passes.
    "Sequences & Patterns": ("sequences_series", "related", ["sequences_series"]),
    "Rates, Units & Proportional Reasoning": ("ratios_proportions", "related", ["ratios_proportions"]),
    "Algebra: Linear Equations": ("linear_equations", "exact", ["linear_equations"]),
    "Number Theory": (GAP, "gap", ["factoring_polynomials"]),
    "Statistics & Averages": ("descriptive_statistics", "related", ["descriptive_statistics"]),
    "Algebra: Translating Words to Equations": ("linear_equations", "related", ["linear_equations", "basic_equations"]),
    "Inequalities & Number Lines": ("linear_inequalities", "related", ["linear_inequalities"]),
    "Geometry: Similar Triangles & Proportions": ("triangles_congruence", "related", ["triangles_congruence", "ratios_proportions"]),
    "Algebra: Expression Evaluation & Equivalent Forms": ("polynomials", "related", ["polynomials", "basic_equations"]),
    "Geometry: Squares, Area & Right Triangles": ("area_volume", "related", ["area_volume", "right_triangle_geometry"]),
    "Coordinate Geometry: Slope": ("linear_equations", "related", ["linear_equations"]),
    "Geometry: Area & Unit Tiling": ("area_volume", "related", ["area_volume"]),
    "Trigonometry: Right Triangle Ratios": ("right_triangle_geometry", "related", ["right_triangle_geometry", "trigonometry_basics"]),
    "Algebra: Literal Equations & Rearranging Formulas": ("basic_equations", "related", ["basic_equations", "linear_equations"]),
    "Functions: Evaluation & Substitution": ("functions_basics", "related", ["functions_basics"]),
}

CHOICE_COLS = [f"choice_{c}" for c in "ABCDEFGHJK"]


def clean(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def qid(test_number: str, question_number: str, stem: str) -> str:
    base = f"t{test_number or '?'}_q{question_number or '?'}"
    digest = hashlib.sha256(stem.encode("utf-8")).hexdigest()[:6]
    return f"act_{base}_{digest}"


def load_questions(xlsx_path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb["Question Intelligence"]
    rows = list(ws.iter_rows(values_only=True))
    header = [clean(h) or f"col{i}" for i, h in enumerate(rows[0])]
    return [
        dict(zip(header, r))
        for r in rows[1:]
        if any(c is not None for c in r)
    ]


TOP_CONCEPTS = 8           # confidence step stays minimally invasive
PROBES_PER_CONCEPT = 1     # one tracked probe question per concept
ACT_CHOICE_ORDER = "ABCDEFGHJK"
DISPLAY_LABELS = "ABCDE"


def _is_usable_probe(q: dict) -> bool:
    """Reject scraped/broken bank rows unfit for student-facing diagnostics."""
    stem = (q.get("stem") or "").strip()
    if len(stem) < 25:
        return False
    if "value of ?" in stem or stem.endswith(" of ?"):
        return False

    ans = (q.get("correct_answer") or "").strip()
    if not ans or len(ans) > 60:
        return False
    lower = ans.lower()
    if "verify against" in lower or "expression-dependent" in lower:
        return False

    choices = q.get("choices") or {}
    if len(choices) < 4:
        return False
    for val in choices.values():
        v = (val or "").strip()
        if len(v) < 1 or v in ("#", "E.", "D", "E", ".", "-"):
            return False
        if len(v) <= 2 and not any(c.isdigit() for c in v):
            return False
    return True


def _normalize_choices(choices: dict) -> dict:
    """ACT uses A–E on early items and F–K later — always show A–E to students."""
    ordered = sorted(
        choices.items(),
        key=lambda kv: ACT_CHOICE_ORDER.index(kv[0]) if kv[0] in ACT_CHOICE_ORDER else 99,
    )
    return {DISPLAY_LABELS[i]: text for i, (_, text) in enumerate(ordered[:5])}


def _pick_probe(questions: list[dict], concept_id: str, used_ids: set[str]) -> dict | None:
    """Best probe question for a concept: valid stem, A–E choices, clean answer."""
    candidates = [
        q for q in questions
        if q["concept_id"] == concept_id
        and q["id"] not in used_ids
        and _is_usable_probe(q)
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda q: (q["match_quality"] != "exact", len(q["stem"])))
    q = candidates[0]
    used_ids.add(q["id"])
    return {
        "question_id": q["id"],
        "concept_id": concept_id,
        "stem": q["stem"],
        "choices": _normalize_choices(q["choices"]),
        "correct_answer": q["correct_answer"],
        "skill_gap_if_wrong": q["skill_gap_if_wrong"],
        "encouragement_hint": q.get("misconception_risks") or q["skill_gap_if_wrong"],
    }


def build_diagnostic(questions, main_concepts, concept_name) -> dict:
    """The minimally-invasive first-login diagnostic the kitchen world drives.

    Step 1 goals -> Step 2 concept confidence -> Step 3 a few tracked probes.
    Each answer/confidence becomes a POST /learning-event so the engine starts
    building the student's knowledge graph from the very first session.
    """
    top = main_concepts[:TOP_CONCEPTS]

    confidence_concepts = [{
        "concept_id": c["concept_id"],
        "name": c["concept_name"],
        "act_high_priority": c["act_high_priority"],
    } for c in top]

    probes = []
    used_ids: set[str] = set()
    for c in top:
        for _ in range(PROBES_PER_CONCEPT):
            probe = _pick_probe(questions, c["concept_id"], used_ids)
            if probe:
                probes.append(probe)

    return {
        "version": "2026-06-act-v1",
        "subject_id": "math",
        "shown_on": "first_login",
        "intro": {
            "title": "Let Nox cook",
            "body": "A few quick questions so Nox can map what you already know "
                    "and where to focus. This kicks off your learning world.",
        },
        "goals_step": {
            "prompt": "What are you aiming for?",
            "free_text": True,
            "presets": [
                "Hit a target ACT score",
                "Get faster at the math section",
                "Fix specific weak topics",
                "Build confidence from the basics",
            ],
            "stored_as": "users/{uid}.goals",
        },
        "confidence_step": {
            "prompt": "How confident are you with each of these?",
            "note": "Self-report only — no wrong answers here. Tap and move on.",
            "scale": [
                {"value": 0.15, "label": "New to this"},
                {"value": 0.45, "label": "Shaky"},
                {"value": 0.7, "label": "Okay"},
                {"value": 0.95, "label": "Confident"},
            ],
            "concepts": confidence_concepts,
        },
        "probe_step": {
            "prompt": "Quick check — answer what you can, skip what you can't.",
            "questions": probes,
        },
        "event_emission": {
            "endpoint": "POST {ML_BASE}/learning-event",
            "confidence_report": {
                "subject_id": "math",
                "concept_id": "<concept_id>",
                "event_type": "confidence_report",
                "outcome": None,
                "source": "diagnostic",
                "metadata": {"confidence": "<0..1 from scale>", "step": "confidence"},
                "note": "outcome left null so self-report does not pollute mastery; "
                        "confidence stored in metadata as a prior.",
            },
            "probe_answer": {
                "subject_id": "math",
                "concept_id": "<concept_id>",
                "event_type": "answer_submitted",
                "outcome": "<1.0 if correct else 0.0>",
                "duration_ms": "<time on question>",
                "source": "diagnostic",
                "metadata": {"question_id": "<id>", "selected": "<choice>", "step": "probe"},
            },
            "diagnostic_complete": {
                "subject_id": "math",
                "concept_id": "diagnostic",
                "event_type": "diagnostic_complete",
                "source": "diagnostic",
                "metadata": {"concepts_seen": "<int>", "goals": "<text>"},
                "note": "marks first-login diagnostic done; engine can now serve "
                        "/learning-world/math and /recommend.",
            },
        },
    }


def build(xlsx_path: Path) -> None:
    ontology = json.loads(ONTOLOGY_PATH.read_text())
    concept_name = {c["id"]: c.get("name", c["id"]) for c in ontology["concepts"]}
    overlay = ontology.get("act_prep_overlay", {})
    high_priority = set(overlay.get("high_priority_concepts", []))

    raw = load_questions(xlsx_path)

    questions: list[dict] = []
    unmapped_topics: Counter = Counter()
    concept_counts: Counter = Counter()
    gap_topics: Counter = Counter()

    for row in raw:
        topic = clean(row.get("primary_topic"))
        if not topic:
            continue  # only annotated rows feed the diagnostic

        mapping = TOPIC_TO_CONCEPT.get(topic)
        if mapping is None:
            unmapped_topics[topic] += 1
            concept_id, quality, candidates = GAP, "unmapped", []
        else:
            concept_id, quality, candidates = mapping

        if concept_id == GAP:
            gap_topics[topic] += 1
        else:
            concept_counts[concept_id] += 1

        choices = {c[-1]: clean(row.get(c)) for c in CHOICE_COLS if clean(row.get(c))}
        stem = clean(row.get("exact_question_text")) or clean(row.get("question_text_summary"))

        questions.append({
            "id": qid(clean(row.get("test_number")), clean(row.get("question_number")), stem),
            "test_name": clean(row.get("test_name")),
            "question_number": clean(row.get("question_number")),
            "stem": stem,
            "summary": clean(row.get("question_text_summary")),
            "choices": choices,
            "correct_answer": clean(row.get("answer")) or clean(row.get("correct_answer_raw")),
            "primary_topic": topic,
            "secondary_topics": clean(row.get("secondary_topics")),
            "concept_path": clean(row.get("concept_path")),
            "skill_gap_if_wrong": clean(row.get("skill_gap_if_wrong")),
            "misconception_risks": clean(row.get("student_misconception_risks")),
            "difficulty": clean(row.get("raw_difficulty")) or clean(row.get("review_priority")),
            "subject_id": "math",
            "concept_id": concept_id,
            "concept_candidates": candidates,
            "match_quality": quality,
        })

    # ---- concept_map: crosswalk + ranked main concepts ----
    crosswalk = []
    seen = set()
    for topic, (concept_id, quality, candidates) in TOPIC_TO_CONCEPT.items():
        crosswalk.append({
            "primary_topic": topic,
            "concept_id": concept_id,
            "concept_name": concept_name.get(concept_id, "(no ontology concept)"),
            "match_quality": quality,
            "candidate_concept_ids": candidates,
        })
        seen.add(concept_id)

    main_concepts = []
    for concept_id, count in concept_counts.most_common():
        main_concepts.append({
            "concept_id": concept_id,
            "concept_name": concept_name.get(concept_id, concept_id),
            "question_count": count,
            "act_high_priority": concept_id in high_priority,
        })
    # high-priority ACT concepts with no bank questions yet (coverage holes)
    missing_priority = [c for c in high_priority if c not in concept_counts]

    concept_map = {
        "source": "ACT_Question_Bank Question Intelligence sheet",
        "ontology": "data/ontology_complete.json (37 concepts)",
        "annotated_questions": len(questions),
        "crosswalk": crosswalk,
        "main_concepts": main_concepts,
        "act_high_priority_concepts": sorted(high_priority),
        "high_priority_without_questions": sorted(missing_priority),
        "ontology_gaps": {
            "note": "topics with no matching ontology concept; co-founder may add one",
            "topics": dict(gap_topics),
        },
        "unmapped_topics": dict(unmapped_topics),
        "act_question_patterns": overlay.get("question_patterns", []),
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "act_questions.json").write_text(json.dumps(questions, indent=2))
    (OUTPUT_DIR / "act_concept_map.json").write_text(json.dumps(concept_map, indent=2))

    diagnostic = build_diagnostic(questions, main_concepts, concept_name)
    (OUTPUT_DIR / "act_diagnostic.json").write_text(json.dumps(diagnostic, indent=2))

    # ---- report ----
    print(f"Annotated questions processed : {len(questions)}")
    print(f"Distinct ontology concepts hit: {len(concept_counts)} / 37")
    print(f"ACT high-priority covered     : {len(high_priority) - len(missing_priority)} / {len(high_priority)}")
    if missing_priority:
        print(f"  high-priority w/o questions : {sorted(missing_priority)}")
    if gap_topics:
        gap_total = sum(gap_topics.values())
        print(f"Ontology gaps (no concept)    : {gap_total} questions -> {dict(gap_topics)}")
    if unmapped_topics:
        print(f"UNMAPPED topics (fix crosswalk): {dict(unmapped_topics)}")
    print(f"Diagnostic concepts (top {TOP_CONCEPTS}) : {[c['concept_id'] for c in main_concepts[:TOP_CONCEPTS]]}")
    print(f"Probe questions selected      : {len(diagnostic['probe_step']['questions'])}")
    print(f"\nWrote {OUTPUT_DIR}/ act_questions.json, act_concept_map.json, act_diagnostic.json")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--xlsx",
        type=Path,
        default=Path.home() / "Desktop" / "ACT_Question_Bank (1).xlsx",
    )
    args = parser.parse_args()
    if not args.xlsx.exists():
        raise SystemExit(f"xlsx not found: {args.xlsx}")
    build(args.xlsx)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
