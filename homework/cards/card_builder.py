"""
cards/card_builder.py

Assembles the final card sequence from the winning agent narrative + visual.
Each card maps to one narrative step and includes:
  - The step content (hint / question / reframe / encouragement)
  - The visual (first visual step gets the Manim gif or SVG; rest get nothing)
  - Metadata for the frontend (type, concept, step number, total)

Cards are self-contained dicts — the frontend renders them without knowing
anything about paths or agents.
"""

from __future__ import annotations
from dataclasses import dataclass
from agents.agent_runner import AgentOutput, NarrativeStep
from orchestrator.orchestrator import OrchestratorOutput


@dataclass
class Card:
    step_number: int
    total_steps: int
    type: str               # question | hint | reframe | encouragement
    concept_chip: str       # human-readable concept label
    content: str            # the actual hint / question text
    visual_type: str        # "gif" | "svg" | "none"
    visual_data: str        # base64 gif, raw SVG, or ""
    is_visual_step: bool    # True = this card has the main visual

    def to_dict(self) -> dict:
        return {
            "step_number":    self.step_number,
            "total_steps":    self.total_steps,
            "type":           self.type,
            "concept_chip":   self.concept_chip,
            "content":        self.content,
            "visual_type":    self.visual_type,
            "visual_data":    self.visual_data,
            "is_visual_step": self.is_visual_step,
        }


def _concept_label(concept_id: str) -> str:
    return concept_id.replace("_", " ").title()


def build_cards(
    orchestrator_output: OrchestratorOutput,
    winning_path: AgentOutput,
    visual: dict | None,
    visual_step_index: int = 0,
) -> list[dict]:
    """
    Build the card sequence.
    visual: {"type": "gif"|"svg", "data": str} or None
    visual_step_index: which step index in the narrative gets the visual
    """
    narrative = winning_path.narrative
    total = len(narrative)
    cards: list[Card] = []

    for i, step in enumerate(narrative):
        is_visual = (visual is not None) and (i == visual_step_index)
        card = Card(
            step_number    = i + 1,
            total_steps    = total,
            type           = step.type,
            concept_chip   = _concept_label(step.concept_addressed),
            content        = step.content,
            visual_type    = visual["type"] if is_visual else "none",
            visual_data    = visual["data"] if is_visual else "",
            is_visual_step = is_visual,
        )
        cards.append(card)

    return [c.to_dict() for c in cards]
