#!/usr/bin/env python3
"""Cross-check ACT-tested concepts (Layer 1 ontology) vs static question bank.

Join key: concept_id (snake_case slug). PRACTICE_CONCEPTS labels are informational only.

Usage:
  python ml/scripts/audit_act_ontology_question_bank.py
  python ml/scripts/audit_act_ontology_question_bank.py --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ONTOLOGY_PATH = REPO / "ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
QUESTION_BANK_PATH = REPO / "app/src/lib/questionBank.ts"
APP_COVERAGE_PATH = REPO / "app/src/data/actOntologyCoverage.json"
# Generated question banks (merged at runtime by questionBank.ts; counted here for audit accuracy)
GENERATED_BANK_PATHS = [
    REPO / "app/src/data/generatedQuestions.json",
    REPO / "app/src/data/actMasterQuestionBank.generated.json",
]

# Known legacy id mismatches (ontology id → question bank id with content).
KNOWN_BANK_ALIASES: dict[str, str] = {
    "ratios_proportions": "percent_ratio",
}

LEVEL_TIERS: dict[str, str] = {
    "foundational": (
        "Prerequisite arithmetic, notation, and fluency (fractions, ratios, order of ops). "
        "Many core topics assume these skills."
    ),
    "core": (
        "Standard high-school units directly exercised on ACT Math "
        "(algebra, geometry, stats/probability)."
    ),
    "advanced": (
        "Post-ACT / AP-level topics in the full 42-concept ontology. "
        "None are in the current ACT-tested set of 29."
    ),
    "cross_cutting": (
        "Meta-skills that span topics (representation translation, test strategy). "
        "Often have no single drill topic in a static multiple-choice bank."
    ),
}

ONTOLOGY_ONLY_MESSAGE = (
    'This concept is in the standardized Layer 1 ontology (act_relevance.tested) '
    'but has no matching concept_id in the static question bank. '
    'We do not have static practice questions for this topic yet.'
)

LISTED_NO_QUESTIONS_MESSAGE = (
    'This concept_id is listed in PRACTICE_CONCEPTS but has zero static questions '
    'at levels 1–3. Practice must rely on dynamic question generation or new bank content.'
)

PARTIAL_COVERAGE_MESSAGE = (
    'This concept has static questions at some levels but not all. '
    'Sessions at missing levels need dynamic generation or more bank items.'
)

ALIAS_MESSAGE = (
    'Ontology concept_id does not match the question bank, but a legacy alias may have content: {alias} ({alias_label}).'
)


def _parse_question_bank(source: str) -> tuple[set[str], dict[str, str], dict[str, dict[int, int]]]:
    practice_block = re.search(r"export const PRACTICE_CONCEPTS[\s\S]*?\n\]", source)
    if not practice_block:
        raise RuntimeError("Could not parse PRACTICE_CONCEPTS from questionBank.ts")
    practice_ids = set(re.findall(r"\{\s*id:'([^']+)'", practice_block.group(0)))
    labels = dict(re.findall(r"\{ id:'([^']+)',\s*label:'([^']+)'", source))

    questions: list[tuple[str, int]] = []
    for match in re.finditer(
        r"\{\s*id:'([^']+)',\s*conceptId:'([^']+)',\s*level:([123])",
        source,
    ):
        questions.append((match.group(2), int(match.group(3))))

    counts: dict[str, dict[int, int]] = {}
    for concept_id, level in questions:
        counts.setdefault(concept_id, {1: 0, 2: 0, 3: 0})
        counts[concept_id][level] += 1

    return practice_ids, labels, counts


def _question_totals(counts: dict[str, dict[int, int]], concept_id: str) -> dict[str, int | int]:
    row = counts.get(concept_id, {1: 0, 2: 0, 3: 0})
    return {"L1": row[1], "L2": row[2], "L3": row[3], "total": row[1] + row[2] + row[3]}


def _classify_concept(
    concept_id: str,
    practice_ids: set[str],
    counts: dict[str, dict[int, int]],
) -> str:
    in_practice = concept_id in practice_ids
    totals = _question_totals(counts, concept_id)
    bank_id = concept_id
    alias = KNOWN_BANK_ALIASES.get(concept_id)
    if totals["total"] == 0 and alias:
        totals = _question_totals(counts, alias)
        if totals["total"] > 0:
            return "alias_only"

    if not in_practice and totals["total"] == 0:
        return "ontology_only"
    if in_practice and totals["total"] == 0:
        return "listed_no_questions"
    if totals["total"] > 0 and any(_question_totals(counts, concept_id)[f"L{l}"] == 0 for l in (1, 2, 3)):
        return "partial"
    if totals["total"] > 0:
        return "full"
    return "unknown"


def _build_message(
    concept: dict,
    status: str,
    labels: dict[str, str],
    counts: dict[str, dict[int, int]],
) -> str:
    cid = concept["id"]
    name = concept.get("name", cid)
    level = concept.get("level", "?")
    tier = LEVEL_TIERS.get(level, "Ontology curriculum tier.")

    if status == "full":
        t = _question_totals(counts, cid)
        return (
            f"OK — {cid} ({name}) [{level}]: static bank has "
            f"L1={t['L1']}, L2={t['L2']}, L3={t['L3']} questions."
        )
    if status == "partial":
        t = _question_totals(counts, cid)
        missing = [f"L{l}" for l in (1, 2, 3) if t[f"L{l}"] == 0]
        return (
            f"{PARTIAL_COVERAGE_MESSAGE} [{level}] {cid} ({name}). "
            f"Have L1={t['L1']}, L2={t['L2']}, L3={t['L3']}. Missing: {', '.join(missing)}. "
            f"Tier: {tier}"
        )
    if status == "listed_no_questions":
        return (
            f"{LISTED_NO_QUESTIONS_MESSAGE} [{level}] {cid} ({name}). "
            f"Tier: {tier}"
        )
    if status == "alias_only":
        alias = KNOWN_BANK_ALIASES[cid]
        t = _question_totals(counts, alias)
        return (
            ALIAS_MESSAGE.format(alias=alias, alias_label=labels.get(alias, alias))
            + f" [{level}] ontology id={cid} ({name}). Bank has L1={t['L1']}, L2={t['L2']}, L3={t['L3']}."
        )
    # ontology_only
    return (
        f"{ONTOLOGY_ONLY_MESSAGE} [{level}] {cid} ({name}). "
        f"Tier: {tier}"
    )


def _load_generated_bank_counts(counts: dict[str, dict[int, int]]) -> None:
    """Merge question counts from generated JSON banks into the existing counts dict."""
    for path in GENERATED_BANK_PATHS:
        if not path.exists():
            continue
        data = json.loads(path.read_text())
        # Support both top-level list and {"questions": [...]} wrapper
        questions = data if isinstance(data, list) else data.get("questions", [])
        for q in questions:
            cid = q.get("conceptId", "")
            lvl = q.get("level")
            if cid and lvl in (1, 2, 3):
                counts.setdefault(cid, {1: 0, 2: 0, 3: 0})
                counts[cid][lvl] += 1


def run_audit() -> dict:
    ontology = json.loads(ONTOLOGY_PATH.read_text())
    qb_source = QUESTION_BANK_PATH.read_text()
    practice_ids, labels, counts = _parse_question_bank(qb_source)
    _load_generated_bank_counts(counts)  # add generated + ACT master questions

    act_tested = [c for c in ontology["concepts"] if c.get("act_relevance", {}).get("tested")]
    act_ids = {c["id"] for c in act_tested}

    by_status: dict[str, list[dict]] = {
        "full": [],
        "partial": [],
        "listed_no_questions": [],
        "ontology_only": [],
        "alias_only": [],
    }

    entries = []
    for concept in sorted(act_tested, key=lambda c: (c.get("level", ""), c["id"])):
        status = _classify_concept(concept["id"], practice_ids, counts)
        if status == "ontology_only" and concept["id"] in KNOWN_BANK_ALIASES:
            alias = KNOWN_BANK_ALIASES[concept["id"]]
            if _question_totals(counts, alias)["total"] > 0:
                status = "alias_only"
        message = _build_message(concept, status, labels, counts)
        entry = {
            "conceptId": concept["id"],
            "name": concept.get("name", concept["id"]),
            "ontologyLevel": concept.get("level"),
            "actFrequency": concept.get("act_relevance", {}).get("frequency"),
            "status": status,
            "inPracticeConcepts": concept["id"] in practice_ids,
            "questionCounts": _question_totals(counts, concept["id"]),
            "bankAlias": KNOWN_BANK_ALIASES.get(concept["id"]),
            "message": message,
        }
        entries.append(entry)
        by_status.setdefault(status, []).append(entry)

    bank_not_act = sorted(practice_ids - act_ids)

    level_breakdown = {}
    for level, desc in LEVEL_TIERS.items():
        ids = [c["id"] for c in act_tested if c.get("level") == level]
        level_breakdown[level] = {
            "description": desc,
            "actTestedCount": len(ids),
            "conceptIds": ids,
        }

    return {
        "summary": {
            "actTestedConcepts": len(act_tested),
            "practiceConceptSlots": len(practice_ids),
            "staticQuestionsTotal": sum(
                sum(row.values()) for row in counts.values()
            ),
            "fullCoverage": len(by_status.get("full", [])),
            "partialCoverage": len(by_status.get("partial", [])),
            "listedNoQuestions": len(by_status.get("listed_no_questions", [])),
            "ontologyOnly": len(by_status.get("ontology_only", [])),
            "aliasOnly": len(by_status.get("alias_only", [])),
            "bankConceptsNotActTested": len(bank_not_act),
        },
        "levelTiers": level_breakdown,
        "concepts": entries,
        "bankConceptsNotActTested": bank_not_act,
    }


def _app_coverage_payload(report: dict) -> dict:
    """Slim bundle for the React app (co-founder content gap list)."""
    by_id = {row["conceptId"]: row for row in report["concepts"]}
    gaps = [
        row for row in report["concepts"]
        if row["status"] not in ("full",)
    ]
    return {
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat().replace("+00:00", "Z"),
        "summary": report["summary"],
        "levelTiers": report["levelTiers"],
        "byConceptId": by_id,
        "gapsNeedingContent": gaps,
    }


def _print_human(report: dict) -> None:
    s = report["summary"]
    print("=" * 72)
    print("ACT ONTOLOGY (act_relevance.tested) vs STATIC QUESTION BANK")
    print("=" * 72)
    print(f"ACT-tested concepts:     {s['actTestedConcepts']}")
    print(f"PRACTICE_CONCEPTS slots: {s['practiceConceptSlots']}")
    print(f"Static questions:        {s['staticQuestionsTotal']}")
    print(f"  full coverage:         {s['fullCoverage']}")
    print(f"  partial:               {s['partialCoverage']}")
    print(f"  listed, no questions:  {s['listedNoQuestions']}")
    print(f"  ontology only:         {s['ontologyOnly']}")
    print(f"  legacy alias only:     {s['aliasOnly']}")
    print()

    print("--- ONTOLOGY LEVEL TIERS ---")
    for level, info in report["levelTiers"].items():
        if info["actTestedCount"] == 0 and level == "advanced":
            continue
        print(f"\n{level} ({info['actTestedCount']} ACT-tested)")
        print(f"  {info['description']}")

    for status in ("full", "alias_only", "partial", "listed_no_questions", "ontology_only"):
        group = [c for c in report["concepts"] if c["status"] == status]
        if not group:
            continue
        print()
        print(f"--- {status.upper().replace('_', ' ')} ({len(group)}) ---")
        for row in group:
            print(f"\n• {row['message']}")

    if report["bankConceptsNotActTested"]:
        print()
        print(f"--- IN BANK BUT NOT ACT-TESTED ({len(report['bankConceptsNotActTested'])}) ---")
        print("  " + ", ".join(report["bankConceptsNotActTested"]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Print JSON report to stdout")
    parser.add_argument(
        "--write",
        type=Path,
        default=None,
        help="Write JSON report to file (default: ml/data/act_ontology_question_bank_audit.json)",
    )
    args = parser.parse_args()

    report = run_audit()
    out_path = args.write
    if out_path is None and not args.json:
        out_path = REPO / "ml/data/act_ontology_question_bank_audit.json"

    if out_path:
        out_path.write_text(json.dumps(report, indent=2) + "\n")
        print(f"Wrote {out_path.relative_to(REPO)}", file=sys.stderr)

    APP_COVERAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    APP_COVERAGE_PATH.write_text(
        json.dumps(_app_coverage_payload(report), indent=2) + "\n"
    )
    print(f"Wrote {APP_COVERAGE_PATH.relative_to(REPO)}", file=sys.stderr)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        _print_human(report)

    missing_playable = (
        report["summary"]["fullCoverage"]
        + report["summary"]["partialCoverage"]
        + report["summary"]["aliasOnly"]
    )
    if missing_playable < report["summary"]["actTestedConcepts"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
