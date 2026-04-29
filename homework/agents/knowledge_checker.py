"""
agents/knowledge_checker.py

Scores each agent output against the student's knowledge graph and selects
the winning path. Higher score = better match for THIS student.

Scoring weights (from spec):
  +0.40 per prerequisite concept the student already knows (builds on strengths)
  +0.60 per gap concept addressed (high need = high value)
  +0.50 bonus if path framing matches student's preferred_style

Tie-break: prefer the path with more visual_needed=True steps.
"""

from __future__ import annotations
import logging
from agents.agent_runner import AgentOutput
from students.student_loader import StudentProfile

logger = logging.getLogger(__name__)


def score_path(path_output: AgentOutput, student: StudentProfile) -> float:
    score = 0.0

    for step in path_output.narrative:
        # Reward prerequisites the student already knows
        for prereq in step.assumes_knowledge_of:
            confidence = student.get_confidence(prereq)
            score += confidence * 0.4

        # Reward concepts the student needs to learn (low confidence = high gap score)
        target_confidence = student.get_confidence(step.concept_addressed)
        score += (1.0 - target_confidence) * 0.6

    # Style match bonus
    if path_output.framing == student.preferred_style:
        score += 0.5

    return round(score, 4)


def select_best_path(
    agent_outputs: list[AgentOutput],
    student: StudentProfile,
) -> AgentOutput:
    if not agent_outputs:
        raise ValueError("No agent outputs to select from")

    scored = [(out, score_path(out, student)) for out in agent_outputs]
    for out, sc in scored:
        logger.info("Path %s score=%.4f framing=%s", out.path_id, sc, out.framing)

    best_score = max(sc for _, sc in scored)
    top = [out for out, sc in scored if sc == best_score]

    # Tie-break: more visual steps wins
    winner = max(top, key=lambda o: sum(1 for s in o.narrative if s.visual_needed))
    logger.info("Selected path %s (score=%.4f)", winner.path_id, best_score)
    return winner


def get_most_visual_step(path_output: AgentOutput):
    """Return the step most in need of a visual (first visual step, or step 1 fallback)."""
    visual_steps = [s for s in path_output.narrative if s.visual_needed and s.visual_description]
    if visual_steps:
        # Prefer the conceptual crux — typically the step with the longest description
        return max(visual_steps, key=lambda s: len(s.visual_description))
    return path_output.narrative[0]
