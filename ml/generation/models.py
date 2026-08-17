"""Core types for ingredient-first, symbolically verified generation."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Literal

import sympy as sp

FailureSignature = Literal["omission", "substitution", "sequencing", "overgeneralized_rule"]


@dataclass(frozen=True)
class Problem:
    """A fully specified one-variable equation, before choices or prose exist."""

    relation: sp.Equality
    target: sp.Symbol
    params: Mapping[str, int]
    template_id: str
    ingredient_ids: tuple[str, ...]
    level: Literal[1, 2, 3]
    format: str = "symbolic_expression"
    domain: str = "rational"

    @property
    def normalized_coefficient(self) -> sp.Expr:
        expression = sp.expand(self.relation.lhs - self.relation.rhs)
        return expression.coeff(self.target)

    @property
    def normalized_constant(self) -> sp.Expr:
        """Right side of the equivalent equation A*x = R."""
        expression = sp.expand(self.relation.lhs - self.relation.rhs)
        return -expression.subs(self.target, 0)


RuleApply = Callable[[Problem], sp.Expr | None]


@dataclass(frozen=True)
class MisconceptionRule:
    rule_id: str
    ingredient_ids: tuple[str, ...]
    failure_signature: FailureSignature
    student_thinking: str
    misconception_id: str
    error_type: str
    apply: RuleApply = field(repr=False, compare=False)


@dataclass(frozen=True)
class ParamSpec:
    minimum: int
    maximum: int
    excluded: tuple[int, ...] = ()


@dataclass(frozen=True)
class ProblemTemplate:
    template_id: str
    ingredient_ids: tuple[str, ...]
    level: Literal[1, 2, 3]
    format: str
    params: Mapping[str, ParamSpec]
    build: Callable[[Mapping[str, int]], Problem] = field(repr=False, compare=False)
    valid_params: Callable[[Mapping[str, int]], bool] = field(
        repr=False, compare=False, default=lambda _: True
    )
