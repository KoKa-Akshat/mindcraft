"""Deterministic labels for consecutive worked-step transformations."""

from __future__ import annotations

from dataclasses import dataclass

import sympy as sp

from mindcraft_graph.work_check import ParsedLine


@dataclass(frozen=True)
class StepRule:
    id: str
    label: str
    ingredientIds: list[str]


EQUATION_INGREDIENTS = [
    "basic_equations__do_same_to_both_sides",
    "basic_equations__inverse_operations",
]

RULE_INGREDIENTS: dict[str, list[str]] = {
    "added_to_both_sides": EQUATION_INGREDIENTS,
    "subtracted_from_both_sides": EQUATION_INGREDIENTS,
    "multiplied_both_sides": EQUATION_INGREDIENTS,
    "divided_both_sides": EQUATION_INGREDIENTS,
    "moved_term": EQUATION_INGREDIENTS,
    "isolate_variable": ["basic_equations__isolate_variable"],
    "distributed": ["polynomials__distributive_property"],
    "factored": [
        "polynomials__greatest_common_factor_factoring",
        "factoring_polynomials__gcf_extraction",
    ],
    "combined_like_terms": ["polynomials__like_terms"],
    "squared_both_sides": [],
    "took_sqrt_both_sides": [],
    "rewrote_equivalent": [],
    "unknown_transformation": [],
}


def _rule(rule_id: str, label: str) -> StepRule:
    return StepRule(rule_id, label, list(RULE_INGREDIENTS.get(rule_id, [])))


def _is_constant(expr: sp.Expr) -> bool:
    return not sp.sympify(expr).free_symbols


def _fmt(expr: sp.Expr) -> str:
    return str(sp.simplify(expr))


def _structurally_different(a: sp.Expr, b: sp.Expr) -> bool:
    return str(a) != str(b)


def _same_nonzero_delta(a: sp.Equality, b: sp.Equality) -> StepRule | None:
    left_delta = sp.simplify(b.lhs - a.lhs)
    right_delta = sp.simplify(b.rhs - a.rhs)
    if left_delta == 0 or sp.simplify(left_delta - right_delta) != 0:
        return None
    if left_delta.could_extract_minus_sign():
        return _rule("subtracted_from_both_sides", f"Subtracted {_fmt(-left_delta)} from both sides")
    return _rule("added_to_both_sides", f"Added {_fmt(left_delta)} to both sides")


def _same_nonzero_factor(a: sp.Equality, b: sp.Equality) -> StepRule | None:
    try:
        left_factor = sp.simplify(b.lhs / a.lhs)
        right_factor = sp.simplify(b.rhs / a.rhs)
    except Exception:
        return None
    if (
        left_factor == 0
        or sp.simplify(left_factor - right_factor) != 0
        or not _is_constant(left_factor)
    ):
        return None
    if sp.simplify(left_factor - 1) == 0:
        return None
    if sp.Abs(left_factor).is_number and abs(float(left_factor)) < 1:
        return _rule("divided_both_sides", f"Divided both sides by {_fmt(1 / left_factor)}")
    return _rule("multiplied_both_sides", f"Multiplied both sides by {_fmt(left_factor)}")


def _moved_term(a: sp.Equality, b: sp.Equality) -> StepRule | None:
    left_delta = sp.simplify(b.lhs - a.lhs)
    right_delta = sp.simplify(b.rhs - a.rhs)
    if left_delta != 0 and right_delta != 0 and sp.simplify(left_delta + right_delta) == 0:
        return _rule("moved_term", "Moved a term across the equals sign")
    return None


def _side_rewrite(prev: sp.Expr, cur: sp.Expr) -> StepRule | None:
    if _structurally_different(prev, cur) and sp.simplify(cur - sp.expand(prev)) == 0 and str(cur) == str(sp.expand(prev)):
        return _rule("distributed", "Distributed an expression")
    if (
        sp.simplify(prev - cur) == 0
        and sp.count_ops(cur) < sp.count_ops(prev)
        and str(cur) == str(sp.simplify(prev))
    ):
        return _rule("combined_like_terms", "Combined like terms")
    if _structurally_different(prev, cur) and sp.simplify(cur - sp.factor(prev)) == 0 and str(cur) == str(sp.factor(prev)):
        return _rule("factored", "Factored an expression")
    return None


def _expression_rule(prev: sp.Expr, cur: sp.Expr) -> StepRule | None:
    return _side_rewrite(prev, cur)


def _equation_rewrite(a: sp.Equality, b: sp.Equality) -> StepRule | None:
    for detector in (_same_nonzero_delta, _same_nonzero_factor, _moved_term):
        found = detector(a, b)
        if found is not None:
            return found
    if sp.simplify(b.lhs - a.lhs**2) == 0 and sp.simplify(b.rhs - a.rhs**2) == 0:
        return _rule("squared_both_sides", "Squared both sides")
    if sp.simplify(b.lhs**2 - a.lhs) == 0 and sp.simplify(b.rhs**2 - a.rhs) == 0:
        return _rule("took_sqrt_both_sides", "Took the square root of both sides")
    for prev_side, cur_side in ((a.lhs, b.lhs), (a.rhs, b.rhs)):
        found = _side_rewrite(prev_side, cur_side)
        if found is not None:
            return found
    if len(b.free_symbols) == 1 and (b.lhs in b.free_symbols or b.rhs in b.free_symbols):
        return _rule("isolate_variable", "Isolated the variable")
    return None


def classify_step_rule(prev: ParsedLine, cur: ParsedLine, *, equivalent: bool) -> StepRule:
    found: StepRule | None = None
    if prev.equation is not None and cur.equation is not None:
        found = _equation_rewrite(prev.equation, cur.equation)
    elif prev.expr is not None and cur.expr is not None:
        found = _expression_rule(prev.expr, cur.expr)
    if found is not None:
        return found
    if equivalent:
        return _rule("rewrote_equivalent", "Rewrote the expression equivalently")
    return _rule("unknown_transformation", "Unknown transformation")
