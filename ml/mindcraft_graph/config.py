"""Tunable constants for the format-node / reinforcement feature.

Single source of truth — these must NOT be inlined anywhere else (HARD invariant).
Imported by the engine (update path), the API (gap detection), and serve.py.
"""
from __future__ import annotations

# ── Canonical representation / format ("vessel") vocabulary ──────────────────
# Pinned to Layer 4 student_state_schema.representation_profile (the student-side
# of the representation axis; the question-side is
# student_event_schema.input_representation — the SAME axis, verified). The live
# producer (a `format` field on questionBank questions) emits these ids. Format
# nodes are validated against this set before they are minted as mastery keys.
# Forward-compatible: widening to L1 canonical_registries.representation_types
# (13 types) is a config-only change.
FORMAT_IDS: frozenset[str] = frozenset({
    "word_problem",
    "diagram",
    "number_line",
    "symbolic_expression",
    "coordinate_graph",
    "table",
})


# ── outcome_from(score, level): raw pass rate -> signed outcome valence ──────
# Replaces the old binary OUTCOME_MAP {True:(0.6,..), False:(-0.4,..)}.
OUTCOME_ZERO_CROSS = 0.42   # pass rate below this is net-negative evidence
OUTCOME_SLOPE = 1.4
OUTCOME_CLAMP_MIN = -0.5
OUTCOME_CLAMP_MAX = 0.7
# Harder levels earn more credit on success. Failure is level-flat: a miss is a
# miss — don't discount failing an "easy" item (it's still a real gap).
POSITIVE_LEVEL_GAIN = {1: 1.0, 2: 1.15, 3: 1.30}
NEGATIVE_LEVEL_GAIN = {1: 1.0, 2: 1.0, 3: 1.0}


def outcome_from(score: float, level: int = 1) -> float:
    """Map a raw pass rate in [0, 1] to a signed outcome in the clamp range.

    Crosses zero at OUTCOME_ZERO_CROSS so a coin-flip pass rate is ~neutral;
    positive results scale up with level, negatives do not.
    """
    base = (score - OUTCOME_ZERO_CROSS) * OUTCOME_SLOPE
    gain = POSITIVE_LEVEL_GAIN if base >= 0 else NEGATIVE_LEVEL_GAIN
    base *= gain.get(level, 1.0)
    return max(OUTCOME_CLAMP_MIN, min(OUTCOME_CLAMP_MAX, base))


# ── Split of NEGATIVE evidence between concept and format nodes (Logic 1) ────
# A miss is partly "don't know the concept" and partly "can't handle the vessel".
# Positive evidence is NOT split — full credit lands on both nodes.
CONCEPT_SPLIT = 0.4
FORMAT_SPLIT = 0.6


def split_outcome(base: float, has_format: bool) -> tuple[float, float | None]:
    """Split a base outcome into (concept_outcome, format_outcome).

    - No format tag: all to concept, nothing to format.
    - Positive base: full credit to BOTH concept and format.
    - Negative base: split — CONCEPT_SPLIT to concept, FORMAT_SPLIT to format.
    """
    if not has_format:
        return base, None
    if base >= 0:
        return base, base
    return CONCEPT_SPLIT * base, FORMAT_SPLIT * base


# ── Format-gap detection thresholds (Logic 2) ───────────────────────────────
# NOTE: the gradient is INVERTED relative to concept bridges — here the CONCEPT
# is mastered and the FORMAT is weak ("knows the idea, fails the vessel").
GAP_CONCEPT_MASTERED_THRESHOLD = 0.6
GAP_FORMAT_WEAK_THRESHOLD = 0.6
# A format node with at least this many raw attempts is earned evidence (Tier 1);
# fewer is a hypothesis (Tier 2).
GAP_TIER1_MIN_ATTEMPTS = 3
