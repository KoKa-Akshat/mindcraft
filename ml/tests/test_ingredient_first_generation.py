from __future__ import annotations

import json

import sympy as sp

from generation.ingredient_first import (
    GENERATOR_VERSION,
    generate_one,
    generate_run,
    report_lines,
    write_run,
)
from generation.models import MisconceptionRule, Problem
from generation.oracle import INVARIANT_NAMES, format_value, render_equation, verify
from generation.rules import BASIC_EQUATION_RULES
from generation.templates import BASIC_EQUATION_TEMPLATES, sample_problem


def test_pilot_has_four_rules_not_one_per_ingredient() -> None:
    assert len(BASIC_EQUATION_RULES) == 4
    assert all(
        "basic_equations__solution_verification" not in rule.ingredient_ids
        for rule in BASIC_EQUATION_RULES
    )


def test_templates_are_seeded_and_q_vectors_vary() -> None:
    first = [sample_problem(template, 17) for template in BASIC_EQUATION_TEMPLATES]
    second = [sample_problem(template, 17) for template in BASIC_EQUATION_TEMPLATES]
    assert first == second
    assert {problem.level for problem in first} == {1, 2, 3}
    assert len({problem.ingredient_ids for problem in first}) == 3


def test_generated_item_is_replay_deterministic_and_fully_tagged() -> None:
    template = BASIC_EQUATION_TEMPLATES[1]
    first = generate_one(template, 9)
    second = generate_one(template, 9)
    assert first.item is not None
    assert json.dumps(first.item, sort_keys=True) == json.dumps(second.item, sort_keys=True)
    assert json.dumps(first.provenance, sort_keys=True) == json.dumps(
        second.provenance, sort_keys=True
    )
    assert len(first.item["choices"]) == 4
    assert len(first.item["distractor_taxonomy"]) == 3
    assert all(row["rule_id"] for row in first.item["distractor_taxonomy"])
    assert all(row["failure_signature"] for row in first.item["distractor_taxonomy"])


def test_oracle_key_unique_catches_deliberate_second_right_answer() -> None:
    x = sp.Symbol("x")
    problem = Problem(
        relation=sp.Eq(2 * x, 6),
        target=x,
        params={"a": 2, "d": 6},
        template_id="deliberate-test",
        ingredient_ids=("basic_equations__inverse_operations",),
        level=1,
    )
    bad_rule = MisconceptionRule(
        rule_id="deliberate_two_right_answers",
        ingredient_ids=problem.ingredient_ids,
        failure_signature="substitution",
        student_thinking="test",
        misconception_id="test",
        error_type="test",
        apply=lambda _: sp.Integer(3),
    )
    stem = f"Solve \\({render_equation(problem)}\\) for x."
    report = verify(
        problem,
        sp.Integer(3),
        [(bad_rule, sp.Integer(3))],
        rendered_choices=["3", "3"],
        rendered_stem=stem,
    )
    assert report.results["key_unique"] is False
    assert "key_unique" in report.failing


def test_oracle_uses_value_not_string_distinctness() -> None:
    x = sp.Symbol("x")
    problem = Problem(
        relation=sp.Eq(2 * x, 1),
        target=x,
        params={"a": 2, "d": 1},
        template_id="value-collision-test",
        ingredient_ids=("basic_equations__inverse_operations",),
        level=1,
    )
    collision_rule = MisconceptionRule(
        rule_id="collision",
        ingredient_ids=problem.ingredient_ids,
        failure_signature="substitution",
        student_thinking="test",
        misconception_id="test",
        error_type="test",
        apply=lambda _: sp.Rational(1, 2),
    )
    report = verify(
        problem,
        sp.Rational(1, 2),
        [(collision_rule, sp.Rational(1, 2))],
        rendered_choices=["1/2", "0.5"],
        rendered_stem=f"Solve \\({render_equation(problem)}\\) for x.",
    )
    assert report.results["pairwise_distinct"] is False


def test_default_run_meets_pilot_acceptance_and_writes_sidecars(tmp_path) -> None:
    items, provenance, drops = generate_run(per_template=14)
    assert len(items) == 42
    assert {item["level"] for item in items} == {1, 2, 3}
    assert len({tuple(item["ingredient_ids"]) for item in items}) == 3
    assert all(len(item["distractor_taxonomy"]) == 3 for item in items)
    assert all(row["invariants_passed"] == list(INVARIANT_NAMES) for row in provenance)
    assert all(row["generator_version"] == GENERATOR_VERSION for row in provenance)

    write_run(tmp_path, items, provenance, drops)
    assert len(json.loads((tmp_path / "items.json").read_text())) == 42
    assert len((tmp_path / "provenance.jsonl").read_text().splitlines()) == 42
    assert (tmp_path / "drops.jsonl").exists()
    lines = report_lines(items, drops)
    assert any("Q-vectors: 3 distinct" in line for line in lines)
    assert any("drops by invariant" in line for line in lines)
    assert any("drops by rule_id" in line for line in lines)


def test_rendered_choice_roundtrip_for_rationals() -> None:
    assert format_value(sp.Rational(-3, 4)) == "-3/4"
