# ml/serve.py

from fastapi import FastAPI, HTTPException, Depends
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
from mindcraft_graph.auth import require_auth, authorize_student, AuthContext

# ── Startup: load once, reuse forever ──

DATA_DIR = pathlib.Path(__file__).parent / "data"

# Standardized canonical-ID ontology (concepts + ingredients + bridges +
# combinations in one file). This is the source of truth the harness validated
# against; the live API must classify against the same vocabulary.
STANDARDIZED_ONTOLOGY_PATH = (
    DATA_DIR / "5_level_ontology" / "01_mindcraft_concept_ontology_v2_6_with_combinations.json"
)
# Legacy files — kept on disk for reference, no longer preferred.
LEGACY_COMPLETE_ONTOLOGY_PATH = DATA_DIR / "ontology_complete.json"
LEGACY_ONTOLOGY_PATH = DATA_DIR / "ontology.json"
LEGACY_INGREDIENT_PATH = DATA_DIR / "ingredient_ontology.json"

EMBEDDINGS_PATH = DATA_DIR / "concept_embeddings.npz"
PCA_PATH = DATA_DIR / "pca_axes.npz"

# Combination firing threshold for /recommend-ingredients. Pinned to the value
# the harness (scripts/test_concept_paths.py) validated against so the live API
# fires the same combinations the harness reports. The pipeline's own default
# differs; passing this explicitly keeps production and harness in lockstep.
COMBINATION_MIN_OVERLAP = 0.5

from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology

if STANDARDIZED_ONTOLOGY_PATH.exists():
    ontology, ingredient_ontology = load_complete_ontology(STANDARDIZED_ONTOLOGY_PATH)
    _ontology_source = STANDARDIZED_ONTOLOGY_PATH.name
elif LEGACY_COMPLETE_ONTOLOGY_PATH.exists():
    ontology, ingredient_ontology = load_complete_ontology(LEGACY_COMPLETE_ONTOLOGY_PATH)
    _ontology_source = LEGACY_COMPLETE_ONTOLOGY_PATH.name
else:
    ontology = Ontology.model_validate_json(LEGACY_ONTOLOGY_PATH.read_text())
    ingredient_ontology = IngredientOntology.model_validate_json(LEGACY_INGREDIENT_PATH.read_text())
    _ontology_source = LEGACY_ONTOLOGY_PATH.name

ingredient_graph = IngredientGraph(ingredient_ontology)


def _rebuild_concept_embeddings():
    model = embeddings.load_sentence_transformer()
    embs = embeddings.compute_concept_embeddings(ontology, model)
    pca = embeddings.compute_pca_axes(embs)
    embeddings.save_concept_embeddings(embs, EMBEDDINGS_PATH)
    embeddings.save_pca_axes(*pca, PCA_PATH)
    return embs, pca


# The .npz cache may have been built from a *different* ontology (e.g. the legacy
# 37/38-concept file). If its concept set no longer matches the loaded ontology,
# invalidate it and rebuild from the standardized file — otherwise classification
# would run against a stale vocabulary that diverges from the harness.
_ontology_concept_ids = {c.id for c in ontology.concepts}
if EMBEDDINGS_PATH.exists():
    concept_embs = embeddings.load_concept_embeddings(EMBEDDINGS_PATH)
    if set(concept_embs.keys()) == _ontology_concept_ids:
        pca_components, pca_mean, pca_variance = embeddings.load_pca_axes(PCA_PATH)
        _embedding_source = f"{EMBEDDINGS_PATH.name} (cache hit, matches ontology)"
    else:
        concept_embs, (pca_components, pca_mean, pca_variance) = _rebuild_concept_embeddings()
        _embedding_source = f"rebuilt from {_ontology_source} (stale cache invalidated)"
else:
    concept_embs, (pca_components, pca_mean, pca_variance) = _rebuild_concept_embeddings()
    _embedding_source = f"computed from {_ontology_source} (no cache)"

print(
    "[startup] ontology=%s | concepts=%d edges=%d | ingredients=%d bridges=%d combinations=%d | embeddings: %s"
    % (
        _ontology_source,
        len(ontology.concepts),
        len(ontology.edges),
        len(ingredient_graph.ingredients),
        len(ingredient_ontology.bridges),
        len(ingredient_ontology.combinations),
        _embedding_source,
    )
)


# Classification embeddings for the ingredient runtime. With the standardized
# ontology these are exactly the concept embeddings — no synthesized concepts.
# (A legacy augmentation here injected a phantom "circular_trigonometry" vector
# that has no ingredients in the standardized graph; it has been removed so the
# live API classifies against the same 42-concept vocabulary the harness uses.)
ingredient_concept_embs = dict(concept_embs)

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
        "https://app-beta-one-59.vercel.app",
        "https://joinmindcraft-mindcraft-ml.hf.space",
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
    # Exam track from onboarding (e.g. "ACT"). When set, scopes weakness filtering
    # and fills exam-mode targets from act_relevance.tested concepts.
    exam: str | None = None


def _act_tested_concept_ids() -> list[str]:
    return ontology.act_tested_concept_ids()


def _exam_curriculum_scope(exam: str | None) -> set[str] | None:
    """Resolve the concept subset for an exam track.

    ACT / ACT_MATH / GENERAL → act_relevance.tested (29 concepts)
    MIDDLE_SCHOOL / HIGH_SCHOOL → foundational + core levels (grade 6-10)
    """
    if not exam:
        return None
    key = exam.strip().upper()
    if key in ("ACT", "ACT_MATH", "GENERAL"):
        return set(_act_tested_concept_ids())
    if key in ("MIDDLE_SCHOOL", "HIGH_SCHOOL"):
        return set(ontology.middle_school_concept_ids())
    return None


def _resolve_recommend_targets(req: RecommendRequest) -> list[str]:
    if req.target_concepts:
        return list(req.target_concepts)
    if req.mode == "exam":
        scope = _exam_curriculum_scope(req.exam)
        if scope:
            return sorted(scope)
        return _act_tested_concept_ids()
    return []

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


class SeedAssessmentRequest(BaseModel):
    student_id: str
    # concept_id -> self-reported confidence ("hard" | "kinda" | "easy")
    assessment: dict[str, str]


class OutcomeItem(BaseModel):
    concept_id: str
    # Per-question substrate (Step 1). `score` is the raw pass rate in [0,1]
    # (a single question is 1.0/0.0; a session may send a fraction). `format_id`
    # is a canonical representation/vessel id, validated against config.FORMAT_IDS.
    format_id: str | None = None
    score: float | None = None
    level: int = 1
    question_id: str | None = None
    # Deprecated legacy session-boolean. Used only when `score` is None so current
    # callers don't break (succeeded -> score 1.0/0.0).
    succeeded: bool | None = None

    def resolved_score(self) -> float | None:
        """Raw pass rate, falling back to the deprecated boolean."""
        if self.score is not None:
            return self.score
        if self.succeeded is not None:
            return 1.0 if self.succeeded else 0.0
        return None


class RecordOutcomesRequest(BaseModel):
    student_id: str
    outcomes: list[OutcomeItem]


class PrepDiagnoseRequest(BaseModel):
    student_id: str
    exam_type: str = "ACT_MATH"
    deadline_days: int | None = None
    # Optional explicit targets; empty = the exam-priority concepts.
    target_concepts: list[str] = []


class SubmitIngredientAnswerRequest(BaseModel):
    student_id: str
    card_template_id: str
    target_type: Literal["ingredient", "bridge"]
    target_id: str
    representation_key: str
    student_succeeded: bool


class CheckWorkLine(BaseModel):
    latex: str


class CheckWorkRequest(BaseModel):
    student_id: str
    problem_text: str | None = None
    lines: list[CheckWorkLine]


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

@app.post("/check-work")
async def check_work_endpoint(req: CheckWorkRequest, auth: AuthContext = Depends(require_auth)):
    """Deterministically check whether consecutive transcribed work lines preserve value.

    Parsing failures are `unparsed`, never wrong. Only cleanly parsed,
    inequivalent consecutive lines produce `firstBrokenLine`.
    """
    authorize_student(auth, req.student_id)
    from mindcraft_graph.work_check import check_work_lines

    if len(req.lines) > 20:
        raise HTTPException(status_code=400, detail="Too many lines")

    return check_work_lines([line.latex for line in req.lines])

@app.post("/recommend")
async def recommend_endpoint(req: RecommendRequest, auth: AuthContext = Depends(require_auth)):
    authorize_student(auth, req.student_id)
    from mindcraft_graph.firestore_adapter import (
        load_student_events, save_personal_graph, save_recommendation_result,
        append_displacement_snapshot, load_ingredient_state, load_format_events,
        load_affective_state,
    )
    from mindcraft_graph.engine.update import fold_format_events

    # Load student data
    events = load_student_events(req.student_id)
    if not events:
        # New student — return the full prerequisite chain
        events = []

    # Build or update personal graph
    graph = create_personal_graph(req.student_id, ontology)
    if events:
        graph = update_personal_graph(graph, events, ontology)

    # Fold format nodes into mastery_by_concept (separate from the concept path)
    # so format-gap detection can see per-vessel mastery.
    graph.state = fold_format_events(graph.state, load_format_events(req.student_id))

    # Apply decay
    now = datetime.now()
    graph.state = decay_student_state(graph.state, now)
    graph.edges = decay_all_edges(graph.edges, now)

    # Build goal — exam mode defaults to act_relevance.tested when targets omitted.
    resolved_targets = _resolve_recommend_targets(req)
    curriculum_scope = (
        set(resolved_targets)
        if resolved_targets
        else _exam_curriculum_scope(req.exam)
    )
    goal = Goal(
        target_concepts=resolved_targets,
        target_mastery=req.target_mastery,
        deadline_days=req.deadline_days,
        mode=req.mode,
        exploration_temp=req.exploration_temp,
    )

    # Per-student bridge confidence feeds bridge-gap detection: cross-concept
    # transitions the student is stuck on that the concept-level trim can't see.
    ingredient_state = load_ingredient_state(req.student_id)

    # Load affective state (written by Vercel /api/agent-check-in, stale > 4 h = None)
    affective_state = load_affective_state(req.student_id)

    # High stress → lower the mastery bar so the student gets easier wins
    if affective_state and affective_state.stress > 0.7:
        goal = goal.model_copy(update={"target_mastery": max(0.5, goal.target_mastery - 0.1)})

    # Affective modifier: nudge explicit-struggle concepts into STRUGGLING state
    # so the pathfinder keeps them in the trimmed chain (applied inside recommend).
    explicit_struggles = set(affective_state.explicit_struggles) if affective_state else set()

    # Run recommendation
    result = recommend(
        graph, goal, events,
        concept_embs, pca_components, pca_mean, ontology,
        bridges=ingredient_ontology.bridges,
        bridge_confidence=ingredient_state.bridge_confidence,
        affective_state=affective_state,
        explicit_struggles=explicit_struggles,
        curriculum_scope=curriculum_scope,
    )

    # Save state
    save_personal_graph(req.student_id, graph)

    # Append the displacement reading to the per-student time series. The KPI is
    # the trend (is the strength↔mastery gap closing?), which the overwriting
    # recommendation snapshot can't capture.
    append_displacement_snapshot(
        req.student_id,
        result.student_profile.displacement_magnitude,
        result.student_profile.displacement_direction,
        now,
    )

    # Concepts the target(s) directly unlock (reverse prerequisite edges) — lets
    # the client show "where this leads" without a duplicate frontend prereq map.
    _targets = set(result.target_concepts) or (
        {result.canonical_chain[-1]} if result.canonical_chain else set()
    )
    unlocks = sorted({
        edge.to_concept
        for edge in ontology.edges
        if edge.relation == "prerequisite" and edge.from_concept in _targets
    })

    # Convert to JSON-serializable dict
    response = {
        "mode": result.mode,
        "targetConcepts": result.target_concepts,
        "canonicalChain": result.canonical_chain,
        "unlocks": unlocks,
        "recommendations": [
            {
                "conceptId": r.concept_id,
                "reason": r.reason,
                "positionInChain": r.position_in_chain,
                "isSupplement": r.is_supplement,
                "supplementFor": r.supplement_for,
                "alignmentScore": r.alignment_score,
                "pcaProfile": r.pca_profile,
                "isBridgeGap": r.is_bridge_gap,
                "gapType": r.gap_type,
                "bridgeId": r.bridge_id,
                "bridgeFromConcept": r.bridge_from_concept,
                "bridgeToConcept": r.bridge_to_concept,
                "bridgeEvidence": r.bridge_evidence,
                "severity": r.severity,
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


@app.post("/prep-diagnose")
async def prep_diagnose_endpoint(req: PrepDiagnoseRequest, auth: AuthContext = Depends(require_auth)):
    """Deterministic exam-prep diagnosis — the always-on fallback for /prep.

    Runs the exam-mode pathfinder (exam-frequency + deadline budget) and maps the
    gap chain into the same DiagnoseResult/Gap shape the panic-loop UI consumes,
    so it drops in when the LLM diagnose is unavailable (Anthropic credits) or the
    input is purely structured (exam type + deadline)."""
    authorize_student(auth, req.student_id)
    from mindcraft_graph.firestore_adapter import load_student_events
    from mindcraft_graph.planning.pathfinder import find_path

    now = datetime.now()
    events = load_student_events(req.student_id)
    graph = create_personal_graph(req.student_id, ontology)
    if events:
        graph = update_personal_graph(graph, events, ontology)
    graph.state = decay_student_state(graph.state, now)
    graph.edges = decay_all_edges(graph.edges, now)

    profiles = compute_concept_profiles(events)
    strength_vec = compute_student_embedding_from_profiles(profiles, concept_embs)
    goal = Goal(mode="exam", deadline_days=req.deadline_days, target_concepts=req.target_concepts)
    path = find_path(graph, goal, concept_embs, strength_vec, profiles, ontology, events)

    trimmed = path["trimmed_chain"]
    canonical = path["canonical_chain"]
    concept_by_id = {c.id: c for c in ontology.concepts}
    mastery = graph.state.mastery_by_concept
    # First unmastered prereq of each concept (the "broken prerequisite").
    def _mastery(cid):
        cm = mastery.get(cid)
        return cm.mastery if cm is not None else 0.0
    # Bridge feeding each target concept (source_concept -> target_concept).
    bridge_into = {}
    for b in ingredient_ontology.bridges:
        bridge_into.setdefault(b.target_concept, b.source_concept)

    gaps = []
    for cid in trimmed:
        c = concept_by_id.get(cid)
        m = _mastery(cid)
        prof = profiles.get(cid)
        if prof is not None and prof.strength_score < -0.1:
            urgency = "critical"
        elif m >= 0.5:
            urgency = "stable"
        else:
            urgency = "moderate"
        broken = ""
        if cid in canonical:
            for pre in canonical[:canonical.index(cid)]:
                if _mastery(pre) < 0.5:
                    broken = pre
                    break
        gaps.append({
            "conceptId": cid,
            "conceptName": c.name if c else cid,
            "urgency": urgency,
            "studentScore": round(m, 3),
            "examWeight": round(c.exam_frequency, 3) if c else 0.0,
            "brokenPrerequisite": broken,
            "bridgeConcept": bridge_into.get(cid, ""),
            "practiceCount": 0,
        })

    triage = req.deadline_days is not None and req.deadline_days <= 7
    confidence = "high" if len(events) >= 10 else ("medium" if events else "low")
    return {
        "gaps": gaps,
        "sessionId": f"prep_{req.student_id}_{int(now.timestamp())}",
        "examType": req.exam_type,
        "diagnosisConfidence": confidence,
        "mode": "triage" if triage else "foundation",
        "source": "deterministic",
    }


# Onboarding self-assessment -> seed events. hard = struggling (negative outcome,
# high effort = confirmed weakness); easy = some initial mastery; kinda = mild gap.
ASSESSMENT_OUTCOME_MAP = {
    "hard": (-0.4, 0.7),
    "kinda": (-0.1, 0.5),
    "easy": (0.5, 0.3),
}


@app.post("/seed-assessment")
async def seed_assessment_endpoint(req: SeedAssessmentRequest, auth: AuthContext = Depends(require_auth)):
    """Seed the concept graph from the onboarding 'gap scan' so a brand-new
    student gets personalized recommendations before their first session."""
    authorize_student(auth, req.student_id)
    from mindcraft_graph.firestore_adapter import (
        load_student_events,
        replace_interactions_by_source,
        save_personal_graph,
    )
    from mindcraft_graph.models.events import SessionEvent

    valid_concepts = {concept.id for concept in ontology.concepts}
    now = datetime.now()
    seeded: list[str] = []
    skipped: list[str] = []
    events: list[SessionEvent] = []
    for concept_id, confidence in req.assessment.items():
        conf = (confidence or "").lower()
        if concept_id not in valid_concepts or conf not in ASSESSMENT_OUTCOME_MAP:
            skipped.append(concept_id)
            continue
        outcome, effort = ASSESSMENT_OUTCOME_MAP[conf]
        events.append(SessionEvent(
            student_id=req.student_id,
            concept_id=concept_id,
            event_type="assessment",
            outcome=outcome,
            effort=effort,
            duration_minutes=5.0,
            timestamp=now,
            exposure_weight=1.0,
        ))
        seeded.append(concept_id)

    # Idempotent: replaces any prior onboarding seed so re-onboarding overwrites.
    replace_interactions_by_source(req.student_id, events, source="onboarding_assessment")

    # Rebuild + persist the personal graph from all events (seed + any real ones).
    all_events = load_student_events(req.student_id)
    graph = create_personal_graph(req.student_id, ontology)
    if all_events:
        graph = update_personal_graph(graph, all_events, ontology)
    graph.state = decay_student_state(graph.state, now)
    graph.edges = decay_all_edges(graph.edges, now)
    save_personal_graph(req.student_id, graph)

    return {
        "studentId": req.student_id,
        "seededConcepts": seeded,
        "skippedConcepts": skipped,
        "eventsCreated": len(events),
    }


@app.post("/record-outcomes")
async def record_outcomes_endpoint(req: RecordOutcomesRequest, auth: AuthContext = Depends(require_auth)):
    """Record practice/homework results into the concept graph so mastery moves
    as the student actually answers problems. Events accumulate (not replaced).

    Structural split: the UPDATE is one continuous-score event PER NODE the
    session touches — concept scored k/N over all questions (full weight), each
    format scored k/n over its own questions (sample-weighted). The OBSERVATION
    log keeps full per-question granularity for the predictive harness. Items
    arrive per-question (score 1/0); they are aggregated here, not folded raw."""
    authorize_student(auth, req.student_id)
    from collections import defaultdict
    from statistics import mean
    from mindcraft_graph.firestore_adapter import (
        append_interactions,
        append_format_interactions,
        append_attempt_observations,
        load_format_events,
        load_student_events,
        save_personal_graph,
    )
    from mindcraft_graph.models.events import SessionEvent
    from mindcraft_graph.engine.update import fold_format_events
    from mindcraft_graph.config import outcome_from, format_exposure_weight, FORMAT_IDS

    valid_concepts = {concept.id for concept in ontology.concepts}
    now = datetime.now()
    recorded: list[str] = []
    skipped: list[str] = []

    # Bucket per-question scores by node; collect per-question observations.
    by_concept: dict[str, list[float]] = defaultdict(list)
    concept_level: dict[str, int] = {}
    by_format: dict[str, list[float]] = defaultdict(list)
    format_level: dict[str, int] = {}
    observations: list[dict] = []
    for item in req.outcomes:
        score = item.resolved_score()
        if item.concept_id not in valid_concepts or score is None:
            skipped.append(item.concept_id)
            continue
        by_concept[item.concept_id].append(score)
        concept_level[item.concept_id] = max(concept_level.get(item.concept_id, 1), item.level)
        has_format = item.format_id in FORMAT_IDS
        if has_format:
            by_format[item.format_id].append(score)
            format_level[item.format_id] = max(format_level.get(item.format_id, 1), item.level)
        observations.append({
            "concept_id": item.concept_id,
            "format_id": item.format_id if has_format else None,
            "level": item.level,
            "correct": 1.0 if score >= 1.0 else (0.0 if score <= 0.0 else score),
            "question_id": item.question_id,
        })
        recorded.append(item.concept_id)

    # One aggregated CONCEPT event per concept (k/N, full weight).
    events: list[SessionEvent] = []
    for cid, scores in by_concept.items():
        base = outcome_from(mean(scores), concept_level[cid])
        events.append(SessionEvent(
            student_id=req.student_id,
            concept_id=cid,
            event_type="problem_set",
            outcome=base,
            effort=0.6 if base < 0 else 0.4,  # strength/displacement only, never mastery
            duration_minutes=3.0,
            timestamp=now,
            exposure_weight=1.0,
        ))

    # One aggregated FORMAT event per format (k/n, sample-weighted).
    format_records: list[dict] = []
    for fid, scores in by_format.items():
        base = outcome_from(mean(scores), format_level[fid])
        format_records.append({
            "format_id": fid,
            "outcome": base,
            "level": format_level[fid],
            "exposure_weight": format_exposure_weight(len(scores)),
        })

    if events:
        append_interactions(req.student_id, events, source="practice")
    if format_records:
        append_format_interactions(req.student_id, format_records, now)
    if observations:
        append_attempt_observations(req.student_id, observations, now)

    all_events = load_student_events(req.student_id)
    graph = create_personal_graph(req.student_id, ontology)
    if all_events:
        graph = update_personal_graph(graph, all_events, ontology)
    # Fold format nodes into mastery_by_concept (separate from the concept path).
    graph.state = fold_format_events(graph.state, load_format_events(req.student_id))
    graph.state = decay_student_state(graph.state, now)
    graph.edges = decay_all_edges(graph.edges, now)
    save_personal_graph(req.student_id, graph)

    return {
        "studentId": req.student_id,
        "recordedConcepts": recorded,
        "skippedConcepts": skipped,
        "eventsCreated": len(events),
    }


@app.post("/recommend-ingredients")
async def recommend_ingredients_endpoint(req: IngredientRecommendRequest, auth: AuthContext = Depends(require_auth)):
    authorize_student(auth, req.student_id)
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
        combination_min_overlap=COMBINATION_MIN_OVERLAP,
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
async def submit_answer_endpoint(req: SubmitIngredientAnswerRequest, auth: AuthContext = Depends(require_auth)):
    authorize_student(auth, req.student_id)
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
async def process_summary_endpoint(req: SummaryRequest, auth: AuthContext = Depends(require_auth)):
    authorize_student(auth, req.student_id)
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

    # Also write the new events to Firestore so they persist. Reuse the adapter's
    # client so this targets the same project (mindcraft-93858) as everything else.
    from mindcraft_graph.firestore_adapter import db
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
async def student_profile_endpoint(student_id: str, auth: AuthContext = Depends(require_auth)):
    authorize_student(auth, student_id)
    from mindcraft_graph.firestore_adapter import load_student_events

    events = load_student_events(student_id)
    if not events:
        raise HTTPException(status_code=404, detail="No data for this student")

    graph = create_personal_graph(student_id, ontology)
    graph = update_personal_graph(graph, events, ontology)

    profiles = compute_concept_profiles(events)
    strength_vec = compute_student_embedding_from_profiles(profiles, concept_embs)
    mastery_vec = compute_student_embedding_from_mastery(
        graph.state.mastery_by_concept, concept_embs,
    )

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
        "actTestedConceptCount": len(_act_tested_concept_ids()),
        "ingredientConceptCount": len(ingredient_graph.by_concept),
        "ingredientCount": len(ingredient_graph.ingredients),
        "edgeCount": len(ontology.edges),
        "embeddingsLoaded": len(concept_embs) > 0,
    }


@app.get("/firestore-health")
async def firestore_health(auth: AuthContext = Depends(require_auth)):
    if not auth.is_service:
        raise HTTPException(status_code=403, detail="Forbidden")

    import json
    import os

    credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    credential_exists = bool(credential_path and pathlib.Path(credential_path).exists())
    credential_json_ok = False
    credential_project_id = None
    if credential_exists:
        try:
            credential_data = json.loads(pathlib.Path(credential_path).read_text())
            credential_json_ok = True
            credential_project_id = credential_data.get("project_id")
        except Exception:
            credential_json_ok = False

    try:
        from mindcraft_graph.firestore_adapter import FIRESTORE_PROJECT, db

        doc = db.collection("ingredient_states").document("__health__").get()
        return {
            "ok": True,
            "firestoreProject": FIRESTORE_PROJECT,
            "credentialPathSet": bool(credential_path),
            "credentialExists": credential_exists,
            "credentialJsonOk": credential_json_ok,
            "credentialProjectId": credential_project_id,
            "healthDocExists": doc.exists,
        }
    except Exception as exc:
        return {
            "ok": False,
            "credentialPathSet": bool(credential_path),
            "credentialExists": credential_exists,
            "credentialJsonOk": credential_json_ok,
            "credentialProjectId": credential_project_id,
            "errorType": type(exc).__name__,
            "error": str(exc),
        }


@app.get("/exam-concepts/{exam}")
async def exam_concepts_endpoint(exam: str):
    """Concept ids for a curriculum track.

    - ACT / ACT_MATH: act_relevance.tested (~29 concepts)
    - MIDDLE_SCHOOL / HIGH_SCHOOL: foundational + core levels (~29 concepts)
    """
    scope = _exam_curriculum_scope(exam)
    key = exam.strip().upper()
    source = (
        "act_relevance.tested" if key in ("ACT", "ACT_MATH", "GENERAL")
        else "ontology_level.foundational_core" if key in ("MIDDLE_SCHOOL", "HIGH_SCHOOL")
        else "unsupported"
    )
    if scope:
        return {"exam": exam, "conceptIds": sorted(scope), "source": source}
    return {"exam": exam, "conceptIds": [], "source": source}

@app.get("/knowledge-graph/{student_id}")
async def knowledge_graph_endpoint(student_id: str, auth: AuthContext = Depends(require_auth)):
    """
    Returns all data needed to render the interactive knowledge graph.
    
    - Concept positions (PCA projected x,y coordinates)
    - Ontology edges with weights
    - Per-concept mastery and strength scores
    - Student mastery and strength points
    - Ingredient list per concept (for click-to-expand)
    """
    authorize_student(auth, student_id)
    from mindcraft_graph.firestore_adapter import load_student_events_with_learning
    
    events = load_student_events_with_learning(student_id)
    
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
