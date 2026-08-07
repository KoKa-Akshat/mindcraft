#!/usr/bin/env python3
"""Build auditable Eedi misconception -> ingredient ground truth.

The deterministic proposal stage is concept-scoped.  Embeddings may confirm only
high-similarity, high-margin proposals; all other proposals require an offline
LLM or a human decision.  This script never changes the frontend question bank.

Typical runs (from the repository root)::

    ml/mindcraft/bin/python ml/scripts/enrich_ingredient_labels.py --proposal-only
    LLM_PROVIDER=groq ml/mindcraft/bin/python ml/scripts/enrich_ingredient_labels.py

The second form checkpoints every confirmation, so it is safe to resume.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable

import numpy as np

ML_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ML_ROOT.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from mindcraft_graph.models.concept import Concept, build_concept_id_registry  # noqa: E402
from mindcraft_graph.representation.embeddings import (  # noqa: E402
    DEFAULT_MODEL_NAME,
    embed_texts,
    load_sentence_transformer,
)

ONTOLOGY_PATH = ML_ROOT / "data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
L2_PATH = ML_ROOT / "data/5_level_ontology/02_question_archetype_ontology_v1_6_standardized.json"
L3_PATH = ML_ROOT / "data/5_level_ontology/03_question_instance_bank_schema_and_seed_v1_6.json"
EEDI_PATH = REPO_ROOT / "app/src/data/eediQuestions.json"
MAP_PATH = ML_ROOT / "data/misconception_ingredient_map.json"
LABELS_PATH = ML_ROOT / "data/eedi_ingredient_labels.json"
REVIEW_PATH = ML_ROOT / "data/ingredient_enrichment_human_review.json"
CHECKPOINT_PATH = ML_ROOT / "data/.ingredient_enrichment_llm_checkpoint.json"

PROVENANCES = {"embedding", "llm", "human"}


@dataclass(frozen=True)
class IngredientCandidate:
    ingredient_id: str
    concept_id: str
    label: str
    description: str
    failure_mode: str
    canonical_family: str | None

    @property
    def same_genre_text(self) -> str:
        if self.canonical_family:
            return misconception_slug_text(self.canonical_family)
        return self.failure_mode or self.label

    @property
    def cross_genre_text(self) -> str:
        return ". ".join(x for x in (self.label, self.description, self.failure_mode) if x)


@dataclass(frozen=True)
class Misconception:
    misconception_id: str
    label: str
    concept_id: str


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def misconception_slug_text(value: str) -> str:
    """Turn ``mis_concept__descriptive_slug`` into descriptive prose."""
    tail = value.split("__", 1)[-1]
    return re.sub(r"\s+", " ", tail.replace("_", " ")).strip()


def load_ingredients(ontology: dict[str, Any]) -> tuple[dict[str, list[IngredientCandidate]], dict[str, IngredientCandidate]]:
    by_concept: dict[str, list[IngredientCandidate]] = {}
    by_id: dict[str, IngredientCandidate] = {}
    for concept in ontology.get("concepts", []):
        concept_id = str(concept["id"])
        candidates = []
        for raw in concept.get("ingredients", []):
            item = IngredientCandidate(
                ingredient_id=str(raw["id"]),
                concept_id=concept_id,
                label=str(raw.get("label") or ""),
                description=str(raw.get("description") or ""),
                failure_mode=str(raw.get("failure_mode") or ""),
                canonical_family=raw.get("canonical_misconception_family") or None,
            )
            if item.ingredient_id in by_id:
                raise ValueError(f"Duplicate ingredient id: {item.ingredient_id}")
            candidates.append(item)
            by_id[item.ingredient_id] = item
        by_concept[concept_id] = sorted(candidates, key=lambda x: x.ingredient_id)
    return by_concept, by_id


def resolve_concept_id(source_id: str, registry: dict[str, str]) -> str:
    resolved = registry.get(source_id)
    if not resolved:
        raise ValueError(f"Unresolved Eedi conceptId {source_id!r}")
    return resolved


def load_eedi_misconceptions(
    questions: list[dict[str, Any]], concept_registry: dict[str, str]
) -> tuple[list[Misconception], dict[str, list[str]]]:
    """Return one canonical record per misconception and question ids by misconception."""
    records: dict[str, Misconception] = {}
    question_ids: dict[str, list[str]] = defaultdict(list)
    for offset, question in enumerate(questions):
        question_id = str(question.get("id") or f"row-{offset}")
        source_concept = str(question.get("conceptId") or "")
        concept_id = resolve_concept_id(source_concept, concept_registry)
        misconception_id = str(question.get("misconception_id") or "").strip()
        if not misconception_id:
            continue
        label = str(question.get("misconception_label") or misconception_slug_text(misconception_id)).strip()
        record = Misconception(misconception_id, label, concept_id)
        existing = records.get(misconception_id)
        if existing and existing.concept_id != concept_id:
            raise ValueError(
                f"Misconception {misconception_id!r} crosses concepts: "
                f"{existing.concept_id!r} and {concept_id!r}"
            )
        records[misconception_id] = record
        question_ids[misconception_id].append(question_id)
    return sorted(records.values(), key=lambda x: x.misconception_id), dict(question_ids)


def _normalise(matrix: np.ndarray) -> np.ndarray:
    matrix = np.asarray(matrix, dtype=np.float32)
    return matrix / np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-9)


def rank_proposals(
    misconceptions: list[Misconception],
    ingredients_by_concept: dict[str, list[IngredientCandidate]],
    embedder: Callable[[list[str]], np.ndarray],
) -> tuple[dict[str, dict[str, Any]], dict[str, float]]:
    """Rank top-three candidates, including same/cross-genre margin metrics."""
    all_candidates = [item for cid in sorted(ingredients_by_concept) for item in ingredients_by_concept[cid]]
    if not misconceptions or not all_candidates:
        return {}, {"same_genre_margin_median": 0.0, "cross_genre_margin_median": 0.0, "margin_lift": 0.0}
    mis_vectors = _normalise(embedder([m.label for m in misconceptions]))
    same_vectors = _normalise(embedder([i.same_genre_text for i in all_candidates]))
    cross_vectors = _normalise(embedder([i.cross_genre_text for i in all_candidates]))
    positions = {item.ingredient_id: idx for idx, item in enumerate(all_candidates)}
    proposals: dict[str, dict[str, Any]] = {}
    same_margins: list[float] = []
    cross_margins: list[float] = []
    for row, misconception in enumerate(misconceptions):
        candidates = ingredients_by_concept.get(misconception.concept_id, [])
        if not candidates:
            raise ValueError(f"Concept {misconception.concept_id!r} has no ingredient candidates")
        idx = np.asarray([positions[c.ingredient_id] for c in candidates], dtype=np.int64)
        same_scores = same_vectors[idx] @ mis_vectors[row]
        cross_scores = cross_vectors[idx] @ mis_vectors[row]
        order = sorted(range(len(candidates)), key=lambda j: (-float(same_scores[j]), candidates[j].ingredient_id))
        ranked = [
            {"ingredient_id": candidates[j].ingredient_id, "similarity": round(float(same_scores[j]), 6)}
            for j in order[:3]
        ]
        top1 = float(same_scores[order[0]])
        second = float(same_scores[order[1]]) if len(order) > 1 else top1
        cross_order = sorted(range(len(candidates)), key=lambda j: (-float(cross_scores[j]), candidates[j].ingredient_id))
        cross_second = float(cross_scores[cross_order[1]]) if len(cross_order) > 1 else float(cross_scores[cross_order[0]])
        same_margin = top1 - second
        cross_margin = float(cross_scores[cross_order[0]]) - cross_second
        same_margins.append(same_margin)
        cross_margins.append(cross_margin)
        proposals[misconception.misconception_id] = {
            "concept_id": misconception.concept_id,
            "misconception_label": misconception.label,
            "candidates": ranked,
            "top1_sim": round(top1, 6),
            "rank1_2_margin": round(same_margin, 6),
            "cross_genre_margin": round(cross_margin, 6),
        }
    same_median = float(np.median(same_margins))
    cross_median = float(np.median(cross_margins))
    return proposals, {
        "same_genre_margin_median": round(same_median, 6),
        "cross_genre_margin_median": round(cross_median, 6),
        "margin_lift": round(same_median - cross_median, 6),
    }


def passes_auto_accept(proposal: dict[str, Any], similarity_threshold: float, margin_threshold: float) -> bool:
    return proposal["top1_sim"] >= similarity_threshold and proposal["rank1_2_margin"] >= margin_threshold


def load_human_decisions(path: Path | None, valid_ingredients: set[str]) -> dict[str, str | None]:
    if path is None or not path.exists():
        return {}
    payload = load_json(path)
    raw = payload.get("decisions", payload) if isinstance(payload, dict) else {}
    out: dict[str, str | None] = {}
    for misconception_id, value in raw.items():
        ingredient_id = value.get("ingredient_id") if isinstance(value, dict) else value
        if ingredient_id in (None, "none", "NONE", ""):
            out[str(misconception_id)] = None
        elif ingredient_id not in valid_ingredients:
            raise ValueError(f"Unknown human-selected ingredient {ingredient_id!r}")
        else:
            out[str(misconception_id)] = str(ingredient_id)
    return out


def make_llm_prompt(misconception: Misconception, candidates: list[IngredientCandidate]) -> str:
    options = "\n".join(
        f"- {item.ingredient_id}: {item.label}. {item.description} Failure pattern: {item.failure_mode}"
        for item in candidates
    )
    return (
        "Choose which ingredient is most directly failed by the misconception. "
        "Choose exactly one listed ingredient only when it genuinely fits; otherwise choose none.\n\n"
        f"Concept: {misconception.concept_id}\n"
        f"Misconception: {misconception.label}\n\nCandidates:\n{options}\n\n"
        'Return JSON only: {"ingredient_id":"<listed id or none>","confidence":<0 to 1>}.'
    )


def parse_llm_choice(raw: str, allowed: set[str]) -> tuple[str | None, float]:
    match = re.search(r"\{.*?\}", raw, flags=re.DOTALL)
    if not match:
        raise ValueError("LLM response did not contain a JSON object")
    payload = json.loads(match.group(0))
    choice = str(payload.get("ingredient_id") or "none").strip()
    confidence = float(payload.get("confidence", 0.0))
    if not 0.0 <= confidence <= 1.0:
        raise ValueError("LLM confidence must be between 0 and 1")
    if choice.lower() == "none":
        return None, confidence
    if choice not in allowed:
        raise ValueError(f"LLM selected out-of-scope ingredient {choice!r}")
    return choice, confidence


def confirm_mappings(
    misconceptions: list[Misconception],
    ingredients_by_concept: dict[str, list[IngredientCandidate]],
    proposals: dict[str, dict[str, Any]],
    *,
    similarity_threshold: float,
    margin_threshold: float,
    human_decisions: dict[str, str | None],
    llm_complete: Callable[[str], str | None] | None,
    checkpoint: dict[str, dict[str, Any]] | None = None,
    checkpoint_path: Path | None = None,
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """Resolve proposals with human > gated embedding > checkpoint/LLM precedence."""
    confirmed: dict[str, dict[str, Any]] = {}
    review: list[dict[str, Any]] = []
    checkpoint = checkpoint if checkpoint is not None else {}
    for misconception in misconceptions:
        mid = misconception.misconception_id
        proposal = proposals[mid]
        candidates = ingredients_by_concept[misconception.concept_id]
        allowed = {c.ingredient_id for c in candidates}
        choice: str | None
        confidence: float
        provenance: str
        if mid in human_decisions:
            choice, confidence, provenance = human_decisions[mid], 1.0, "human"
        elif passes_auto_accept(proposal, similarity_threshold, margin_threshold):
            choice = proposal["candidates"][0]["ingredient_id"]
            confidence = proposal["top1_sim"]
            provenance = "embedding"
        else:
            cached = checkpoint.get(mid)
            if cached is not None:
                choice = cached.get("ingredient_id")
                confidence = float(cached.get("confidence", 0.0))
                provenance = "llm"
            elif llm_complete is not None:
                raw = llm_complete(make_llm_prompt(misconception, candidates))
                if raw is None:
                    choice, confidence, provenance = None, 0.0, "llm"
                else:
                    try:
                        choice, confidence = parse_llm_choice(raw, allowed)
                    except (ValueError, json.JSONDecodeError) as exc:
                        review.append({**proposal, "reason": "invalid_llm_response", "detail": str(exc)})
                        continue
                    provenance = "llm"
                    checkpoint[mid] = {"ingredient_id": choice, "confidence": confidence}
                    if checkpoint_path:
                        write_json(checkpoint_path, checkpoint)
            else:
                review.append({**proposal, "reason": "confirmation_required"})
                continue
        if choice is None:
            review.append({**proposal, "reason": f"{provenance}_none", "confidence": confidence})
            continue
        if choice not in allowed:
            raise ValueError(f"{provenance} decision crosses concept for {mid}: {choice}")
        if provenance not in PROVENANCES:
            raise ValueError(f"Invalid provenance {provenance!r}")
        confirmed[mid] = {
            "ingredient_id": choice,
            "confidence": round(confidence, 6),
            "provenance": provenance,
            "alternates": [x for x in proposal["candidates"] if x["ingredient_id"] != choice],
            "concept_id": misconception.concept_id,
        }
    return confirmed, review


def propagate_question_labels(
    questions: list[dict[str, Any]], confirmed: dict[str, dict[str, Any]]
) -> dict[str, list[str]]:
    labels: dict[str, list[str]] = {}
    for offset, question in enumerate(questions):
        mid = str(question.get("misconception_id") or "")
        mapping = confirmed.get(mid)
        if mapping:
            labels[str(question.get("id") or f"row-{offset}")] = [mapping["ingredient_id"]]
    return labels


def anchor_truth(by_id: dict[str, IngredientCandidate]) -> dict[str, set[str]]:
    """Return every hand-authored family link, retaining shared-family anchors."""
    out: dict[str, set[str]] = defaultdict(set)
    for item in by_id.values():
        if item.canonical_family:
            out[item.canonical_family].add(item.ingredient_id)
    return dict(out)


def threshold_sweep(
    proposals: dict[str, dict[str, Any]],
    anchors: dict[str, set[str]],
    similarity_thresholds: Iterable[float] = (0.55, 0.60, 0.65, 0.70, 0.75),
    margin_thresholds: Iterable[float] = (0.10, 0.15, 0.20),
) -> list[dict[str, Any]]:
    """Calibrate the shortcut only against pre-existing ontology anchors."""
    eligible = {mid: expected for mid, expected in anchors.items() if mid in proposals}
    rows = []
    for similarity in similarity_thresholds:
        for margin in margin_thresholds:
            accepted = [mid for mid in eligible if passes_auto_accept(proposals[mid], similarity, margin)]
            correct = sum(proposals[mid]["candidates"][0]["ingredient_id"] in eligible[mid] for mid in accepted)
            rows.append({
                "similarity_threshold": similarity,
                "margin_threshold": margin,
                "accepted": len(accepted),
                "correct": correct,
                "accuracy": round(correct / len(accepted), 6) if accepted else None,
                "eligible_anchor_families": len(eligible),
            })
    return rows


def l3_truth(layer3: dict[str, Any]) -> list[tuple[str, set[str]]]:
    out = []
    for instance in layer3.get("question_instances", []):
        links = instance.get("links", {})
        ingredient_ids = set(links.get("ingredient_ids") or [])
        misconception_ids = links.get("misconception_ids") or []
        for mid in misconception_ids:
            if ingredient_ids:
                out.append((str(mid), ingredient_ids))
    return out


def load_archetype_holdouts(
    layer3: dict[str, Any],
    layer2: dict[str, Any],
    by_id: dict[str, IngredientCandidate],
) -> tuple[list[Misconception], dict[str, set[str]]]:
    """Represent the L3 rows joinable to a single Layer-2 archetype as held-out
    per-concept checks: question -> question_archetype_ids -> archetype's
    required_ingredient_ids. A question can require ingredients from several
    concepts at once, so it is split into one record per concept touched
    (each scoped only to that concept's own candidates, per C-1)."""
    archetypes_by_id = {str(a["archetype_id"]): a for a in layer2.get("archetypes", [])}
    records: list[Misconception] = []
    expected: dict[str, set[str]] = {}
    for instance in layer3.get("question_instances", []):
        links = instance.get("links", {})
        archetype_ids = links.get("question_archetype_ids") or []
        if len(archetype_ids) != 1:
            continue
        archetype = archetypes_by_id.get(str(archetype_ids[0]))
        if not archetype:
            continue
        required = [iid for iid in (archetype.get("required_ingredient_ids") or []) if iid in by_id]
        if not required:
            continue
        by_concept_ids: dict[str, set[str]] = defaultdict(set)
        for iid in required:
            by_concept_ids[by_id[iid].concept_id].add(iid)
        family = str(archetype.get("question_family") or "")
        path = " -> ".join(archetype.get("concept_path_template") or [])
        label = ". ".join(x for x in (family, path) if x) or str(archetype_ids[0])
        for concept_id, ids in sorted(by_concept_ids.items()):
            holdout_id = f"archetype::{instance['question_instance_id']}::{concept_id}"
            records.append(Misconception(holdout_id, label, concept_id))
            expected[holdout_id] = ids
    return sorted(records, key=lambda x: x.misconception_id), expected


def gold_spot_check_report(
    cohorts: dict[str, tuple[dict[str, dict[str, Any]], dict[str, set[str]]]],
) -> dict[str, Any]:
    """C-6 gold spot-check: accuracy on the reserved 15 L3 + 30 archetype-join
    labels, reported per cohort and split by provenance (auto-accepted
    embedding vs LLM-confirmed). Never used as tuning input elsewhere."""
    out: dict[str, Any] = {}
    combined_by_provenance: dict[str, list[bool]] = defaultdict(list)
    combined_total = 0
    combined_hit = 0
    for name, (confirmed, expected) in cohorts.items():
        by_provenance: dict[str, list[bool]] = defaultdict(list)
        hit = 0
        for mid, ids in expected.items():
            mapping = confirmed.get(mid)
            correct = bool(mapping) and mapping["ingredient_id"] in ids
            hit += int(correct)
            if mapping:
                by_provenance[mapping["provenance"]].append(correct)
                combined_by_provenance[mapping["provenance"]].append(correct)
        combined_total += len(expected)
        combined_hit += hit
        out[name] = {
            "hit": hit,
            "total": len(expected),
            "rate": round(hit / len(expected), 6) if expected else None,
            "confirmed": sum(mid in confirmed for mid in expected),
            "by_provenance": {
                key: {"correct": sum(values), "total": len(values), "accuracy": round(sum(values) / len(values), 6)}
                for key, values in sorted(by_provenance.items())
            },
        }
    out["combined"] = {
        "hit": combined_hit,
        "total": combined_total,
        "rate": round(combined_hit / combined_total, 6) if combined_total else None,
        "by_provenance": {
            key: {"correct": sum(values), "total": len(values), "accuracy": round(sum(values) / len(values), 6)}
            for key, values in sorted(combined_by_provenance.items())
        },
    }
    return out


def load_l3_holdouts(
    layer3: dict[str, Any],
    by_id: dict[str, IngredientCandidate],
    concept_registry: dict[str, str],
) -> tuple[list[Misconception], dict[str, set[str]]]:
    """Represent each of the 15 labeled L3 rows as a held-out 1-of-concept check."""
    records: list[Misconception] = []
    expected: dict[str, set[str]] = {}
    for instance in layer3.get("question_instances", []):
        links = instance.get("links", {})
        ingredient_ids = {iid for iid in links.get("ingredient_ids", []) if iid in by_id}
        if not ingredient_ids:
            continue
        raw_concepts = links.get("primary_concept_ids") or links.get("concept_ids") or []
        concept_id = ""
        for raw in raw_concepts:
            try:
                resolved = resolve_concept_id(str(raw), concept_registry)
            except ValueError:
                continue
            if any(by_id[iid].concept_id == resolved for iid in ingredient_ids):
                concept_id = resolved
                break
        if not concept_id:
            concept_id = sorted({by_id[iid].concept_id for iid in ingredient_ids})[0]
        in_scope_truth = {iid for iid in ingredient_ids if by_id[iid].concept_id == concept_id}
        if not in_scope_truth:
            continue
        intelligence = instance.get("intelligence", {})
        raw_question = instance.get("raw_question", {})
        label = str(
            intelligence.get("student_misconception_risks")
            or intelligence.get("skill_gap_if_wrong")
            or raw_question.get("summary")
            or raw_question.get("text")
            or instance["question_instance_id"]
        ).strip()
        holdout_id = f"l3::{instance['question_instance_id']}"
        records.append(Misconception(holdout_id, label, concept_id))
        expected[holdout_id] = in_scope_truth
    return sorted(records, key=lambda x: x.misconception_id), expected


def validation_report(
    confirmed: dict[str, dict[str, Any]],
    proposals: dict[str, dict[str, Any]],
    by_id: dict[str, IngredientCandidate],
    layer3: dict[str, Any],
    question_labels: dict[str, list[str]],
    margin_metrics: dict[str, float],
    spot_checks: dict[str, str | None] | None = None,
    l3_holdout_confirmed: dict[str, dict[str, Any]] | None = None,
    l3_holdout_expected: dict[str, set[str]] | None = None,
    misconception_concepts: dict[str, str] | None = None,
) -> dict[str, Any]:
    anchors = anchor_truth(by_id)
    eligible_anchors = {mid: ids for mid, ids in anchors.items() if mid in proposals}
    anchor_hits = sum(confirmed.get(mid, {}).get("ingredient_id") in ids for mid, ids in eligible_anchors.items())
    proposal_anchor_hits = sum(
        proposals[mid]["candidates"][0]["ingredient_id"] in ids
        for mid, ids in eligible_anchors.items()
    )
    # Some ontology `canonical_misconception_family` anchors point at an ingredient
    # in a DIFFERENT concept than the one Eedi's own conceptId tagging assigns to
    # that same misconception text. C-1 forbids the pipeline from ever crossing
    # concepts, so those anchors are structurally unreachable regardless of
    # pipeline quality -- report the C-1-respecting subset separately so the bar
    # is measured against what the pipeline could possibly satisfy.
    same_concept_eligible: dict[str, set[str]] = {}
    cross_concept_anchor_families: list[str] = []
    if misconception_concepts is not None:
        for mid, ids in eligible_anchors.items():
            mis_concept = misconception_concepts.get(mid)
            ing_concepts = {by_id[i].concept_id for i in ids if i in by_id}
            if mis_concept is not None and mis_concept in ing_concepts:
                same_concept_eligible[mid] = ids
            else:
                cross_concept_anchor_families.append(mid)
    same_concept_hits = sum(
        confirmed.get(mid, {}).get("ingredient_id") in ids for mid, ids in same_concept_eligible.items()
    )
    l3 = l3_truth(layer3)
    l3_hits = sum(confirmed.get(mid, {}).get("ingredient_id") in ids for mid, ids in l3)
    l3_joinable = sum(1 for mid, _ in l3 if mid in proposals)
    counts = Counter(iid for ids in question_labels.values() for iid in ids)
    per_concept: dict[str, dict[str, int]] = defaultdict(lambda: {"ingredients_with_1": 0, "ingredients_with_3": 0, "labels": 0})
    for iid, item in by_id.items():
        count = counts[iid]
        per_concept[item.concept_id]["labels"] += count
        per_concept[item.concept_id]["ingredients_with_1"] += int(count >= 1)
        per_concept[item.concept_id]["ingredients_with_3"] += int(count >= 3)
    provenance = Counter(item["provenance"] for item in confirmed.values())
    report: dict[str, Any] = {
        "confirmed_mappings": len(confirmed),
        "question_labels": len(question_labels),
        "provenance_counts": dict(sorted(provenance.items())),
        "anchor_self_consistency": {
            "hit": anchor_hits,
            "eligible_families": len(eligible_anchors),
            "ontology_families": len(anchors),
            "ontology_anchor_links": sum(len(ids) for ids in anchors.values()),
            "rate": round(anchor_hits / len(eligible_anchors), 6) if eligible_anchors else None,
            "proposal_top1_hit": proposal_anchor_hits,
            "proposal_top1_rate": round(proposal_anchor_hits / len(eligible_anchors), 6) if eligible_anchors else None,
            "same_concept_eligible_families": len(same_concept_eligible) if misconception_concepts is not None else None,
            "same_concept_hit": same_concept_hits if misconception_concepts is not None else None,
            "same_concept_rate": (
                round(same_concept_hits / len(same_concept_eligible), 6) if same_concept_eligible else None
            ),
            "cross_concept_anchor_families": sorted(cross_concept_anchor_families) if misconception_concepts is not None else None,
            "note": (
                "`rate` includes ontology canonical_misconception_family anchors whose linked "
                "ingredient sits in a DIFFERENT concept than Eedi's own conceptId tagging of that "
                "misconception. C-1 forbids the pipeline from ever crossing concepts, so those are "
                "structurally unreachable; `same_concept_rate` is the bar the pipeline can actually "
                "be held to."
            ),
        },
        "l3_reproduction": {
            "hit": l3_hits,
            "total": len(l3),
            "rate": round(l3_hits / len(l3), 6) if l3 else None,
            "joinable": l3_joinable,
            "note": (
                "Only L3 rows carrying both misconception_ids and ingredient_ids are directly "
                "joinable, AND only if the L3 misconception_id string also exists in Eedi's "
                "canonical mis_{concept}__{slug} namespace. L3's `links.misconception_ids` are "
                "free-text slugs authored independently of that namespace (0/10 ever overlap in "
                "this dataset), so `joinable` is expected to be 0 and `rate` is not a meaningful "
                "measure of pipeline quality here -- see `l3_labeled_instance_holdout` and "
                "`gold_spot_check` for the real reproduction tests, which score the pipeline's own "
                "candidates rather than requiring an id string match."
            ),
        },
        "coverage": {
            "ingredients_with_1": sum(value >= 1 for value in counts.values()),
            "ingredients_with_3": sum(value >= 3 for value in counts.values()),
            "per_concept": dict(sorted(per_concept.items())),
        },
        "embedding_margin": margin_metrics,
        "auto_accept_threshold_sweep": threshold_sweep(proposals, anchors),
    }
    if l3_holdout_expected is not None:
        l3_holdout_confirmed = l3_holdout_confirmed or {}
        holdout_hits = sum(
            l3_holdout_confirmed.get(mid, {}).get("ingredient_id") in ingredient_ids
            for mid, ingredient_ids in l3_holdout_expected.items()
        )
        report["l3_labeled_instance_holdout"] = {
            "hit": holdout_hits,
            "total": len(l3_holdout_expected),
            "rate": round(holdout_hits / len(l3_holdout_expected), 6) if l3_holdout_expected else None,
            "confirmed": sum(mid in l3_holdout_confirmed for mid in l3_holdout_expected),
        }
    if spot_checks:
        checked = [(mid, expected, confirmed.get(mid)) for mid, expected in spot_checks.items() if expected]
        by_provenance: dict[str, list[bool]] = defaultdict(list)
        for _mid, expected, actual in checked:
            if actual:
                by_provenance[actual["provenance"]].append(actual["ingredient_id"] == expected)
        report["human_spot_check"] = {
            "total": len(checked),
            "by_provenance": {
                key: {"correct": sum(values), "total": len(values), "accuracy": round(sum(values) / len(values), 6)}
                for key, values in sorted(by_provenance.items())
            },
        }
    return report


def load_checkpoint(path: Path) -> dict[str, dict[str, Any]]:
    return load_json(path) if path.exists() else {}


def load_local_env(path: Path = ML_ROOT / ".env.local") -> None:
    """Load the repo-local provider settings without overriding the shell."""
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def build_llm_completer() -> Callable[[str], str | None] | None:
    load_local_env()
    provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if provider != "groq" or not os.environ.get("GROQ_API_KEY"):
        return None
    from generation.llm_client import complete

    # This repo-local client uses stdlib HTTP, has bounded retry/backoff, and
    # surfaces terminal provider failures instead of silently returning None.
    return lambda prompt: complete(prompt, system="Return only the requested JSON object.", max_tokens=100, temperature=0.0)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proposal-only", action="store_true", help="skip LLM calls and queue below-bar mappings")
    parser.add_argument("--similarity-threshold", type=float, default=0.70)
    parser.add_argument("--margin-threshold", type=float, default=0.15)
    parser.add_argument("--human-decisions", type=Path, help="review decisions JSON; human choices override other paths")
    parser.add_argument("--spot-checks", type=Path, help="stratified human truth JSON used only for reporting")
    parser.add_argument(
        "--output-dir", type=Path,
        help="artifact directory; defaults to ml/data for confirmed runs and a safe proposal subdirectory for --proposal-only",
    )
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    output_dir = args.output_dir or (
        ML_ROOT / "data/ingredient_enrichment_proposal" if args.proposal_only else ML_ROOT / "data"
    )
    ontology = load_json(ONTOLOGY_PATH)
    questions = load_json(EEDI_PATH)
    layer3 = load_json(L3_PATH)
    layer2 = load_json(L2_PATH)
    by_concept, by_id = load_ingredients(ontology)
    concept_registry = build_concept_id_registry(
        [Concept.model_validate(item) for item in ontology["concepts"]]
    )
    misconceptions, _question_ids = load_eedi_misconceptions(questions, concept_registry)
    print(f"Loaded {len(misconceptions)} distinct Eedi misconceptions and {len(by_id)} ingredients")
    model = load_sentence_transformer()
    proposals, margin_metrics = rank_proposals(
        misconceptions, by_concept, lambda texts: embed_texts(model, texts, batch_size=128)
    )
    human = load_human_decisions(args.human_decisions, set(by_id))
    llm_complete = None if args.proposal_only else build_llm_completer()
    if not args.proposal_only and llm_complete is None:
        raise SystemExit("Live confirmation requires LLM_PROVIDER=groq and GROQ_API_KEY; use --proposal-only otherwise")
    checkpoint_path = output_dir / CHECKPOINT_PATH.name
    confirmed, review = confirm_mappings(
        misconceptions,
        by_concept,
        proposals,
        similarity_threshold=args.similarity_threshold,
        margin_threshold=args.margin_threshold,
        human_decisions=human,
        llm_complete=llm_complete,
        checkpoint=load_checkpoint(checkpoint_path),
        checkpoint_path=checkpoint_path if llm_complete else None,
    )
    # Reserved gold test set (C-6): the 15 L3 human `links.ingredient_ids` rows and
    # the 30 Layer-2 archetype-join rows. These must NEVER receive a human-decision
    # override -- that would let a prior "human" pass leak the answer into the very
    # check meant to test the pipeline's own (embedding/LLM) judgment. Pass an
    # empty human_decisions dict unconditionally, regardless of --human-decisions.
    l3_records, l3_expected = load_l3_holdouts(layer3, by_id, concept_registry)
    l3_proposals, _ = rank_proposals(
        l3_records, by_concept, lambda texts: embed_texts(model, texts, batch_size=128)
    )
    l3_confirmed, l3_review = confirm_mappings(
        l3_records,
        by_concept,
        l3_proposals,
        similarity_threshold=args.similarity_threshold,
        margin_threshold=args.margin_threshold,
        human_decisions={},
        llm_complete=llm_complete,
        checkpoint=load_checkpoint(checkpoint_path),
        checkpoint_path=checkpoint_path if llm_complete else None,
    )
    archetype_records, archetype_expected = load_archetype_holdouts(layer3, layer2, by_id)
    archetype_proposals, _ = rank_proposals(
        archetype_records, by_concept, lambda texts: embed_texts(model, texts, batch_size=128)
    )
    archetype_confirmed, archetype_review = confirm_mappings(
        archetype_records,
        by_concept,
        archetype_proposals,
        similarity_threshold=args.similarity_threshold,
        margin_threshold=args.margin_threshold,
        human_decisions={},
        llm_complete=llm_complete,
        checkpoint=load_checkpoint(checkpoint_path),
        checkpoint_path=checkpoint_path if llm_complete else None,
    )
    labels = propagate_question_labels(questions, confirmed)
    spot_checks = load_human_decisions(args.spot_checks, set(by_id)) if args.spot_checks else None
    misconception_concepts = {m.misconception_id: m.concept_id for m in misconceptions}
    report = validation_report(
        confirmed, proposals, by_id, layer3, labels, margin_metrics, spot_checks,
        l3_holdout_confirmed=l3_confirmed, l3_holdout_expected=l3_expected,
        misconception_concepts=misconception_concepts,
    )
    report["gold_spot_check"] = gold_spot_check_report({
        "l3_human_15": (l3_confirmed, l3_expected),
        "archetype_join_30": (archetype_confirmed, archetype_expected),
    })
    generated_at = datetime.now(timezone.utc).isoformat()
    map_payload = {
        "_meta": {
            "generated_at": generated_at,
            "model": DEFAULT_MODEL_NAME,
            "similarity_threshold": args.similarity_threshold,
            "margin_threshold": args.margin_threshold,
            "proposal_deterministic": True,
            "llm_temperature": 0,
            "validation": report,
        },
        # Single-item lists retain compatibility with the existing read-only serve consumer.
        "map": {mid: [mapping] for mid, mapping in sorted(confirmed.items())},
    }
    labels_payload = {"_meta": {"generated_at": generated_at, "question_count": len(labels)}, "labels": labels}
    review_payload = {
        "_meta": {"generated_at": generated_at, "count": len(review), "instructions": "Set decisions[misconception_id] to an in-concept ingredient_id or none."},
        "decisions": {},
        "queue": review,
        "l3_holdout_queue": l3_review,
        "archetype_holdout_queue": archetype_review,
    }
    write_json(output_dir / MAP_PATH.name, map_payload)
    write_json(output_dir / LABELS_PATH.name, labels_payload)
    write_json(output_dir / REVIEW_PATH.name, review_payload)
    print(json.dumps(report, indent=2, sort_keys=True))
    print(f"Wrote {len(confirmed)} confirmed mappings, {len(labels)} question labels, {len(review)} review items")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
