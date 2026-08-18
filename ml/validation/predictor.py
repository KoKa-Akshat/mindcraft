"""Small item-aware success predictor used by the validation harness."""

from __future__ import annotations

from dataclasses import dataclass
from math import exp
from typing import Literal


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
    level_scale: float = 0.0


DEFAULT_PARAMS = PredictorParams()


IngredientAggregator = Literal["min", "mean"]


@dataclass(frozen=True)
class IngredientPredictorParams:
    """The pre-registered two parameters for an ingredient ability arm."""

    discrimination: float = 4.0
    ingredient_weight: float = 1.0


DEFAULT_INGREDIENT_PARAMS = IngredientPredictorParams()


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


def aggregate_ingredient_mastery(
    ingredient_mastery: tuple[float, ...] | list[float],
    aggregator: IngredientAggregator,
) -> float:
    """Aggregate resolved ingredient ability with a declared comparison arm."""
    if not ingredient_mastery:
        raise ValueError("ingredient_mastery must be non-empty")
    if aggregator == "min":
        return min(ingredient_mastery)
    if aggregator == "mean":
        return sum(ingredient_mastery) / len(ingredient_mastery)
    raise ValueError(f"Unknown ingredient aggregator: {aggregator}")


def predict_ingredient(
    *,
    ingredient_mastery: tuple[float, ...] | list[float],
    concept_mastery_fallback: float,
    item: ItemParams,
    params: IngredientPredictorParams = DEFAULT_INGREDIENT_PARAMS,
    aggregator: IngredientAggregator = "min",
) -> float:
    """Return P(correct), falling back to concept ability when unresolved."""
    ability = (
        aggregate_ingredient_mastery(ingredient_mastery, aggregator)
        if ingredient_mastery
        else concept_mastery_fallback
    )
    theta = params.ingredient_weight * ability
    return sigmoid(params.discrimination * (theta - item.failure_prior))
