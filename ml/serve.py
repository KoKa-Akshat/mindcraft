# ml/serve.py

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
import pathlib
from typing import Literal

from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.ingredient import IngredientOntology
from mindcraft_graph.models.student_state import ConceptMastery
from mindcraft_graph.representation import embeddings
from mindcraft_graph.representation.student_embeddings import (
    compute_student_embedding_from_profiles, compute_student_embedding_from_mastery
)
from mindcraft_graph.representation.summary_parser import process_session_summary
from mindcraft_graph.engine.ingredient_graph import IngredientGraph
from mindcraft_graph.engine.ingredient_pipeline import recommend_cards
from mindcraft_graph.engine.ingredient_runtime import (
    CardRecommendation,
    aggregate_to_concept_mastery,
    update_ingredient_state,
)
from mindcraft_graph.engine.student_graph import create_personal_graph, update_personal_graph
from mindcraft_graph.engine.features import compute_concept_profiles
from mindcraft_graph.engine.decay import decay_student_state, decay_all_edges
from mindcraft_graph.planning.goal import Goal
from mindcraft_graph.api.recommend import recommend

# ── Startup: load once, reuse forever ──

COMPLETE_ONTOLOGY_PATH = pathlib.Path(__file__).parent / "data" / "ontology_complete.json"
ONTOLOGY_PATH = pathlib.Path(__file__).parent / "data" / "ontology.json"
INGREDIENT_PATH = pathlib.Path(__file__).parent / "data" / "ingredient_ontology.json"
EMBEDDINGS_PATH = pathlib.Path(__file__).parent / "data" / "concept_embeddings.npz"
PCA_PATH = pathlib.Path(__file__).parent / "data" / "pca_axes.npz"

# Prefer the rich complete ontology; fall back to legacy files if missing
if COMPLETE_ONTOLOGY_PATH.exists():
    from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology
    ontology, ingredient_ontology = load_complete_ontology(COMPLETE_ONTOLOGY_PATH)
else:
    ontology = Ontology.model_validate_json(ONTOLOGY_PATH.read_text())
    ingredient_ontology = IngredientOntology.model_validate_json(INGREDIENT_PATH.read_text())

ingredient_graph = IngredientGraph(ingredient_ontology)

if EMBEDDINGS_PATH.exists():
    concept_embs = embeddings.load_concept_embeddings(EMBEDDINGS_PATH)
    pca_components, pca_mean, pca_variance = embeddings.load_pca_axes(PCA_PATH)
else:
    model = embeddings.load_sentence_transformer()
    concept_embs = embeddings.compute_concept_embeddings(ontology, model)
    pca_components, pca_mean, pca_variance = embeddings.compute_pca_axes(concept_embs)
    embeddings.save_concept_embeddings(concept_embs, EMBEDDINGS_PATH)
    embeddings.save_pca_axes(pca_components, pca_mean, pca_variance, PCA_PATH)


def _build_ingredient_concept_embeddings():
    augmented = dict(concept_embs)
    if "circular_trigonometry" not in augmented:
        seed_ids = [
            "trigonometry_basics",
            "circles_geometry",
            "functions_basics",
        ]
        seed_vectors = [concept_embs[seed_id] for seed_id in seed_ids if seed_id in concept_embs]
        if seed_vectors:
            vec = sum(seed_vectors) / len(seed_vectors)
            norm = float((vec @ vec) ** 0.5)
            if norm > 1e-8:
                vec = vec / norm
            augmented["circular_trigonometry"] = vec
    return augmented


ingredient_concept_embs = _build_ingredient_concept_embeddings()

# Load the sentence transformer for summary parsing
# This stays in memory for the life of the container
summary_model = embeddings.load_sentence_transformer()

def embed_fn(text: str):
    return summary_model.encode([text], convert_to_numpy=True)[0]

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MindCraft ML API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://mindcraft-93858.web.app",
        "https://mindcraft-93858.firebaseapp.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request/Response schemas ──

class RecommendRequest(BaseModel):
    student_id: str
    target_concepts: list[str] = []
    target_mastery: float = 0.8
    deadline_days: int | None = None
    mode: str = "curriculum"
    exploration_temp: float = 0.3

class SummaryRequest(BaseModel):
    student_id: str
    bullets: list[str]
    topics: list[str] = []
    duration_minutes: float = 45.0

class ProfileRequest(BaseModel):
    student_id: str


class IngredientRecommendRequest(BaseModel):
    student_id: str
    problem_text: str
    max_cards: int = 4


class SubmitIngredientAnswerRequest(BaseModel):
    student_id: str
    card_template_id: str
    target_type: Literal["ingredient", "bridge"]
    target_id: str
    representation_key: str
    student_succeeded: bool


def _serialize_minimal_dag(dag):
    return {
        "nodes": {
            ingredient_id: {
                "ingredientId": node.ingredient_id,
                "conceptId": node.concept_id,
                "mastery": node.mastery,
                "needScore": node.need_score,
                "isTarget": node.is_target,
                "isPruned": node.is_pruned,
            }
            for ingredient_id, node in dag.nodes.items()
        },
        "edges": [
            {
                "fromId": edge.from_id,
                "toId": edge.to_id,
                "edgeType": edge.edge_type,
                "confidence": edge.confidence,
                "needScore": edge.need_score,
                "bridgeId": edge.bridge_id,
            }
            for edge in dag.edges
        ],
        "targetIngredients": dag.target_ingredients,
        "backtrackedIngredients": dag.backtracked_ingredients,
    }


def _concepts_for_card_target(target_type: str, target_id: str) -> list[str]:
    if target_type == "ingredient":
        ingredient = ingredient_graph.get_ingredient(target_id)
        if ingredient is None:
            return []
        return [ingredient.concept_id]

    if target_type == "bridge":
        parts = target_id.split("->")
        concept_ids = []
        for ingredient_id in parts[:2]:
            ingredient = ingredient_graph.get_ingredient(ingredient_id)
            if ingredient is not None:
                concept_ids.append(ingredient.concept_id)
        return concept_ids

    return []


# ── Endpoints ──

@app.post("/recommend")
async def recommend_endpoint(req: RecommendRequest):
    from mindcraft_graph.firestore_adapter import (
        load_student_events, save_personal_graph, save_recommendation_result,
    )

    # Load student data
    events = load_student_events(req.student_id)
    if not events:
        # New student — return the full prerequisite chain
        events = []

    # Build or update personal graph
    graph = create_personal_graph(req.student_id, ontology)
    if events:
        graph = update_personal_graph(graph, events, ontology)

    # Apply decay
    now = datetime.now()
    graph.state = decay_student_state(graph.state, now)
    graph.edges = decay_all_edges(graph.edges, now)

    # Build goal
    goal = Goal(
        target_concepts=req.target_concepts,
        target_mastery=req.target_mastery,
        deadline_days=req.deadline_days,
        mode=req.mode,
        exploration_temp=req.exploration_temp,
    )

    # Run recommendation
    result = recommend(
        graph, goal, events,
        concept_embs, pca_components, pca_mean, ontology,
    )

    # Save state
    save_personal_graph(req.student_id, graph)

    # Convert to JSON-serializable dict
    response = {
        "mode": result.mode,
        "targetConcepts": result.target_concepts,
        "canonicalChain": result.canonical_chain,
        "recommendations": [
            {
                "conceptId": r.concept_id,
                "reason": r.reason,
                "positionInChain": r.position_in_chain,
                "isSupplement": r.is_supplement,
                "supplementFor": r.supplement_for,
                "alignmentScore": r.alignment_score,
                "pcaProfile": r.pca_profile,
            }
            for r in result.recommendations
        ],
        "studentProfile": {
            "masteryProjection": result.student_profile.mastery_projection,
            "strengthProjection": result.student_profile.strength_projection,
            "displacementMagnitude": result.student_profile.displacement_magnitude,
            "displacementDirection": result.student_profile.displacement_direction,
            "topStrengths": [
                {"conceptId": cid, "strength": s}
                for cid, s in result.student_profile.top_strengths
            ],
            "topWeaknesses": [
                {"conceptId": cid, "strength": s}
                for cid, s in result.student_profile.top_weaknesses
            ],
        },
    }

    save_recommendation_result(req.student_id, response)
    return response


@app.post("/recommend-ingredients")
async def recommend_ingredients_endpoint(req: IngredientRecommendRequest):
    from mindcraft_graph.firestore_adapter import (
        load_ingredient_state,
        save_ingredient_recommendation_result,
    )

    student_state = load_ingredient_state(req.student_id)
    result = recommend_cards(
        problem_text=req.problem_text,
        student_state=student_state,
        graph=ingredient_graph,
        concept_embeddings=ingredient_concept_embs,
        embed_fn=embed_fn,
        ontology=ontology,
        max_cards=req.max_cards,
    )

    response = {
        "studentId": req.student_id,
        "problemText": req.problem_text,
        "problemFeatures": result.problem_features.model_dump(),
        "minimalDag": _serialize_minimal_dag(result.minimal_dag),
        "cards": [
            {
                "cardTemplateId": card.card_template_id,
                "targetType": card.target_type,
                "targetId": card.target_id,
                "representationKey": card.representation_key,
                "title": card.title,
                "body": card.body,
                "prompt": card.prompt,
                "needScore": card.need_score,
                "reason": card.reason,
            }
            for card in result.cards
        ],
        "compositionPrompt": result.composition_prompt,
    }

    save_ingredient_recommendation_result(req.student_id, response)
    return response


@app.post("/submit-answer")
async def submit_answer_endpoint(req: SubmitIngredientAnswerRequest):
    from mindcraft_graph.firestore_adapter import (
        load_ingredient_state,
        load_student_events,
        save_ingredient_state,
        save_personal_graph,
    )

    student_state = load_ingredient_state(req.student_id)
    card = CardRecommendation(
        card_template_id=req.card_template_id,
        target_type=req.target_type,
        target_id=req.target_id,
        representation_key=req.representation_key,
        title="",
        body="",
        prompt="",
        need_score=0.0,
        reason="",
    )
    student_state = update_ingredient_state(
        student_state,
        card,
        student_succeeded=req.student_succeeded,
    )
    save_ingredient_state(req.student_id, student_state)

    events = load_student_events(req.student_id)
    graph = create_personal_graph(req.student_id, ontology)
    if events:
        graph = update_personal_graph(graph, events, ontology)

    now = datetime.now()
    updated_concepts = {}
    valid_concepts = {concept.id for concept in ontology.concepts}
    for concept_id in _concepts_for_card_target(req.target_type, req.target_id):
        if concept_id not in valid_concepts:
            continue

        aggregated_mastery = aggregate_to_concept_mastery(
            student_state,
            concept_id,
            ingredient_graph,
        )
        current = graph.state.mastery_by_concept.get(concept_id)
        if current is None:
            graph.state.mastery_by_concept[concept_id] = ConceptMastery(
                concept_id=concept_id,
                mastery=aggregated_mastery,
                exposure_count=0,
                last_interaction=now,
                cumulative_outcome=0.0,
                attempts=0,
            )
        else:
            graph.state.mastery_by_concept[concept_id] = current.model_copy(update={
                "mastery": aggregated_mastery,
                "last_interaction": now,
            })

        updated_concepts[concept_id] = aggregated_mastery

    graph.updated_at = now
    save_personal_graph(req.student_id, graph)

    return {
        "studentId": req.student_id,
        "targetType": req.target_type,
        "targetId": req.target_id,
        "studentSucceeded": req.student_succeeded,
        "updatedConceptMastery": updated_concepts,
        "styleScores": student_state.style_scores,
    }


@app.post("/process-summary")
async def process_summary_endpoint(req: SummaryRequest):
    from mindcraft_graph.firestore_adapter import (
        load_student_events, save_personal_graph,
    )

    # Parse summary into events
    new_events = process_session_summary(
        student_id=req.student_id,
        bullets=req.bullets,
        topics=req.topics,
        concept_embeddings=concept_embs,
        embed_fn=embed_fn,
        session_timestamp=datetime.now(),
        session_duration_minutes=req.duration_minutes,
    )

    if not new_events:
        return {"eventsCreated": 0, "conceptsDetected": []}

    # Load existing events and combine
    existing_events = load_student_events(req.student_id)
    all_events = existing_events + new_events

    # Update personal graph
    graph = create_personal_graph(req.student_id, ontology)
    graph = update_personal_graph(graph, all_events, ontology)

    # Apply decay
    now = datetime.now()
    graph.state = decay_student_state(graph.state, now)
    graph.edges = decay_all_edges(graph.edges, now)

    # Save
    save_personal_graph(req.student_id, graph)

    # Also write the new events to Firestore so they persist
    from google.cloud import firestore
    db = firestore.Client()
    for event in new_events:
        db.collection("interactions").add({
            "studentId": event.student_id,
            "conceptId": event.concept_id,
            "eventType": event.event_type,
            "outcome": event.outcome,
            "effort": event.effort,
            "durationMinutes": event.duration_minutes,
            "timestamp": event.timestamp,
            "exposureWeight": event.exposure_weight,
            "source": "summary_parser",
        })

    return {
        "eventsCreated": len(new_events),
        "conceptsDetected": list(set(e.concept_id for e in new_events)),
    }


@app.get("/student-profile/{student_id}")
async def student_profile_endpoint(student_id: str):
    from mindcraft_graph.firestore_adapter import load_student_events

    events = load_student_events(student_id)
    if not events:
        raise HTTPException(status_code=404, detail="No data for this student")

    graph = create_personal_graph(student_id, ontology)
    graph = update_personal_graph(graph, events, ontology)

    profiles = compute_concept_profiles(events)
    strength_vec = compute_student_embedding_from_profiles(profiles, concept_embs)
    mastery_vec = compute_student_embedding_from_profiles(profiles, concept_embs)

    from mindcraft_graph.api.recommend import _project_and_label, DEFAULT_AXIS_LABELS

    mastery_proj = _project_and_label(mastery_vec, pca_components, pca_mean, DEFAULT_AXIS_LABELS)
    strength_proj = _project_and_label(strength_vec, pca_components, pca_mean, DEFAULT_AXIS_LABELS)

    sorted_profiles = sorted(profiles.items(), key=lambda x: x[1].strength_score, reverse=True)

    return {
        "studentId": student_id,
        "masteryProjection": mastery_proj,
        "strengthProjection": strength_proj,
        "topStrengths": [
            {"conceptId": cid, "strength": p.strength_score}
            for cid, p in sorted_profiles if p.strength_score > 0
        ][:5],
        "topWeaknesses": [
            {"conceptId": cid, "strength": p.strength_score}
            for cid, p in reversed(sorted_profiles) if p.strength_score < 0
        ][:5],
        "conceptCount": len(profiles),
        "totalEvents": sum(p.event_count for p in profiles.values()),
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "conceptCount": len(ontology.concepts),
        "ingredientConceptCount": len(ingredient_graph.by_concept),
        "ingredientCount": len(ingredient_graph.ingredients),
        "edgeCount": len(ontology.edges),
        "embeddingsLoaded": len(concept_embs) > 0,
    }

@app.get("/knowledge-graph/{student_id}")
async def knowledge_graph_endpoint(student_id: str):
    """
    Returns all data needed to render the interactive knowledge graph.
    
    - Concept positions (PCA projected x,y coordinates)
    - Ontology edges with weights
    - Per-concept mastery and strength scores
    - Student mastery and strength points
    - Ingredient list per concept (for click-to-expand)
    """
    from mindcraft_graph.firestore_adapter import load_student_events
    
    events = load_student_events(student_id)
    
    graph = create_personal_graph(student_id, ontology)
    if events:
        graph = update_personal_graph(graph, events, ontology)
    
    profiles = compute_concept_profiles(events)
    
    mastery_vec = compute_student_embedding_from_mastery(
        graph.state.mastery_by_concept, concept_embs,
    )
    strength_vec = compute_student_embedding_from_profiles(profiles, concept_embs)
    
    # Project everything into 2D PCA space
    projected_concepts = embeddings.project_concept_embeddings(
        concept_embs, pca_components, pca_mean,
    )
    mastery_proj = embeddings.project_vectors_onto_axes(
        mastery_vec, pca_components, pca_mean,
    )
    strength_proj = embeddings.project_vectors_onto_axes(
        strength_vec, pca_components, pca_mean,
    )
    
    # Build node data
    nodes = []
    for concept in ontology.concepts:
        cid = concept.id
        proj = projected_concepts[cid]
        profile = profiles.get(cid)
        mastery_state = graph.state.mastery_by_concept.get(cid)
        
        # Get ingredients for this concept
        concept_ingredients = []
        if hasattr(ingredient_graph, 'get_concept_ingredients'):
            for ing in ingredient_graph.get_concept_ingredients(cid):
                concept_ingredients.append({
                    "id": ing.id,
                    "name": ing.name,
                    "description": ing.description,
                })
        
        nodes.append({
            "id": cid,
            "name": concept.name,
            "level": concept.level,
            "x": float(proj[0]),
            "y": float(proj[1]),
            "mastery": mastery_state.mastery if mastery_state else 0.0,
            "strengthScore": profile.strength_score if profile else 0.0,
            "eventCount": profile.event_count if profile else 0,
            "status": (
                "mastered" if profile and profile.strength_score > 0.3
                else "struggling" if profile and profile.strength_score < -0.1
                else "untouched" if not profile or profile.event_count == 0
                else "in_progress"
            ),
            "ingredients": concept_ingredients,
            "tags": concept.tags,
        })
    
    # Build edge data from personal graph
    edge_list = []
    for key, edge in graph.edges.items():
        parts = key.split("::")
        if len(parts) != 2:
            continue
        edge_list.append({
            "from": parts[0],
            "to": parts[1],
            "weight": edge.weight,
            "relation": edge.relation,
        })
    
    # Student position
    student_points = {
        "mastery": {
            "x": float(mastery_proj[0, 0]),
            "y": float(mastery_proj[0, 1]),
            "label": "Where you've been studying",
        },
        "strength": {
            "x": float(strength_proj[0, 0]),
            "y": float(strength_proj[0, 1]),
            "label": "Where you perform best",
        },
    }
    
    # PCA axis labels for the frontend
    axis_labels = {
        "x": "applied/geometric ↔ algebraic/symbolic",
        "y": "probabilistic/functional ↔ trigonometric/spatial",
    }
    
    return {
        "nodes": nodes,
        "edges": edge_list,
        "studentPoints": student_points,
        "axisLabels": axis_labels,
        "conceptCount": len(nodes),
        "edgeCount": len(edge_list),
    }