# mindcraft/simulation/synthetic_student.py

import datetime
import random
from datetime import timedelta

from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.events import SessionEvent


class SyntheticStudent:
    """
    A fake student with latent mastery state that evolves based on practice.
    Emits observed events (with noise) that your real system will consume.
    """
    
    def __init__(
        self,
        student_id: str,
        ontology: Ontology,
        ability: float = 0.5,          # base learning rate, [0,1]
        forgetting_rate: float = 0.01,  # daily decay of mastery
        noise_level: float = 0.1,       # performance noise
        preferred_tags: list[str] = None,  # learning style: tags they do well on
    ):
        self.student_id = student_id
        self.ontology = ontology
        self.ability = ability
        self.forgetting_rate = forgetting_rate
        self.noise_level = noise_level
        self.preferred_tags = preferred_tags or []
        
        # Latent true mastery — the simulator knows this, your system doesn't
        self._true_mastery = {c.id: 0.0 for c in ontology.concepts}
        self._current_time = datetime.datetime.today()
    
    def practice(self, concept_id: str, event_type: str) -> SessionEvent:
        """Simulate a practice event and return the observable event."""
        # Check prerequisites — struggling if not met
        prereq_mastery = self._avg_prerequisite_mastery(concept_id)
        
        # Effective learning depends on ability + prerequisites + style match
        style_bonus = self._style_match(concept_id)
        learning_rate = self.ability * (0.3 + 0.7 * prereq_mastery) * (1 + style_bonus)
        
        # Update true mastery
        current = self._true_mastery[concept_id]
        gain = learning_rate * (1 - current) * 0.15  # diminishing returns
        self._true_mastery[concept_id] = min(1.0, current + gain)
        
        # Observed outcome = true mastery + noise
        observed_outcome = self._true_mastery[concept_id] + random.gauss(0, self.noise_level)
        observed_outcome = max(-1, min(1, 2 * observed_outcome - 1))  # map to [-1, 1]
        
        return SessionEvent(
            student_id=self.student_id,
            concept_id=concept_id,
            event_type=event_type,
            outcome=observed_outcome,
            effort=random.uniform(0.3, 1.0),
            duration_minutes=random.uniform(5, 45),
            timestamp=self._current_time,
            exposure_weight=1.0,
        )
    
    def advance_time(self, days: float):
        """Simulate time passing, with forgetting."""
        for concept_id in self._true_mastery:
            decay = self.forgetting_rate * days
            self._true_mastery[concept_id] *= (1 - decay)
        self._current_time += timedelta(days=days)
    
    def _avg_prerequisite_mastery(self, concept_id: str) -> float:
        """Average mastery across prerequisites. Returns 1.0 if no prereqs."""
        prereqs = [e.from_concept for e in self.ontology.edges 
                   if e.to_concept == concept_id and e.relation == "prerequisite"]
        if not prereqs:
            return 1.0
        return sum(self._true_mastery[p] for p in prereqs) / len(prereqs)
    
    def _style_match(self, concept_id: str) -> float:
        """Bonus/penalty based on concept tags vs student preferences."""
        concept = next(c for c in self.ontology.concepts if c.id == concept_id)
        overlap = len(set(concept.tags) & set(self.preferred_tags))
        return 0.1 * overlap