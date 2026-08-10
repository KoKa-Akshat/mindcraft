from __future__ import annotations

import pytest

from generation.coverage import act_tested_concepts, uncovered_concepts
from generation.generate import FORMAT_GUIDE, build_prompt, generate_for
from generation.verify import build_verify_prompt, verify_items
from mindcraft_graph.config import FORMAT_IDS


def test_generation_formats_match_canonical_config() -> None:
    assert set(FORMAT_GUIDE) == set(FORMAT_IDS)


def test_uncovered_selector_targets_act_tested_concepts() -> None:
    tested = set(act_tested_concepts())
    uncovered = uncovered_concepts()

    assert uncovered
    assert set(uncovered) <= tested


def test_prompt_rejects_unknown_format() -> None:
    with pytest.raises(ValueError, match="unknown format"):
        build_prompt("linear_equations", None, 1, "essay", 1)


def test_generate_for_emits_c5_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_complete(prompt: str, system: str | None = None) -> str:
        return """
        {"questions":[{
          "question":"What is x if x + 2 = 5?",
          "choices":["1","2","3","4"],
          "correctIndex":2,
          "explanation":"Subtract 2 from both sides.",
          "hints":["Move the 2 first","Use inverse operations","Check x = 3"]
        }]}
        """

    monkeypatch.setattr("generation.generate.complete", fake_complete)

    [item] = generate_for("linear_equations", None, 1, "symbolic_expression", n=1)
    assert item == {
        "id": "gen-linear_equations-1-symbolic-expression-1",
        "conceptId": "linear_equations",
        "level": 1,
        "question": "What is x if x + 2 = 5?",
        "choices": ["1", "2", "3", "4"],
        "correctIndex": 2,
        "explanation": "Subtract 2 from both sides.",
        "hints": ["Move the 2 first", "Use inverse operations", "Check x = 3"],
        "examTag": "ACT",
        "format": "symbolic_expression",
    }


def test_verify_prompt_hides_correct_index() -> None:
    prompt = build_verify_prompt({
        "question": "What is x if x + 2 = 5?",
        "choices": ["1", "2", "3", "4"],
        "correctIndex": 2,
    })

    assert "correctIndex" not in prompt
    assert "Subtract 2" not in prompt


def test_verify_items_drops_solver_mismatches(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = iter(['{"answerIndex":2}', '{"answerIndex":1}'])

    def fake_complete(
        prompt: str,
        system: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> str:
        return next(calls)

    monkeypatch.setattr("generation.verify.complete", fake_complete)
    items = [
        {
            "id": "keep",
            "question": "What is x if x + 2 = 5?",
            "choices": ["1", "2", "3", "4"],
            "correctIndex": 2,
        },
        {
            "id": "drop",
            "question": "What is x if x + 1 = 5?",
            "choices": ["1", "2", "3", "4"],
            "correctIndex": 3,
        },
    ]

    kept, dropped = verify_items(items, attempts=1)

    assert [item["id"] for item in kept] == ["keep"]
    assert dropped == [{
        "id": "drop",
        "expectedIndex": 3,
        "solverIndex": 1,
        "reason": "solver_disagreed",
    }]
