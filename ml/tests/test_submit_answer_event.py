import asyncio

import numpy as np
import pytest
from unittest.mock import patch

from mindcraft_graph.representation import embeddings


class _StubSentenceTransformer:
    def encode(self, texts, convert_to_numpy=True):
        return np.zeros((len(texts), 384))


with patch.object(
    embeddings,
    "load_sentence_transformer",
    return_value=_StubSentenceTransformer(),
):
    import serve
from mindcraft_graph.auth import AuthContext
from mindcraft_graph.engine.student_graph import create_personal_graph, update_personal_graph
from mindcraft_graph.models.ingredient import IngredientStudentState


def test_submit_answer_appends_card_event_and_mastery_survives_rebuild(monkeypatch):
    ingredient = serve.ingredient_ontology.ingredients[0]
    stored_events = []
    appended = []
    saved_graphs = []

    def append_interactions(student_id, events, source):
        appended.append((student_id, list(events), source))
        stored_events.extend(events)
        return len(events)

    monkeypatch.setattr(
        "mindcraft_graph.firestore_adapter.load_ingredient_state",
        lambda student_id: IngredientStudentState(student_id=student_id),
    )
    monkeypatch.setattr("mindcraft_graph.firestore_adapter.save_ingredient_state", lambda *args: None)
    monkeypatch.setattr("mindcraft_graph.firestore_adapter.append_interactions", append_interactions)
    monkeypatch.setattr(
        "mindcraft_graph.firestore_adapter.load_student_events",
        lambda student_id: list(stored_events),
    )
    monkeypatch.setattr(
        "mindcraft_graph.firestore_adapter.save_personal_graph",
        lambda student_id, graph: saved_graphs.append(graph),
    )

    response = asyncio.run(serve.submit_answer_endpoint(
        serve.SubmitIngredientAnswerRequest(
            student_id="s",
            card_template_id="card",
            target_type="ingredient",
            target_id=ingredient.id,
            representation_key="default",
            student_succeeded=True,
        ),
        AuthContext(uid=None, is_service=True),
    ))

    assert len(appended) == 1
    _, events, source = appended[0]
    assert source == "card"
    assert len(events) == 1
    assert events[0].concept_id == ingredient.concept_id
    assert events[0].event_type == "flashcard"
    assert events[0].exposure_weight == pytest.approx(0.4)

    rebuilt = update_personal_graph(
        create_personal_graph("s", serve.ontology), stored_events, serve.ontology
    )
    persisted_mastery = rebuilt.state.mastery_by_concept[ingredient.concept_id].mastery
    assert persisted_mastery > 0.0
    assert saved_graphs[-1].state.mastery_by_concept[ingredient.concept_id].mastery == pytest.approx(
        persisted_mastery
    )
    assert response["updatedConceptMastery"] == {
        ingredient.concept_id: pytest.approx(persisted_mastery)
    }
