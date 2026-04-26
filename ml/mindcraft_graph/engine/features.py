# mindcraft_graph/engine/features.py

from dataclasses import dataclass

from mindcraft_graph.models.concept import Ontology, estimate_difficulty
from mindcraft_graph.models.events import SessionEvent


@dataclass
class ConceptProfile:
    """Per-concept feature vector derived from raw events."""
    concept_id: str
    # Raw aggregates
    total_time: float          # sum of duration_minutes
    total_effort: float        # sum of effort
    total_outcome: float       # sum of outcome (signed)
    event_count: int
    difficulty: float = 1.0

    @property
    def avg_outcome(self) -> float:
        if self.event_count == 0:
            return 0.0
        return self.total_outcome / self.event_count

    @property
    def avg_effort(self) -> float:
        if self.event_count == 0:
            return 0.0
        return self.total_effort / self.event_count

    @property
    def avg_time(self) -> float:
        if self.event_count == 0:
            return 0.0
        return self.total_time / self.event_count

    @property
    def strength_score(self) -> float:
        if self.event_count == 0:
            return 0.0
        investment = self.avg_effort * (self.avg_time / 30.0)
        if investment < 0.01:
            return 0.0

        if self.avg_outcome >= 0:
            # Positive: division rewards efficiency (talent)
            # High outcome, low effort = natural strength
            return self.avg_outcome / investment
        else:
            # Negative: multiplication rewards conviction (confirmed weakness)
            # Bad outcome, high effort = genuine struggle
            return self.avg_outcome * investment
    @property
    def adjusted_strength(self) -> float:
        """Strength normalized by concept difficulty."""
        return self.strength_score * self.difficulty

def compute_learning_ability(profiles: dict[str, ConceptProfile]) -> float:
    """
    Global learning ability = average efficiency across all practiced concepts.
    """
    scores = [p.strength_score for p in profiles.values() if p.event_count > 0]
    if not scores:
        return 0.0
    return sum(scores) / len(scores)


def compute_concept_profiles(
    events: list[SessionEvent],
    ontology: Ontology | None = None,
) -> dict[str, ConceptProfile]:
    """Aggregate events into per-concept feature profiles."""
    profiles: dict[str, ConceptProfile] = {}
    difficulty_by_concept: dict[str, float] = {}

    if ontology is not None and ontology.concepts:
        max_order = max(concept.typical_order for concept in ontology.concepts)
        difficulty_by_concept = {
            concept.id: estimate_difficulty(concept, max_order)
            for concept in ontology.concepts
        }

    for event in events:
        cid = event.concept_id
        if cid not in profiles:
            profiles[cid] = ConceptProfile(
                concept_id=cid,
                total_time=0.0,
                total_effort=0.0,
                total_outcome=0.0,
                event_count=0,
                difficulty=difficulty_by_concept.get(cid, 1.0),
            )
        p = profiles[cid]
        p.total_time += event.duration_minutes
        p.total_effort += event.effort
        p.total_outcome += event.outcome
        p.event_count += 1

    return profiles
