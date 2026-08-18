"""Faulty procedures for the basic-equations pilot.

Each function re-executes a corrupted path over ``Problem``. None receives or
derives its value from the oracle's key.
"""

from __future__ import annotations

import sympy as sp

from ..models import MisconceptionRule, Problem


def subtract_coefficient_instead_of_dividing(problem: Problem) -> sp.Expr | None:
    coefficient = problem.normalized_coefficient
    remainder = problem.normalized_constant
    if coefficient in (0, 1, -1):
        return None
    return sp.simplify(remainder - coefficient)


def stop_before_dividing(problem: Problem) -> sp.Expr | None:
    coefficient = problem.normalized_coefficient
    if coefficient in (0, 1, -1):
        return None
    return sp.simplify(problem.normalized_constant)


def change_only_one_side(problem: Problem) -> sp.Expr | None:
    """Remove the left constant without also removing it from the right."""
    left_constant = sp.expand(problem.relation.lhs).subs(problem.target, 0)
    coefficient = problem.normalized_coefficient
    right_constant = sp.expand(problem.relation.rhs).subs(problem.target, 0)
    if left_constant == 0 or coefficient == 0:
        return None
    return sp.simplify(right_constant / coefficient)


def chain_equals_as_running_total(problem: Problem) -> sp.Expr | None:
    """Treat '=' as 'and then', accumulating visible terms into one total."""
    expression = sp.expand(problem.relation.lhs + problem.relation.rhs)
    coefficient_total = expression.coeff(problem.target)
    constant_total = expression.subs(problem.target, 0)
    return sp.simplify(coefficient_total + constant_total)


BASIC_EQUATION_RULES = (
    MisconceptionRule(
        rule_id="mis_rule_inverse_operations__subtracts_coefficient",
        ingredient_ids=("basic_equations__inverse_operations",),
        failure_signature="substitution",
        student_thinking="Multiplication is in the way, so I subtract the coefficient.",
        misconception_id="mis_rule_inverse_operations__subtracts_coefficient",
        error_type="subtracts coefficient instead of dividing",
        apply=subtract_coefficient_instead_of_dividing,
    ),
    MisconceptionRule(
        rule_id="mis_rule_isolate_variable__stops_before_dividing",
        ingredient_ids=("basic_equations__isolate_variable",),
        failure_signature="omission",
        student_thinking="I moved the constant, so the number left is my answer.",
        misconception_id="mis_rule_isolate_variable__stops_before_dividing",
        error_type="stops before eliminating the coefficient",
        apply=stop_before_dividing,
    ),
    MisconceptionRule(
        rule_id="mis_rule_both_sides__changes_one_side_only",
        ingredient_ids=("basic_equations__do_same_to_both_sides",),
        failure_signature="omission",
        student_thinking="I can remove a term from the left without changing the right.",
        misconception_id="mis_rule_both_sides__changes_one_side_only",
        error_type="changes only one side of the equation",
        apply=change_only_one_side,
    ),
    MisconceptionRule(
        rule_id="mis_rule_equals_balance__chains_running_total",
        ingredient_ids=("basic_equations__equals_sign_balance",),
        failure_signature="sequencing",
        student_thinking="The equals sign means keep calculating, so I combine every visible term.",
        misconception_id="mis_rule_equals_balance__chains_running_total",
        error_type="uses equals as a running calculation",
        apply=chain_equals_as_running_total,
    ),
)

RULES_BY_ID = {rule.rule_id: rule for rule in BASIC_EQUATION_RULES}
