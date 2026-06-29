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


# ── Per-node session aggregation (replaces the old concept/format split) ─────
# The update is one continuous-score event PER NODE the session touches: the
# concept scored over all questions (k/N), and each format scored over its own
# questions (correct_in_format / count_in_format). A question naturally counts
# toward both its concept and its format denominators, so no artificial split.
#
# Format events are SAMPLE-WEIGHTED: a format seen once is thin evidence, not a
# full session. exposure_weight = min(1, count / FORMAT_EXPOSURE_NORM) — the
# small-denominator guard. Concept events always carry full weight (1.0).
FORMAT_EXPOSURE_NORM = 5.0   # questions of a format for it to count as full evidence


def format_exposure_weight(count: int) -> float:
    """Sample-weight for a format's session event (in (0, 1])."""
    if count <= 0:
        return 0.0
    return min(1.0, count / FORMAT_EXPOSURE_NORM)


# ── Exam mode: deadline budget + concept prioritization ─────────────────────
# Deadline → how many concepts to keep (cram tighter as the exam nears). Tiers
# are predictable for the "panic loop" UX. None deadline = full chain.
def exam_concept_budget(deadline_days: int | None, chain_len: int) -> int:
    """Number of chain concepts to keep given the days-to-exam (prereq-safe trim
    happens in the caller; this is just the count)."""
    if deadline_days is None:
        return chain_len
    if deadline_days <= 3:
        budget = 3
    elif deadline_days <= 7:
        budget = 6
    elif deadline_days <= 14:
        budget = 10
    else:
        return chain_len
    return max(1, min(budget, chain_len))


# Priority score for exam-mode ordering: struggling + high exam-frequency first.
EXAM_W_FREQUENCY = 1.0   # weight on act_relevance.frequency
EXAM_W_STRUGGLE = 0.6    # weight on (1 - mastery)


# ── Format-gap detection thresholds (Logic 2) ───────────────────────────────
# NOTE: the gradient is INVERTED relative to concept bridges — here the CONCEPT
# is mastered and the FORMAT is weak ("knows the idea, fails the vessel").
GAP_CONCEPT_MASTERED_THRESHOLD = 0.6
GAP_FORMAT_WEAK_THRESHOLD = 0.6
# A format node with at least this many raw attempts is earned evidence (Tier 1);
# fewer is a hypothesis (Tier 2).
GAP_TIER1_MIN_ATTEMPTS = 3
# Tier-2 (hypothesis) gap severity is scaled down vs Tier-1 (earned evidence) so
# the worst-weakness comparator trusts observed struggle over guesses.
GAP_HYPOTHESIS_SCALE = 0.5
