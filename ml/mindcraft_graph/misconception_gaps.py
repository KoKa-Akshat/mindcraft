"""Misconception-gap scoring for the recommendation payload."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import json


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def build_misconception_ingredient_reverse_map(ontology_data: dict[str, Any]) -> dict[str, str]:
    """Map canonical misconception families and diagnostic tags to ingredient ids."""
    out: dict[str, str] = {}
    for concept in ontology_data.get("concepts", []):
        for ingredient in concept.get("ingredients", []):
            ingredient_id = ingredient.get("id")
            if not ingredient_id:
                continue
            keys = [ingredient.get("canonical_misconception_family")]
            keys.extend(ingredient.get("diagnostic_tags") or [])
            for key in keys:
                if isinstance(key, str) and key.startswith("mis_") and key not in out:
                    out[key] = ingredient_id
    return out


def load_distractor_priors(priors_dir: Path, concept_ids: set[str]) -> dict[tuple[str, str], dict]:
    """Load optional population priors keyed by (concept_id, misconception_id)."""
    priors: dict[tuple[str, str], dict] = {}
    for concept_id in concept_ids:
        path = priors_dir / f"{concept_id}.json"
        if not path.exists():
            continue
        try:
            raw = json.loads(path.read_text())
        except Exception:
            continue
        items = raw.get("distractors") if isinstance(raw, dict) else raw
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            misconception_id = item.get("misconception_id") or item.get("misconceptionId")
            if not misconception_id:
                continue
            priors[(concept_id, misconception_id)] = item
    return priors


def _prior_values(priors: dict[tuple[str, str], dict], concept_id: str, misconception_id: str) -> tuple[float | None, int]:
    prior = priors.get((concept_id, misconception_id))
    if not prior:
        return None, 0
    hit_rate = prior.get("observed_hit_rate")
    if hit_rate is None:
        hit_rate = prior.get("populationHitRate")
    n = prior.get("n_observations")
    if n is None:
        n = prior.get("nObservations", 0)
    try:
        return float(hit_rate), int(n)
    except (TypeError, ValueError):
        return None, 0


def build_misconception_gaps(
    observations: list[dict],
    *,
    misconception_to_ingredient: dict[str, str],
    priors: dict[tuple[str, str], dict] | None = None,
    now: datetime | None = None,
    recency_days: int = 60,
) -> list[dict]:
    """Build contractual misconceptionGaps[] from recent attempt observations."""
    now = now or datetime.now()
    cutoff = now - timedelta(days=recency_days)
    priors = priors or {}

    by_concept: dict[str, list[dict]] = defaultdict(list)
    for obs in observations:
        ts = obs.get("timestamp")
        if isinstance(ts, datetime) and ts < cutoff:
            continue
        concept_id = obs.get("concept_id") or obs.get("conceptId")
        if not concept_id:
            continue
        by_concept[str(concept_id)].append(obs)

    gaps: list[dict] = []
    for concept_id, concept_obs in by_concept.items():
        tagged = [
            obs for obs in concept_obs
            if obs.get("misconception_id") or obs.get("misconceptionId")
        ]
        tagged_attempts = len(tagged)
        if tagged_attempts == 0:
            continue

        hits_by_misc: Counter[str] = Counter(
            str(obs.get("misconception_id") or obs.get("misconceptionId"))
            for obs in tagged
        )
        choice_by_misc: dict[str, Counter[int]] = defaultdict(Counter)
        for obs in tagged:
            mis_id = str(obs.get("misconception_id") or obs.get("misconceptionId"))
            choice = obs.get("selected_choice_index")
            if choice is None:
                choice = obs.get("selectedChoiceIndex")
            if choice is not None:
                try:
                    choice_by_misc[mis_id][int(choice)] += 1
                except (TypeError, ValueError):
                    pass

        for misconception_id, hits in hits_by_misc.items():
            population_hit_rate, n_observations = _prior_values(priors, concept_id, misconception_id)
            has_population = population_hit_rate is not None and n_observations >= 30
            has_personal = tagged_attempts >= 2
            if not (has_population or has_personal):
                continue

            personal_hit_rate = hits / max(1, tagged_attempts)
            population_component = 0.4 * population_hit_rate if population_hit_rate is not None else 0.0
            severity = clamp01(0.6 * personal_hit_rate + population_component)
            if severity < 0.25:
                continue

            modal_choice = None
            if choice_by_misc[misconception_id]:
                modal_choice = choice_by_misc[misconception_id].most_common(1)[0][0]

            gaps.append({
                "conceptId": concept_id,
                "ingredientId": misconception_to_ingredient.get(misconception_id),
                "misconceptionId": misconception_id,
                "distractorChoiceIndex": modal_choice,
                "personalHitRate": round(personal_hit_rate, 4),
                "populationHitRate": round(population_hit_rate, 4) if population_hit_rate is not None else None,
                "nObservations": n_observations,
                "severity": round(severity, 4),
            })

    return sorted(gaps, key=lambda gap: gap["severity"], reverse=True)
