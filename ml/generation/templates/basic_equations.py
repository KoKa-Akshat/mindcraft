"""Seeded templates for the basic-equations pilot."""

from __future__ import annotations

import hashlib
import random
from collections.abc import Mapping

import sympy as sp

from ..models import ParamSpec, Problem, ProblemTemplate

X = sp.Symbol("x")
INVERSE = "basic_equations__inverse_operations"
ISOLATE = "basic_equations__isolate_variable"
BOTH = "basic_equations__do_same_to_both_sides"
BALANCE = "basic_equations__equals_sign_balance"
VERIFY = "basic_equations__solution_verification"


def _problem(
    template: ProblemTemplate, params: Mapping[str, int], relation: sp.Equality
) -> Problem:
    return Problem(
        relation=relation,
        target=X,
        params=dict(params),
        template_id=template.template_id,
        ingredient_ids=template.ingredient_ids,
        level=template.level,
        format=template.format,
    )


def _build_multiplication(params: Mapping[str, int]) -> Problem:
    return _problem(MULTIPLICATION, params, sp.Eq(params["a"] * X, params["d"]))


def _build_affine(params: Mapping[str, int]) -> Problem:
    return _problem(AFFINE, params, sp.Eq(params["a"] * X + params["b"], params["d"]))


def _build_two_sided(params: Mapping[str, int]) -> Problem:
    return _problem(
        TWO_SIDED,
        params,
        sp.Eq(params["a"] * X + params["b"], params["c"] * X + params["d"]),
    )


COMMON = {"a": ParamSpec(2, 9), "d": ParamSpec(-24, 36, (0,))}

MULTIPLICATION = ProblemTemplate(
    template_id="basic_equations__multiplication",
    ingredient_ids=(INVERSE, ISOLATE, BALANCE),
    level=1,
    format="symbolic_expression",
    params=COMMON,
    build=_build_multiplication,
    valid_params=lambda p: p["d"] % p["a"] == 0,
)
AFFINE = ProblemTemplate(
    template_id="basic_equations__affine_one_side",
    ingredient_ids=(INVERSE, BOTH, ISOLATE),
    level=2,
    format="symbolic_expression",
    params={**COMMON, "b": ParamSpec(-12, 12, (0,))},
    build=_build_affine,
    valid_params=lambda p: (p["d"] - p["b"]) % p["a"] == 0,
)
TWO_SIDED = ProblemTemplate(
    template_id="basic_equations__variable_both_sides",
    ingredient_ids=(BALANCE, BOTH, INVERSE, ISOLATE, VERIFY),
    level=3,
    format="symbolic_expression",
    params={**COMMON, "b": ParamSpec(-12, 12, (0,)), "c": ParamSpec(-6, 6, (0,))},
    build=_build_two_sided,
    valid_params=lambda p: p["a"] != p["c"] and (p["d"] - p["b"]) % (p["a"] - p["c"]) == 0,
)

BASIC_EQUATION_TEMPLATES = (MULTIPLICATION, AFFINE, TWO_SIDED)
TEMPLATES_BY_ID = {template.template_id: template for template in BASIC_EQUATION_TEMPLATES}


def _rng(template_id: str, seed: int) -> random.Random:
    digest = hashlib.sha256(f"{template_id}:{seed}".encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


def sample_problem(template: ProblemTemplate, seed: int) -> Problem:
    """Reproducibly sample a valid instance from a template's declared domain."""
    rng = _rng(template.template_id, seed)
    for _ in range(10_000):
        params = {
            name: rng.choice(
                [
                    value
                    for value in range(spec.minimum, spec.maximum + 1)
                    if value not in spec.excluded
                ]
            )
            for name, spec in template.params.items()
        }
        if template.valid_params(params):
            return template.build(params)
    raise RuntimeError(f"could not sample valid params for {template.template_id} seed {seed}")
