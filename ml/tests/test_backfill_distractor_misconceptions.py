import copy
import json
from pathlib import Path
import sys

import pytest

ML_ROOT = Path(__file__).resolve().parents[1]
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from scripts.backfill_distractor_misconceptions import backfill_questions
from scripts.promote_questions import build_numeric_to_name, build_train_index


MISCONCEPTIONS = {
    "mis_a": {"eedi_misconception_id": 1, "eedi_name": "Error A", "concept_ids": ["concept"]},
    "mis_b": {"eedi_misconception_id": 2, "eedi_name": "Error B", "concept_ids": ["concept"]},
}


def _question() -> dict:
    return {
        "id": "eedi_10",
        "conceptId": "concept",
        "question": "Question text",
        "choices": ["A", "B", "C", "D"],
        "correctIndex": 0,
        "explanation": "Explanation",
        "hints": ["Hint"],
        "format": "symbolic_expression",
        "storyContext": "Story",
        "distractor_taxonomy": [
            {"choice_index": 1, "error_type": "x", "misconception_id": "mis_a"},
            {"choice_index": 2, "error_type": "y", "misconception_id": None},
            {"choice_index": 3, "error_type": "z", "misconception_id": None},
        ],
    }


def test_backfill_fills_only_empty_ids_and_is_idempotent() -> None:
    original = _question()
    train = {"10": _train([None, 1, 2, None])}

    once, stats = backfill_questions([original], train, MISCONCEPTIONS)

    assert stats["filled"] == 1
    assert stats["skipped_existing"] == 1
    assert original == _question()  # input was not mutated
    assert once[0]["distractor_taxonomy"][0]["misconception_id"] == "mis_a"
    assert once[0]["distractor_taxonomy"][1]["misconception_id"] == "mis_b"
    assert once[0]["distractor_taxonomy"][2]["misconception_id"] is None
    assert {k: once[0][k] for k in original if k != "distractor_taxonomy"} == {
        k: original[k] for k in original if k != "distractor_taxonomy"
    }

    twice, second_stats = backfill_questions(once, train, MISCONCEPTIONS)
    assert twice == once
    assert second_stats["filled"] == 0


def test_backfill_corrects_an_existing_id_when_source_disagrees() -> None:
    question = _question()
    train = {"10": _train([None, 2, None, None])}

    enriched, _ = backfill_questions([question], train, MISCONCEPTIONS)

    assert enriched[0]["distractor_taxonomy"][0]["misconception_id"] == "mis_b"


def _train(ids: list[int | None], choices: list[str] | None = None, correct: str = "A") -> dict:
    return {
        "correct": correct,
        "choices": choices or ["A", "B", "C", "D"],
        "misconception_numeric_ids": ids,
    }


def test_backfill_resolves_an_explicit_choice_permutation() -> None:
    question = _question()
    question["choices"] = ["B", "A", "C", "D"]
    question["correctIndex"] = 1
    question["distractor_taxonomy"] = [
        {"choice_index": 0, "misconception_id": None},
        {"choice_index": 2, "misconception_id": None},
        {"choice_index": 3, "misconception_id": None},
    ]

    enriched, stats = backfill_questions(
        [question], {"10": _train([None, 1, 2, None])}, copy.deepcopy(MISCONCEPTIONS)
    )

    by_index = {entry["choice_index"]: entry for entry in enriched[0]["distractor_taxonomy"]}
    assert by_index[0]["misconception_id"] == "mis_a"
    assert by_index[2]["misconception_id"] == "mis_b"
    assert stats["unresolvable_permutation"] == 0


def test_backfill_mints_in_the_question_concept_and_derives_fields() -> None:
    misconceptions = copy.deepcopy(MISCONCEPTIONS)
    enriched, stats = backfill_questions(
        [_question()],
        {"10": _train([None, 9, None, None])},
        misconceptions,
        {9: "Adds instead of subtracting"},
    )

    entry = enriched[0]["distractor_taxonomy"][0]
    slug = "mis_concept__adds_instead_subtracting"
    assert entry == {
        "choice_index": 1,
        "error_type": "misconception",
        "misconception_id": slug,
        "student_thinking": "Adds instead of subtracting",
    }
    assert misconceptions[slug]["concept_ids"] == ["concept"]
    assert stats["minted"] == 1


def test_backfill_uses_concept_scoped_numeric_ids() -> None:
    misconceptions = {
        "mis_alpha": {"eedi_misconception_id": 7, "eedi_name": "Same error", "concept_ids": ["alpha"]},
        "mis_beta": {"eedi_misconception_id": 7, "eedi_name": "Same error", "concept_ids": ["beta"]},
    }
    question = _question()
    question["conceptId"] = "alpha"
    question["distractor_taxonomy"][0]["misconception_id"] = None

    enriched, _ = backfill_questions(
        [question], {"10": _train([None, 7, None, None])}, misconceptions
    )

    assert enriched[0]["distractor_taxonomy"][0]["misconception_id"] == "mis_alpha"


def test_backfill_rejects_taxonomy_on_correct_answer() -> None:
    question = copy.deepcopy(_question())
    question["distractor_taxonomy"].append(
        {"choice_index": 0, "error_type": "x", "misconception_id": None}
    )
    with pytest.raises(ValueError, match="tags the correct answer"):
        backfill_questions(
            [question],
            {"10": _train([None, None, None, None])},
            MISCONCEPTIONS,
        )


def test_generated_bank_has_no_cross_concept_tags() -> None:
    root = Path(__file__).resolve().parents[2]
    questions = json.loads((root / "app/src/data/eediQuestions.json").read_text())
    misconceptions = json.loads((root / "ml/data/eedi_misconceptions.json").read_text())
    tagged = [
        (question, entry)
        for question in questions
        for entry in question.get("distractor_taxonomy") or []
        if entry.get("misconception_id")
    ]

    assert len(tagged) == 3835
    for question, entry in tagged:
        info = misconceptions[entry["misconception_id"]]
        assert question["conceptId"] in info["concept_ids"]
        assert entry["choice_index"] != question["correctIndex"]
        assert entry["error_type"] == "misconception"
        assert entry["student_thinking"] == info["eedi_name"]


def test_real_train_index_uses_numeric_source_ids() -> None:
    train_index = build_train_index()
    assert len(train_index) == 1869
    assert all("misconception_numeric_ids" in row for row in train_index.values())
    assert build_numeric_to_name(MISCONCEPTIONS)[1]
