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
GENERATED_QUESTIONS_PATH = REPO / "app/src/data/generatedQuestions.json"
APP_COVERAGE_PATH = REPO / "app/src/data/actOntologyCoverage.json"

STATIC_BANK_FILE = "app/src/lib/questionBank.ts"
GENERATED_BANK_FILE = "app/src/data/generatedQuestions.json"

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

    counts: dict[str, dict[int, int]] = {}
    for match in re.finditer(
        r"\{\s*id:'([^']+)',\s*conceptId:'([^']+)',\s*level:([123])",
        source,
    ):
        concept_id = match.group(2)
        level = int(match.group(3))
        counts.setdefault(concept_id, {1: 0, 2: 0, 3: 0})
        counts[concept_id][level] += 1

    return practice_ids, labels, counts


def _parse_generated_questions() -> dict[str, dict[int, int]]:
    if not GENERATED_QUESTIONS_PATH.exists():
        return {}
    data = json.loads(GENERATED_QUESTIONS_PATH.read_text())
    counts: dict[str, dict[int, int]] = {}
    for row in data:
        concept_id = row["conceptId"]
        level = int(row["level"])
        counts.setdefault(concept_id, {1: 0, 2: 0, 3: 0})
        counts[concept_id][level] += 1
    return counts


def _level_row(counts: dict[str, dict[int, int]], concept_id: str) -> dict[int, int]:
    return counts.get(concept_id, {1: 0, 2: 0, 3: 0})


def _question_totals(counts: dict[str, dict[int, int]], concept_id: str) -> dict[str, int | int]:
    row = _level_row(counts, concept_id)
    return {"L1": row[1], "L2": row[2], "L3": row[3], "total": row[1] + row[2] + row[3]}


def _merged_question_totals(
    concept_id: str,
    static_counts: dict[str, dict[int, int]],
    generated_counts: dict[str, dict[int, int]],
    alias: str | None = None,
) -> dict[str, int]:
    static_row = _level_row(static_counts, concept_id)
    if sum(static_row.values()) == 0 and alias:
        static_row = _level_row(static_counts, alias)
    generated_row = _level_row(generated_counts, concept_id)
    merged = {
        1: static_row[1] + generated_row[1],
        2: static_row[2] + generated_row[2],
        3: static_row[3] + generated_row[3],
    }
    return {
        "L1": merged[1],
        "L2": merged[2],
        "L3": merged[3],
        "total": merged[1] + merged[2] + merged[3],
    }


def _question_sources(
    concept_id: str,
    static_counts: dict[str, dict[int, int]],
    generated_counts: dict[str, dict[int, int]],
    alias: str | None = None,
) -> list[dict]:
    sources: list[dict] = []
    direct = _level_row(static_counts, concept_id)
    if sum(direct.values()) > 0:
        sources.append({
            "file": STATIC_BANK_FILE,
            "count": sum(direct.values()),
            "bankConceptId": concept_id,
        })
    elif alias:
        alias_row = _level_row(static_counts, alias)
        if sum(alias_row.values()) > 0:
            sources.append({
                "file": STATIC_BANK_FILE,
                "count": sum(alias_row.values()),
                "bankConceptId": alias,
            })
    generated_row = _level_row(generated_counts, concept_id)
    if sum(generated_row.values()) > 0:
        sources.append({
            "file": GENERATED_BANK_FILE,
            "count": sum(generated_row.values()),
            "bankConceptId": concept_id,
        })
    return sources


def _classify_concept(
    concept_id: str,
    practice_ids: set[str],
    static_counts: dict[str, dict[int, int]],
    generated_counts: dict[str, dict[int, int]],
) -> str:
    in_practice = concept_id in practice_ids
    alias = KNOWN_BANK_ALIASES.get(concept_id)
    totals = _merged_question_totals(concept_id, static_counts, generated_counts, alias)
    static_only = _question_totals(static_counts, concept_id)
    if static_only["total"] == 0 and alias:
        static_only = _question_totals(static_counts, alias)
        if static_only["total"] > 0 and totals["total"] == static_only["total"]:
            return "alias_only"

    if not in_practice and totals["total"] == 0:
        return "ontology_only"
    if in_practice and totals["total"] == 0:
        return "listed_no_questions"
    if totals["total"] > 0 and any(totals[f"L{l}"] == 0 for l in (1, 2, 3)):
        return "partial"
    if totals["total"] > 0:
        return "full"
    return "unknown"


def _build_message(
    concept: dict,
    status: str,
    labels: dict[str, str],
    static_counts: dict[str, dict[int, int]],
    generated_counts: dict[str, dict[int, int]],
) -> str:
    cid = concept["id"]
    name = concept.get("name", cid)
    level = concept.get("level", "?")
    tier = LEVEL_TIERS.get(level, "Ontology curriculum tier.")
    alias = KNOWN_BANK_ALIASES.get(cid)
    totals = _merged_question_totals(cid, static_counts, generated_counts, alias)
    sources = _question_sources(cid, static_counts, generated_counts, alias)
    source_line = (
        " Sources: " + ", ".join(
            f"{s['file']} ({s['count']} as {s['bankConceptId']})" for s in sources
        )
        if sources else " Sources: none."
    )

    if status == "full":
        return (
            f"OK — {cid} ({name}) [{level}]: bank has "
            f"L1={totals['L1']}, L2={totals['L2']}, L3={totals['L3']} questions."
            f"{source_line}"
        )
    if status == "partial":
        missing = [f"L{l}" for l in (1, 2, 3) if totals[f"L{l}"] == 0]
        return (
            f"{PARTIAL_COVERAGE_MESSAGE} [{level}] {cid} ({name}). "
            f"Have L1={totals['L1']}, L2={totals['L2']}, L3={totals['L3']}. Missing: {', '.join(missing)}. "
            f"Tier: {tier}.{source_line}"
        )
    if status == "listed_no_questions":
        return (
            f"{LISTED_NO_QUESTIONS_MESSAGE} [{level}] {cid} ({name}). "
            f"Tier: {tier}"
        )
    if status == "alias_only":
        alias_id = KNOWN_BANK_ALIASES[cid]
        t = _question_totals(static_counts, alias_id)
        return (
            ALIAS_MESSAGE.format(alias=alias_id, alias_label=labels.get(alias_id, alias_id))
            + f" [{level}] ontology id={cid} ({name}). Bank has L1={t['L1']}, L2={t['L2']}, L3={t['L3']}."
            f"{source_line}"
        )
    # ontology_only
    return (
        f"{ONTOLOGY_ONLY_MESSAGE} [{level}] {cid} ({name}). "
        f"Tier: {tier}"
    )


def run_audit() -> dict:
    ontology = json.loads(ONTOLOGY_PATH.read_text())
    qb_source = QUESTION_BANK_PATH.read_text()
    practice_ids, labels, static_counts = _parse_question_bank(qb_source)
    generated_counts = _parse_generated_questions()

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
        cid = concept["id"]
        alias = KNOWN_BANK_ALIASES.get(cid)
        status = _classify_concept(cid, practice_ids, static_counts, generated_counts)
        message = _build_message(concept, status, labels, static_counts, generated_counts)
        entry = {
            "conceptId": cid,
            "name": concept.get("name", cid),
            "ontologyLevel": concept.get("level"),
            "actFrequency": concept.get("act_relevance", {}).get("frequency"),
            "status": status,
            "inPracticeConcepts": cid in practice_ids,
            "questionCounts": _merged_question_totals(cid, static_counts, generated_counts, alias),
            "staticQuestionCounts": _merged_question_totals(cid, static_counts, {}, alias),
            "generatedQuestionCounts": _question_totals(generated_counts, cid),
            "questionSources": _question_sources(cid, static_counts, generated_counts, alias),
            "bankAlias": alias,
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

    static_total = sum(sum(row.values()) for row in static_counts.values())
    generated_total = sum(sum(row.values()) for row in generated_counts.values())

    return {
        "summary": {
            "actTestedConcepts": len(act_tested),
            "practiceConceptSlots": len(practice_ids),
            "staticQuestionsTotal": static_total,
            "generatedQuestionsTotal": generated_total,
            "playableQuestionsTotal": static_total + generated_total,
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
        "actConcepts": report["concepts"],
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
