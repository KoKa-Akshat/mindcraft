"""Deterministic worked-step checker for transcribed ink lines.

This is intentionally conservative: parsing failures are `unparsed`, never
wrong. A line is flagged only when both it and its predecessor parse cleanly and
the transformation is not algebraically equivalent.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

import sympy as sp
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

Verdict = Literal["ok", "wrong", "unparsed"]

_TRANSFORMS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)
_SYMBOLS = {name: sp.Symbol(name) for name in "abcdefghijklmnopqrstuvwxyz"}
_LOCAL_DICT = {
    **_SYMBOLS,
    "sqrt": sp.sqrt,
    "pi": sp.pi,
    "e": sp.E,
}


@dataclass
class ParsedLine:
    raw: str
    normalized: str
    expr: sp.Expr | None = None
    equation: sp.Equality | None = None
    error: str | None = None


def _strip_delimiters(text: str) -> str:
    s = text.strip()
    if s.startswith("$$") and s.endswith("$$"):
        return s[2:-2].strip()
    if s.startswith("$") and s.endswith("$"):
        return s[1:-1].strip()
    if s.startswith(r"\(") and s.endswith(r"\)"):
        return s[2:-2].strip()
    if s.startswith(r"\[") and s.endswith(r"\]"):
        return s[2:-2].strip()
    return s


def _replace_frac(s: str) -> str:
    pattern = re.compile(r"\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}")
    while True:
        next_s = pattern.sub(r"((\1)/(\2))", s)
        if next_s == s:
            return s
        s = next_s


def _replace_sqrt(s: str) -> str:
    return re.sub(r"\\sqrt\s*\{([^{}]+)\}", r"sqrt(\1)", s)


def normalize_latex(text: str) -> str:
    s = _strip_delimiters(text)
    s = s.replace("−", "-").replace("–", "-").replace("×", "*").replace("÷", "/")
    s = s.replace(r"\left", "").replace(r"\right", "")
    s = s.replace(r"\cdot", "*").replace(r"\times", "*").replace(r"\div", "/")
    s = s.replace(r"\pi", "pi")
    s = _replace_frac(s)
    s = _replace_sqrt(s)
    s = re.sub(r"\\[a-zA-Z]+", "", s)
    s = s.replace("{", "(").replace("}", ")")
    s = s.replace("^", "**")
    s = re.sub(r"\s+", "", s)
    return s


def _parse_expr(text: str) -> sp.Expr:
    return parse_expr(
        text,
        local_dict=_LOCAL_DICT,
        transformations=_TRANSFORMS,
        evaluate=False,
    )


def parse_line(text: str) -> ParsedLine:
    normalized = normalize_latex(text)
    if not normalized:
        return ParsedLine(raw=text, normalized=normalized, error="empty")

    if normalized.count("=") == 1:
        left, right = normalized.split("=")
        try:
            return ParsedLine(
                raw=text,
                normalized=normalized,
                equation=sp.Eq(_parse_expr(left), _parse_expr(right)),
            )
        except Exception as exc:
            return ParsedLine(raw=text, normalized=normalized, error=str(exc))

    if "=" in normalized:
        return ParsedLine(raw=text, normalized=normalized, error="multiple equals")

    try:
        return ParsedLine(raw=text, normalized=normalized, expr=_parse_expr(normalized))
    except Exception as exc:
        return ParsedLine(raw=text, normalized=normalized, error=str(exc))


def _equation_delta(eq: sp.Equality) -> sp.Expr:
    return sp.simplify(eq.lhs - eq.rhs)


def _equivalent_equations(a: sp.Equality, b: sp.Equality) -> bool:
    da = _equation_delta(a)
    db = _equation_delta(b)
    if sp.simplify(da - db) == 0:
        return True

    # Algebraic equation transformations often multiply/divide both sides by a
    # nonzero constant. `2*x - 6 = 0` and `x - 3 = 0` should be equivalent.
    try:
        ratio = sp.simplify(da / db)
        if ratio.free_symbols:
            return False
        return ratio != 0
    except Exception:
        return False


def equivalent_steps(prev: ParsedLine, cur: ParsedLine) -> bool | None:
    if prev.error or cur.error:
        return None
    if prev.equation is not None and cur.equation is not None:
        return _equivalent_equations(prev.equation, cur.equation)
    if prev.expr is not None and cur.expr is not None:
        return sp.simplify(prev.expr - cur.expr) == 0
    return None


def check_work_lines(lines: list[str]) -> dict:
    from mindcraft_graph.step_rules import classify_step_rule

    parsed = [parse_line(line) for line in lines]
    verdicts: list[dict] = []
    first_broken: int | None = None

    for idx, item in enumerate(parsed):
        if item.error:
            verdict: Verdict = "unparsed"
            reason = item.error
        elif idx == 0:
            verdict = "ok"
            reason = "baseline"
        else:
            eq = equivalent_steps(parsed[idx - 1], item)
            if eq is None:
                verdict = "unparsed"
                reason = "could not compare consecutive lines"
            elif eq:
                verdict = "ok"
                reason = "equivalent transformation"
            else:
                verdict = "wrong"
                reason = "not equivalent to previous line"
                if first_broken is None:
                    first_broken = idx

        item_verdict = {
            "line": idx,
            "latex": item.raw,
            "normalized": item.normalized,
            "verdict": verdict,
            "reason": reason,
        }
        if idx > 0 and verdict in ("ok", "wrong") and not parsed[idx - 1].error and not item.error:
            item_verdict["rule"] = classify_step_rule(
                parsed[idx - 1],
                item,
                equivalent=(verdict == "ok"),
            ).__dict__
        verdicts.append(item_verdict)

    hypothesis = None
    if first_broken is not None:
        hypothesis = {
            "misconception_id": "mis_step_transformation_not_equivalent",
            "label": "This step may have changed the value of the expression instead of preserving it.",
        }

    return {
        "firstBrokenLine": first_broken,
        "verdictPerLine": verdicts,
        "hypothesis": hypothesis,
    }
