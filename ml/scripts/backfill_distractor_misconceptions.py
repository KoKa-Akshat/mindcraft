#!/usr/bin/env python3
"""Backfill Eedi's per-choice misconception IDs into the live question bank.

This is deliberately a mechanical join only. It does not rank questions, call
Firestore, add ``world_feedback``, or alter any question-authored content.
"""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

try:  # Package import (tests and ``python -m``).
    from .promote_questions import (
        EEDI_MIS_PATH,
        EEDI_QUESTIONS_PATH,
        build_numeric_to_name,
        build_train_index,
        enrich_distractor_taxonomy,
    )
except ImportError:  # Direct execution: ``python ml/scripts/...py``.
    from promote_questions import (  # type: ignore[no-redef]
        EEDI_MIS_PATH,
        EEDI_QUESTIONS_PATH,
        build_numeric_to_name,
        build_train_index,
        enrich_distractor_taxonomy,
    )


UNTOUCHED_FIELDS = (
    "question",
    "choices",
    "correctIndex",
    "conceptId",
    "level",
    "format",
    "hints",
    "storyContext",
    "explanation",
    "examTag",
    "misconception_id",
)


def _json_bytes(value: object) -> bytes:
    """Stable byte representation used for before/after invariant checks."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def backfill_questions(
    questions: list[dict],
    train_index: dict[str, dict],
    eedi_mis: dict[str, dict],
    numeric_to_name: dict[int, str] | None = None,
) -> tuple[list[dict], dict[str, int]]:
    """Return an enriched copy plus slot-level fill/skip counts."""
    result = copy.deepcopy(questions)
    stats = {
        "questions": len(result),
        "filled": 0,
        "skipped_existing": 0,
        "unresolved": 0,
        "missing_train_row": 0,
        "minted": 0,
        "unresolvable_permutation": 0,
    }
    numeric_to_name = numeric_to_name or build_numeric_to_name(eedi_mis)

    for before, question in zip(questions, result, strict=True):
        question_id = str(question.get("id", ""))
        choices = question.get("choices")
        correct_index = question.get("correctIndex")
        if not isinstance(choices, list) or not isinstance(correct_index, int):
            raise ValueError(f"{question_id}: invalid choices/correctIndex")
        if not 0 <= correct_index < len(choices):
            raise ValueError(f"{question_id}: correctIndex is outside choices")

        numeric_id = question_id.removeprefix("eedi_")
        train_row = train_index.get(numeric_id)
        if train_row is None:
            stats["missing_train_row"] += 1

        taxonomy = question.get("distractor_taxonomy")
        if taxonomy is None:
            taxonomy = []
            question["distractor_taxonomy"] = taxonomy
        if not isinstance(taxonomy, list):
            raise ValueError(f"{question_id}: distractor_taxonomy is not an array")

        existing_by_index: dict[int, dict] = {}
        for entry in taxonomy:
            if not isinstance(entry, dict) or not isinstance(entry.get("choice_index"), int):
                raise ValueError(f"{question_id}: invalid distractor taxonomy entry")
            choice_index = entry["choice_index"]
            if choice_index == correct_index:
                raise ValueError(f"{question_id}: taxonomy tags the correct answer")
            if choice_index in existing_by_index:
                raise ValueError(f"{question_id}: duplicate taxonomy choice_index {choice_index}")
            existing_by_index[choice_index] = entry

        enriched = enrich_distractor_taxonomy(
            question,
            train_row,
            eedi_mis,
            {},
            {},
            numeric_to_name=numeric_to_name,
            stats=stats,
            add_world_feedback=False,
        )
        question["distractor_taxonomy"] = enriched

        for entry in enriched:
            choice_index = entry["choice_index"]
            misconception_id = entry.get("misconception_id")
            previous_id = existing_by_index.get(choice_index, {}).get("misconception_id")
            if misconception_id and misconception_id == previous_id:
                stats["skipped_existing"] += 1
            elif misconception_id:
                stats["filled"] += 1
            else:
                stats["unresolved"] += 1

        # Assert the build's preservation and correctness invariants before any
        # caller is allowed to write the result.
        for field in UNTOUCHED_FIELDS:
            if _json_bytes(before.get(field)) != _json_bytes(question.get(field)):
                raise AssertionError(f"{question_id}: {field} changed during backfill")
        for entry in question.get("distractor_taxonomy") or []:
            if entry.get("choice_index") == correct_index:
                raise AssertionError(f"{question_id}: taxonomy tags the correct answer")
            emitted_id = entry.get("misconception_id")
            if emitted_id is not None and emitted_id not in eedi_mis:
                raise AssertionError(
                    f"{question_id}: taxonomy contains unknown misconception_id {emitted_id!r}"
                )
            if emitted_id is not None:
                info = eedi_mis[emitted_id]
                if question.get("conceptId") not in info.get("concept_ids", []):
                    raise AssertionError(
                        f"{question_id}: {emitted_id!r} is outside the question concept"
                    )
                if entry.get("error_type") != "misconception":
                    raise AssertionError(f"{question_id}: tagged entry has stale error_type")
                if entry.get("student_thinking") != info.get("eedi_name"):
                    raise AssertionError(f"{question_id}: tagged entry has stale student_thinking")

    return result, stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report counts; write nothing")
    parser.add_argument(
        "--out",
        type=Path,
        default=EEDI_QUESTIONS_PATH,
        help=f"Output path (default: overwrite {EEDI_QUESTIONS_PATH})",
    )
    args = parser.parse_args()

    eedi_mis: dict[str, dict] = json.loads(EEDI_MIS_PATH.read_text(encoding="utf-8"))
    original_eedi_mis = copy.deepcopy(eedi_mis)
    numeric_to_name = build_numeric_to_name(eedi_mis)
    train_index = build_train_index()
    raw = json.loads(EEDI_QUESTIONS_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"{EEDI_QUESTIONS_PATH}: expected a top-level question array")

    enriched, stats = backfill_questions(raw, train_index, eedi_mis, numeric_to_name)
    print(
        f"Backfill summary: {stats['questions']} questions, {stats['filled']} filled, "
        f"{stats['skipped_existing']} skipped (already tagged), "
        f"{stats['unresolved']} unresolved, {stats['minted']} minted, "
        f"{stats['unresolvable_permutation']} unresolvable permutations, "
        f"{stats['missing_train_row']} missing train rows"
    )

    if args.dry_run:
        print("Dry run: wrote nothing")
        return

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(enriched, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {args.out}")
    if eedi_mis != original_eedi_mis:
        EEDI_MIS_PATH.write_text(
            json.dumps(eedi_mis, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"Wrote {EEDI_MIS_PATH}")


if __name__ == "__main__":
    main()
