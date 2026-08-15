"""Small item-aware success predictor used by the validation harness."""
from __future__ import annotations

from dataclasses import dataclass
from math import exp


@dataclass(frozen=True)
class ThetaInputs:
    concept_mastery: float
    format_mastery: float | None = None


@dataclass(frozen=True)
class ItemParams:
    failure_prior: float
    level: int = 1


@dataclass(frozen=True)
class PredictorParams:
    discrimination: float = 4.0
    concept_weight: float = 1.0
    format_weight: float = 0.0
    level_scale: float = 0.1


DEFAULT_PARAMS = PredictorParams()


def sigmoid(value: float) -> float:
    """Numerically stable logistic function."""
    if value >= 0:
        z = exp(-value)
        return 1.0 / (1.0 + z)
    z = exp(value)
    return z / (1.0 + z)


def predict(
    theta_inputs: ThetaInputs,
    item: ItemParams,
    params: PredictorParams = DEFAULT_PARAMS,
) -> float:
    """Return P(correct) from learner state and ontology-supplied difficulty."""
    format_mastery = theta_inputs.format_mastery
    theta = params.concept_weight * theta_inputs.concept_mastery
    if format_mastery is not None:
        theta += params.format_weight * format_mastery
    difficulty = item.failure_prior + params.level_scale * (item.level - 1)
    return sigmoid(params.discrimination * (theta - difficulty))
