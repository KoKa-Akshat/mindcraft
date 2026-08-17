"""Deterministic SymPy oracle for ingredient-first multiple-choice items."""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

import sympy as sp
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

from .models import MisconceptionRule, Problem

INVARIANT_NAMES = (
    "key_satisfies",
    "key_unique",
    "distractor_matches_rule",
    "pairwise_distinct",
    "render_roundtrip",
    "params_nondegenerate",
)
EQUATION_PATTERN = re.compile(r"\\\((.*?)\\\)")
PARSE_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application,)


def equivalent(left: sp.Expr, right: sp.Expr) -> bool:
    try:
        return sp.simplify(left - right) == 0
    except (TypeError, ValueError):
        return False


def format_value(value: sp.Expr) -> str:
    value = sp.factor(value)
    return sp.sstr(value).replace("**", "^")


def _format_equation_side(value: sp.Expr) -> str:
    return format_value(value).replace("*", "")


def parse_value(rendered: str) -> sp.Expr:
    return sp.sympify(rendered.replace("^", "**"), evaluate=True)


def render_equation(problem: Problem) -> str:
    return (
        f"{_format_equation_side(problem.relation.lhs)} = "
        f"{_format_equation_side(problem.relation.rhs)}"
    )


def _parse_equation(rendered: str) -> tuple[sp.Expr, sp.Expr]:
    left, separator, right = rendered.partition("=")
    if not separator:
        raise ValueError("rendered equation has no equals sign")
    locals_ = {"x": sp.Symbol("x")}
    return tuple(
        parse_expr(
            side.strip().replace("^", "**"),
            local_dict=locals_,
            transformations=PARSE_TRANSFORMATIONS,
        )
        for side in (left, right)
    )


@dataclass(frozen=True)
class OracleReport:
    results: dict[str, bool]

    @property
    def passed(self) -> bool:
        return all(self.results.values())

    @property
    def failing(self) -> list[str]:
        return [name for name in INVARIANT_NAMES if not self.results[name]]


def verify(
    problem: Problem,
    key: sp.Expr,
    distractors: Iterable[tuple[MisconceptionRule, sp.Expr]],
    *,
    rendered_choices: Iterable[str],
    rendered_stem: str,
) -> OracleReport:
    distractor_list = list(distractors)
    values = [key, *(value for _, value in distractor_list)]
    residual = sp.simplify(problem.relation.lhs - problem.relation.rhs)

    key_satisfies = equivalent(residual.subs(problem.target, key), sp.Integer(0))
    key_unique = all(
        not equivalent(residual.subs(problem.target, value), sp.Integer(0))
        for _, value in distractor_list
    )
    distractor_matches_rule = all(
        (expected := rule.apply(problem)) is not None and equivalent(value, expected)
        for rule, value in distractor_list
    )
    pairwise_distinct = all(
        not equivalent(left, right)
        for index, left in enumerate(values)
        for right in values[index + 1 :]
    )

    roundtrip = True
    choices = list(rendered_choices)
    if len(choices) != len(values):
        roundtrip = False
    else:
        try:
            roundtrip = all(
                equivalent(value, parse_value(rendered))
                for value, rendered in zip(values, choices, strict=True)
            )
            equations = EQUATION_PATTERN.findall(rendered_stem)
            if len(equations) != 1:
                roundtrip = False
            else:
                left, right = _parse_equation(equations[0])
                roundtrip = roundtrip and equivalent(left, problem.relation.lhs)
                roundtrip = roundtrip and equivalent(right, problem.relation.rhs)
        except (TypeError, ValueError, SyntaxError, sp.SympifyError):
            roundtrip = False

    try:
        solutions = sp.solve(problem.relation, problem.target)
        params_nondegenerate = (
            problem.normalized_coefficient != 0
            and len(solutions) == 1
            and solutions[0].is_finite is not False
            and problem.relation.lhs != problem.relation.rhs
            and all(isinstance(value, int) for value in problem.params.values())
        )
    except (NotImplementedError, TypeError, ValueError):
        params_nondegenerate = False

    return OracleReport(
        {
            "key_satisfies": key_satisfies,
            "key_unique": key_unique,
            "distractor_matches_rule": distractor_matches_rule,
            "pairwise_distinct": pairwise_distinct,
            "render_roundtrip": roundtrip,
            "params_nondegenerate": params_nondegenerate,
        }
    )
