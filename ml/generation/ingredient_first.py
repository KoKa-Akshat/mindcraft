"""Ingredient-first generation pipeline for the basic-equations pilot."""

from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import pathlib
import sys
from collections import Counter
from dataclasses import dataclass
from typing import Any

import sympy as sp

from .models import MisconceptionRule, Problem, ProblemTemplate
from .oracle import INVARIANT_NAMES, format_value, verify
from .rules import BASIC_EQUATION_RULES
from .skin import DeterministicSkinner, Skinner
from .templates import BASIC_EQUATION_TEMPLATES, sample_problem

GENERATOR_VERSION = "ingredient-first-basic-equations-v1"
CONCEPT_ID = "basic_equations"
DEFAULT_OUTPUT_DIR = (
    pathlib.Path(__file__).resolve().parent.parent / "data" / "generated" / CONCEPT_ID
)


@dataclass
class GenerationResult:
    item: dict[str, Any] | None
    provenance: dict[str, Any] | None
    drop: dict[str, Any] | None


def solve_key(problem: Problem) -> sp.Expr:
    solutions = sp.solve(problem.relation, problem.target)
    if len(solutions) != 1:
        raise ValueError("problem does not have exactly one solution")
    return sp.simplify(solutions[0])


def _stable_int(template_id: str, seed: int, purpose: str) -> int:
    digest = hashlib.sha256(f"{template_id}:{seed}:{purpose}".encode()).digest()
    return int.from_bytes(digest[:8], "big")


def _candidate_rules(problem: Problem, key: sp.Expr) -> list[tuple[MisconceptionRule, sp.Expr]]:
    candidates: list[tuple[MisconceptionRule, sp.Expr]] = []
    q_vector = set(problem.ingredient_ids)
    for rule in BASIC_EQUATION_RULES:
        if q_vector.isdisjoint(rule.ingredient_ids):
            continue
        value = rule.apply(problem)
        if value is None or sp.simplify(value - key) == 0:
            continue
        candidates.append((rule, sp.simplify(value)))
    return candidates


def _choose_distractors(
    problem: Problem, key: sp.Expr, seed: int
) -> list[tuple[MisconceptionRule, sp.Expr]]:
    candidates = _candidate_rules(problem, key)
    combinations = list(itertools.combinations(candidates, 3))
    if not combinations:
        return candidates
    offset = _stable_int(problem.template_id, seed, "rules") % len(combinations)
    for combination in combinations[offset:] + combinations[:offset]:
        values = [key, *(value for _, value in combination)]
        if all(
            sp.simplify(left - right) != 0
            for index, left in enumerate(values)
            for right in values[index + 1 :]
        ):
            return list(combination)
    return candidates[:3]


def _drop(
    problem: Problem,
    seed: int,
    stem: str,
    choices: list[str],
    key: sp.Expr,
    distractors: list[tuple[MisconceptionRule, sp.Expr]],
    failing: list[str],
) -> GenerationResult:
    return GenerationResult(
        item=None,
        provenance=None,
        drop={
            "template_id": problem.template_id,
            "seed": seed,
            "params": dict(problem.params),
            "stem": stem,
            "choices": choices,
            "key": format_value(key),
            "choice_rules": [
                {"rule_id": rule.rule_id, "value": format_value(value)}
                for rule, value in distractors
            ],
            "failing_invariants": failing,
            "generator_version": GENERATOR_VERSION,
        },
    )


def generate_one(
    template: ProblemTemplate, seed: int, skinner: Skinner | None = None
) -> GenerationResult:
    problem = sample_problem(template, seed)
    key = solve_key(problem)
    distractors = _choose_distractors(problem, key, seed)
    rules = tuple(rule for rule, _ in distractors)
    skin = (skinner or DeterministicSkinner()).skin(problem, key, rules)
    canonical_choices = [format_value(key), *(format_value(value) for _, value in distractors)]
    report = verify(
        problem,
        key,
        distractors,
        rendered_choices=canonical_choices,
        rendered_stem=skin.question,
    )

    if len(distractors) != 3:
        return _drop(
            problem,
            seed,
            skin.question,
            canonical_choices,
            key,
            distractors,
            ["insufficient_firing_rules", *report.failing],
        )

    value_by_identity = [(None, key), *distractors]
    rotation = _stable_int(template.template_id, seed, "choices") % 4
    ordered = value_by_identity[rotation:] + value_by_identity[:rotation]
    choices = [format_value(value) for _, value in ordered]
    correct_index = next(index for index, (rule, _) in enumerate(ordered) if rule is None)
    if not report.passed:
        return _drop(problem, seed, skin.question, choices, key, distractors, report.failing)

    taxonomy = []
    choice_rules = []
    for choice_index, (rule, _) in enumerate(ordered):
        if rule is None:
            choice_rules.append({"choice_index": choice_index, "rule_id": None})
            continue
        taxonomy.append(
            {
                "choice_index": choice_index,
                "error_type": rule.error_type,
                "student_thinking": skin.student_thinking[rule.rule_id],
                "misconception_id": rule.misconception_id,
                "rule_id": rule.rule_id,
                "failure_signature": rule.failure_signature,
            }
        )
        choice_rules.append({"choice_index": choice_index, "rule_id": rule.rule_id})

    item_id = f"gen-{CONCEPT_ID}-{template.template_id.rsplit('__', 1)[-1]}-{seed}"
    item = {
        "id": item_id,
        "conceptId": CONCEPT_ID,
        "level": template.level,
        "question": skin.question,
        "choices": choices,
        "correctIndex": correct_index,
        "explanation": skin.explanation,
        "hints": list(skin.hints),
        "examTag": "ACT",
        "format": template.format,
        "ingredient_id": template.ingredient_ids[0],
        "ingredient_ids": list(template.ingredient_ids),
        "storyContext": skin.story_context,
        "storyIntro": skin.story_intro,
        "distractor_taxonomy": taxonomy,
    }
    provenance = {
        "item_id": item_id,
        "template_id": template.template_id,
        "seed": seed,
        "params": dict(problem.params),
        "ingredient_ids": list(template.ingredient_ids),
        "choice_rules": choice_rules,
        "failure_signatures": [
            {"choice_index": row["choice_index"], "failure_signature": row["failure_signature"]}
            for row in taxonomy
        ],
        "invariants_passed": list(INVARIANT_NAMES),
        "generator_version": GENERATOR_VERSION,
    }
    return GenerationResult(item=item, provenance=provenance, drop=None)


def generate_run(
    per_template: int = 16, start_seed: int = 0
) -> tuple[list[dict], list[dict], list[dict]]:
    items: list[dict] = []
    provenance: list[dict] = []
    drops: list[dict] = []
    for template in BASIC_EQUATION_TEMPLATES:
        seed = start_seed
        attempts = 0
        while sum(item["level"] == template.level for item in items) < per_template:
            result = generate_one(template, seed)
            if result.item is not None:
                items.append(result.item)
                provenance.append(result.provenance or {})
            elif result.drop is not None:
                drops.append(result.drop)
            seed += 1
            attempts += 1
            if attempts > per_template * 100:
                raise RuntimeError(
                    f"could not produce {per_template} items for {template.template_id}"
                )
    return items, provenance, drops


def report_lines(items: list[dict], drops: list[dict]) -> list[str]:
    vectors = Counter(tuple(item["ingredient_ids"]) for item in items)
    by_invariant = Counter(invariant for drop in drops for invariant in drop["failing_invariants"])
    by_rule = Counter(
        row["rule_id"] for drop in drops for row in drop["choice_rules"] if row["rule_id"]
    )
    lines = [
        f"kept: {len(items)}; dropped: {len(drops)}",
        f"Q-vectors: {len(vectors)} distinct; largest identical-vector group: {max(vectors.values(), default=0)}",
        "drops by invariant: "
        + (", ".join(f"{k}={v}" for k, v in sorted(by_invariant.items())) or "none"),
        "drops by rule_id: "
        + (", ".join(f"{k}={v}" for k, v in sorted(by_rule.items())) or "none"),
    ]
    return lines


def _write_jsonl(path: pathlib.Path, rows: list[dict]) -> None:
    path.write_text("".join(json.dumps(row, sort_keys=True) + "\n" for row in rows))


def write_run(
    output_dir: pathlib.Path, items: list[dict], provenance: list[dict], drops: list[dict]
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "items.json").write_text(json.dumps(items, indent=2) + "\n")
    _write_jsonl(output_dir / "provenance.jsonl", provenance)
    _write_jsonl(output_dir / "drops.jsonl", drops)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-template", type=int, default=16)
    parser.add_argument("--start-seed", type=int, default=0)
    parser.add_argument("--out-dir", type=pathlib.Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args(argv)
    if args.per_template < 1 or args.start_seed < 0:
        parser.error("--per-template must be positive and --start-seed must be nonnegative")
    items, provenance, drops = generate_run(args.per_template, args.start_seed)
    write_run(args.out_dir, items, provenance, drops)
    for line in report_lines(items, drops):
        print(line)
    print(f"wrote items and sidecars to {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
