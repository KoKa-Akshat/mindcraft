# ml/scripts/test_update.py
import pathlib
from datetime import datetime
from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.student_state import StudentState
from mindcraft_graph.simulation import SyntheticStudent, generate_study_trajectory
from mindcraft_graph.engine.update import update_student_state

ONTOLOGY_PATH = pathlib.Path(__file__).parent.parent / "data" / "ontology.json"
ontology = Ontology.model_validate_json(ONTOLOGY_PATH.read_text())

# Simulate
student = SyntheticStudent("alice", ontology, ability=0.6,
                           preferred_tags=["algebra", "procedural"])
events = generate_study_trajectory(student, days=60, sessions_per_week=3)
print(f"Generated {len(events)} events")

# Initialize empty student state
state = StudentState(
    student_id="alice",
    mastery_by_concept={},
    created_at=datetime.now(),
    updated_at=datetime.now(),
)

# Run the update engine
state = update_student_state(state, events)

# Inspect
print(f"\nTracked {len(state.mastery_by_concept)} concepts")
print("\nTop 5 by mastery:")
top = sorted(state.mastery_by_concept.values(), key=lambda c: -c.mastery)[:5]
for cm in top:
    print(f"  {cm.concept_id:25s} mastery={cm.mastery:.3f} "
          f"attempts={cm.attempts} avg_outcome={cm.cumulative_outcome/max(cm.attempts,1):+.2f}")