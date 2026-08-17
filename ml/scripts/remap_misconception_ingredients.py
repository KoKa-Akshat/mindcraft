#!/usr/bin/env python3
"""Remap Eedi misconceptions to ingredients with global retrieve/rerank/abstain.

The retrieval and rerank inputs deliberately exclude ontology benchmark fields.
Run from the repository root or ``ml`` directory::

    python ml/scripts/remap_misconception_ingredients.py --dry-run --limit 10
    LLM_PROVIDER=groq python ml/scripts/remap_misconception_ingredients.py
    LLM_PROVIDER=groq python ml/scripts/remap_misconception_ingredients.py --no-context

The acceptance threshold is a committed input, not selected while scoring the
test split.  The script writes the map, an abstention artifact, and a report.
Shipping any generated map remains subject to the Eedi licence gate documented
in ``agent_work/engine/MISCONCEPTION_INGREDIENT_REMAP_BUILD.md``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

ML_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ML_ROOT.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from mindcraft_graph.representation.embeddings import (  # noqa: E402
    DEFAULT_MODEL_NAME,
    embed_texts,
    load_sentence_transformer,
)

ONTOLOGY_PATH = ML_ROOT / "data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
MISCONCEPTIONS_PATH = ML_ROOT / "data/eedi_misconceptions.json"
QUESTIONS_PATH = REPO_ROOT / "app/src/data/eediQuestions.json"
INCUMBENT_PATH = ML_ROOT / "data/misconception_ingredient_map.json"
DEFAULT_OUT = ML_ROOT / "data/misconception_ingredient_map_v2.json"
DEFAULT_CACHE = ML_ROOT / "data/.misconception_ingredient_rerank_cache.json"
THRESHOLD_PATH = ML_ROOT / "data/misconception_remap_threshold.json"
TOP_K = 25
MAX_CONTEXTS = 5
RERANK_PROVENANCE = "rerank_v2"
FORBIDDEN_INPUT_FIELDS = ("diagnostic_tags", "canonical_misconception_family")


@dataclass(frozen=True)
class Ingredient:
    ingredient_id: str
    concept_id: str
    label: str
    description: str
    failure_mode: str
    negative_evidence: tuple[str, ...]

    @property
    def retrieval_text(self) -> str:
        # Same-genre failure evidence intentionally leads the representation.
        parts = [
            f"Failure mode: {self.failure_mode}",
            f"Ingredient: {self.label}. {self.description}",
        ]
        if self.negative_evidence:
            parts.append("Observable errors: " + "; ".join(self.negative_evidence))
        return "\n".join(part for part in parts if part.rstrip(": "))


@dataclass(frozen=True)
class QuestionContext:
    question_id: str
    concept_id: str
    stem: str
    correct_answer: str
    distractor: str


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def _as_text_tuple(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        return (value.strip(),) if value.strip() else ()
    if isinstance(value, list):
        return tuple(str(item).strip() for item in value if str(item).strip())
    return ()


def load_ingredients(ontology: dict[str, Any]) -> list[Ingredient]:
    """Load the complete global candidate bank without evaluation-only fields."""
    ingredients: list[Ingredient] = []
    seen: set[str] = set()
    for concept in ontology.get("concepts", []):
        concept_id = str(concept.get("id") or "")
        for raw in concept.get("ingredients", []):
            ingredient_id = str(raw.get("id") or "")
            if not ingredient_id or ingredient_id in seen:
                raise ValueError(f"Missing or duplicate ingredient id: {ingredient_id!r}")
            seen.add(ingredient_id)
            observable = raw.get("observable_evidence") or {}
            ingredients.append(
                Ingredient(
                    ingredient_id=ingredient_id,
                    concept_id=concept_id,
                    label=str(raw.get("label") or "").strip(),
                    description=str(raw.get("description") or "").strip(),
                    failure_mode=str(raw.get("failure_mode") or "").strip(),
                    negative_evidence=_as_text_tuple(observable.get("negative")),
                )
            )
    return sorted(ingredients, key=lambda item: item.ingredient_id)


def collect_question_contexts(questions: list[dict[str, Any]]) -> dict[str, list[QuestionContext]]:
    """Index every specifically tagged distractor slot by misconception id."""
    contexts: dict[str, list[QuestionContext]] = defaultdict(list)
    for offset, question in enumerate(questions):
        question_id = str(question.get("id") or f"row-{offset}")
        choices = question.get("choices") or []
        correct_index = question.get("correctIndex")
        correct = (
            str(choices[correct_index])
            if isinstance(correct_index, int) and 0 <= correct_index < len(choices)
            else ""
        )
        for distractor in question.get("distractor_taxonomy") or []:
            misconception_id = str(distractor.get("misconception_id") or "").strip()
            choice_index = distractor.get("choice_index")
            if not misconception_id or not isinstance(choice_index, int) or not 0 <= choice_index < len(choices):
                continue
            contexts[misconception_id].append(
                QuestionContext(
                    question_id=question_id,
                    concept_id=str(question.get("conceptId") or ""),
                    stem=str(question.get("question") or "").strip(),
                    correct_answer=correct.strip(),
                    distractor=str(choices[choice_index]).strip(),
                )
            )
    # Questions with multiple slots for the same misconception are more useful;
    # retain each distinct (question, distractor), ordered by that frequency.
    for misconception_id, rows in contexts.items():
        frequency = Counter(row.question_id for row in rows)
        unique = {(row.question_id, row.distractor): row for row in rows}
        contexts[misconception_id] = sorted(
            unique.values(), key=lambda row: (-frequency[row.question_id], row.question_id, row.distractor)
        )
    return dict(contexts)


def build_query(
    misconception_id: str,
    misconception: dict[str, Any],
    contexts: Sequence[QuestionContext],
    *,
    use_context: bool,
    max_contexts: int = MAX_CONTEXTS,
) -> tuple[str, int]:
    description = str(misconception.get("eedi_name") or "").strip()
    if not description:
        description = misconception_id.split("__", 1)[-1].replace("_", " ")
    lines = [f"Misconception: {description}"]
    selected = list(contexts[:max_contexts]) if use_context else []
    if selected:
        concepts = sorted({row.concept_id for row in selected if row.concept_id})
        if not concepts:
            concepts = sorted(str(x) for x in misconception.get("concept_ids") or [] if x)
        if concepts:
            lines.append("Question concepts (context only): " + ", ".join(concepts))
        for index, row in enumerate(selected, 1):
            lines.extend(
                [
                    f"Context {index} [{row.question_id}]",
                    f"Question: {row.stem}",
                    f"Correct answer: {row.correct_answer}",
                    f"Tagged distractor: {row.distractor}",
                ]
            )
    return "\n".join(lines), len(selected)


def normalise(matrix: np.ndarray) -> np.ndarray:
    matrix = np.asarray(matrix, dtype=np.float32)
    return matrix / np.maximum(np.linalg.norm(matrix, axis=1, keepdims=True), 1e-9)


def load_embedding_model() -> Any:
    """Prefer the local HF cache, falling back to the shared downloader."""
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(DEFAULT_MODEL_NAME, local_files_only=True)
    except OSError:
        return load_sentence_transformer()


def retrieve_global(
    queries: dict[str, str],
    ingredients: Sequence[Ingredient],
    embedder: Callable[[list[str]], np.ndarray],
    *,
    top_k: int = TOP_K,
) -> dict[str, list[dict[str, Any]]]:
    """Retrieve from every ingredient; concept ids never restrict this bank."""
    if not ingredients:
        raise ValueError("The global ingredient candidate bank is empty")
    ingredient_vectors = normalise(embedder([item.retrieval_text for item in ingredients]))
    misconception_ids = sorted(queries)
    query_vectors = normalise(embedder([queries[mid] for mid in misconception_ids]))
    result: dict[str, list[dict[str, Any]]] = {}
    width = min(top_k, len(ingredients))
    for row, misconception_id in enumerate(misconception_ids):
        scores = ingredient_vectors @ query_vectors[row]
        order = sorted(range(len(ingredients)), key=lambda i: (-float(scores[i]), ingredients[i].ingredient_id))
        result[misconception_id] = [
            {
                "ingredient_id": ingredients[index].ingredient_id,
                "retrieval_rank": rank,
                "retrieval_score": round(float(scores[index]), 6),
            }
            for rank, index in enumerate(order[:width], 1)
        ]
    return result


def make_rerank_prompt(query: str, candidates: Sequence[Ingredient]) -> str:
    options = "\n".join(
        f"{index}. {item.ingredient_id}\nLabel: {item.label}\nFailure mode: {item.failure_mode}"
        for index, item in enumerate(candidates, 1)
    )
    prompt = (
        "Map the student misconception to zero or more directly implicated learning ingredients. "
        "Rank only genuine matches. The candidates were retrieved globally; question concepts are "
        "weak context and must not exclude cross-concept matches. Use none when no candidate fits.\n\n"
        f"Evidence:\n{query}\n\nCandidates:\n{options}\n\n"
        "Return JSON only in this shape: "
        '{"ranked":[{"ingredient_id":"<candidate id or none>","confidence":0.0,'
        '"justification":"one sentence"}]}. Include none as a reachable judgment; place it first '
        "when abstaining. Confidence must be between 0 and 1."
    )
    assert not any(field in prompt for field in FORBIDDEN_INPUT_FIELDS)
    return prompt


def parse_rerank_response(raw: str, allowed: set[str]) -> list[dict[str, Any]]:
    match = re.search(r"\{[\s\S]*\}", raw or "")
    if not match:
        raise ValueError("LLM response did not contain a JSON object")
    payload = json.loads(match.group(0))
    ranked = payload.get("ranked")
    if not isinstance(ranked, list) or not ranked:
        raise ValueError("LLM response must contain a non-empty ranked list")
    parsed: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in ranked:
        if not isinstance(item, dict):
            raise ValueError("Every ranked item must be an object")
        ingredient_id = str(item.get("ingredient_id") or "none").strip()
        normalized = "none" if ingredient_id.lower() == "none" else ingredient_id
        if normalized != "none" and normalized not in allowed:
            raise ValueError(f"LLM selected an ingredient outside top-K: {normalized!r}")
        if normalized in seen:
            continue
        seen.add(normalized)
        confidence = float(item.get("confidence", 0.0))
        if not 0 <= confidence <= 1:
            raise ValueError("Confidence must be between 0 and 1")
        justification = re.sub(r"\s+", " ", str(item.get("justification") or "")).strip()
        if not justification:
            raise ValueError("Every ranked item needs a justification")
        parsed.append(
            {"ingredient_id": normalized, "confidence": round(confidence, 6), "justification": justification}
        )
    if "none" not in seen:
        raise ValueError("LLM ranked list must include the explicit none option")
    return parsed


def cache_key(query: str, candidate_ids: Sequence[str]) -> str:
    canonical = json.dumps([query, list(candidate_ids)], ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def rerank_one(
    query: str,
    retrieved: Sequence[dict[str, Any]],
    ingredients_by_id: dict[str, Ingredient],
    complete: Callable[[str], str | None] | None,
    cache: dict[str, Any],
) -> tuple[list[dict[str, Any]], str, bool]:
    candidate_ids = [str(row["ingredient_id"]) for row in retrieved]
    key = cache_key(query, candidate_ids)
    cached = cache.get(key)
    if cached is not None:
        return parse_rerank_response(json.dumps(cached), set(candidate_ids)), key, True
    if complete is None:
        return [{"ingredient_id": "none", "confidence": 1.0, "justification": "No live or cached reranker result."}], key, False
    prompt = make_rerank_prompt(query, [ingredients_by_id[item] for item in candidate_ids])
    raw = complete(prompt)
    if raw is None:
        raise RuntimeError("The configured LLM provider returned no result")
    parsed = parse_rerank_response(raw, set(candidate_ids))
    cache[key] = {"ranked": parsed}
    return parsed, key, False


def accept_or_abstain(
    ranked: Sequence[dict[str, Any]],
    retrieved: Sequence[dict[str, Any]],
    *,
    threshold: float,
    contexts_used: int,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    retrieval_rank = {str(row["ingredient_id"]): int(row["retrieval_rank"]) for row in retrieved}
    if ranked and ranked[0]["ingredient_id"] == "none":
        return [], {"reason": "reranker_none", **ranked[0]}
    accepted = []
    for item in ranked:
        ingredient_id = str(item["ingredient_id"])
        if ingredient_id == "none":
            break
        if float(item["confidence"]) < threshold:
            continue
        accepted.append(
            {
                "ingredient_id": ingredient_id,
                "provenance": RERANK_PROVENANCE,
                "confidence": float(item["confidence"]),
                "justification": item["justification"],
                "retrieval_rank": retrieval_rank[ingredient_id],
                "contexts_used": contexts_used,
            }
        )
    if not accepted:
        top = ranked[0] if ranked else {"ingredient_id": "none", "confidence": 0.0, "justification": "Empty ranking."}
        return [], {"reason": "below_threshold", **top}
    return accepted, None


def benchmark_truth(ontology: dict[str, Any]) -> dict[str, set[str]]:
    """Read diagnostic tags only after inference, solely as evaluation truth."""
    truth: dict[str, set[str]] = defaultdict(set)
    for concept in ontology.get("concepts", []):
        for ingredient in concept.get("ingredients", []):
            ingredient_id = str(ingredient.get("id") or "")
            for misconception_id in ingredient.get("diagnostic_tags") or []:
                if misconception_id:
                    truth[str(misconception_id)].add(ingredient_id)
    return dict(truth)


def split_name(misconception_id: str, seed: str, dev_fraction: float) -> str:
    digest = hashlib.sha256(f"{seed}:{misconception_id}".encode()).digest()
    value = int.from_bytes(digest[:8], "big") / 2**64
    return "dev" if value < dev_fraction else "test"


def score_predictions(
    predictions: dict[str, list[dict[str, Any]]],
    truth: dict[str, set[str]],
    ids: set[str],
    thresholds: Iterable[float],
) -> list[dict[str, Any]]:
    rows = []
    eligible = ids & set(truth)
    for threshold in thresholds:
        accepted = [
            (misconception_id, link)
            for misconception_id in sorted(eligible)
            for link in predictions.get(misconception_id, [])
            if link.get("provenance") == RERANK_PROVENANCE and float(link.get("confidence", 0)) >= threshold
        ]
        correct = sum(link.get("ingredient_id") in truth[mid] for mid, link in accepted)
        covered = len({mid for mid, _link in accepted})
        rows.append(
            {
                "threshold": threshold,
                "accepted_links": len(accepted),
                "correct_links": correct,
                "precision": round(correct / len(accepted), 6) if accepted else None,
                "covered_misconceptions": covered,
                "coverage": round(covered / len(eligible), 6) if eligible else None,
            }
        )
    return rows


def recall_at_k(retrieval: dict[str, list[dict[str, Any]]], truth: dict[str, set[str]], ids: set[str]) -> dict[str, Any]:
    eligible = sorted(ids & set(truth))
    hit = sum(bool({row["ingredient_id"] for row in retrieval.get(mid, [])} & truth[mid]) for mid in eligible)
    return {"hit": hit, "total": len(eligible), "recall": round(hit / len(eligible), 6) if eligible else None}


def incumbent_precision(
    incumbent: dict[str, Any], truth: dict[str, set[str]], ids: set[str]
) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[bool]] = defaultdict(list)
    for misconception_id in sorted(ids & set(truth)):
        for link in incumbent.get("map", {}).get(misconception_id, []):
            provenance = str(link.get("provenance") or link.get("method") or "unknown")
            grouped[provenance].append(link.get("ingredient_id") in truth[misconception_id])
    return {
        provenance: {
            "correct": sum(values),
            "links": len(values),
            "precision": round(sum(values) / len(values), 6) if values else None,
        }
        for provenance, values in sorted(grouped.items())
    }


def human_truth(incumbent: dict[str, Any]) -> dict[str, set[str]]:
    truth: dict[str, set[str]] = defaultdict(set)
    for misconception_id, links in incumbent.get("map", {}).items():
        for link in links:
            if link.get("provenance") == "human" and link.get("ingredient_id"):
                truth[str(misconception_id)].add(str(link["ingredient_id"]))
    return dict(truth)


def build_report(
    predictions: dict[str, list[dict[str, Any]]],
    retrieval: dict[str, list[dict[str, Any]]],
    abstentions: list[dict[str, Any]],
    ontology: dict[str, Any],
    incumbent: dict[str, Any],
    *,
    threshold: float,
    split_seed: str,
    dev_fraction: float,
    no_context: bool,
) -> dict[str, Any]:
    diagnostic = benchmark_truth(ontology)
    all_ids = set(predictions)
    dev_ids = {mid for mid in diagnostic if split_name(mid, split_seed, dev_fraction) == "dev"}
    test_ids = set(diagnostic) - dev_ids
    thresholds = sorted({0.0, 0.5, 0.6, 0.7, threshold, 0.8, 0.9, 1.0})
    held_out_human = human_truth(incumbent)
    return {
        "mode": "no_context" if no_context else "context",
        "committed_threshold": threshold,
        "split": {"method": "sha256_by_misconception", "seed": split_seed, "dev_fraction": dev_fraction},
        "diagnostic_benchmark": {
            "pairs": sum(len(value) for value in diagnostic.values()),
            "misconceptions": len(diagnostic),
            "dev": {
                "recall_at_k": recall_at_k(retrieval, diagnostic, dev_ids),
                "precision_at_coverage": score_predictions(predictions, diagnostic, dev_ids, thresholds),
            },
            "test": {
                "recall_at_k": recall_at_k(retrieval, diagnostic, test_ids),
                "precision_at_coverage": score_predictions(predictions, diagnostic, test_ids, thresholds),
                "incumbent_by_provenance": incumbent_precision(incumbent, diagnostic, test_ids),
            },
        },
        "human_holdout": {
            "links": sum(len(value) for value in held_out_human.values()),
            "recall_at_k": recall_at_k(retrieval, held_out_human, set(held_out_human)),
            "precision_at_coverage": score_predictions(predictions, held_out_human, set(held_out_human), thresholds),
        },
        "abstention": {
            "count": len(abstentions),
            "rate": round(len(abstentions) / len(all_ids), 6) if all_ids else None,
            "misconception_ids": [row["misconception_id"] for row in abstentions],
        },
        "mode_comparison": {
            "status": "run the companion mode and pass its report with --compare-report",
        },
        "notes": [
            "diagnostic_tags are loaded only after inference as evaluation truth",
            "llm-provenance links are never used as truth or tuning data",
            "threshold is loaded from the dedicated threshold file before either split is scored",
        ],
    }


def merge_human_links(
    incumbent: dict[str, Any], predictions: dict[str, list[dict[str, Any]]]
) -> dict[str, list[dict[str, Any]]]:
    output: dict[str, list[dict[str, Any]]] = {}
    all_ids = set(incumbent.get("map", {})) | set(predictions)
    for misconception_id in sorted(all_ids):
        humans = [
            dict(link)
            for link in incumbent.get("map", {}).get(misconception_id, [])
            if link.get("provenance") == "human"
        ]
        output[misconception_id] = humans + list(predictions.get(misconception_id, []))
    return output


def load_threshold(path: Path) -> dict[str, Any]:
    value = load_json(path)
    threshold = float(value["acceptance_threshold"])
    if not 0 <= threshold <= 1:
        raise ValueError("acceptance_threshold must be between 0 and 1")
    return value


def load_local_env(path: Path = ML_ROOT / ".env.local") -> None:
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def build_completer() -> tuple[Callable[[str], str | None] | None, str]:
    load_local_env()
    from scripts.pipeline.base import LLMClient

    client = LLMClient()
    provider = client.provider
    model = {
        "groq": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "openai": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8"),
    }.get(provider, "none")
    if provider == "anthropic":
        raise RuntimeError(
            "The shared Anthropic client omits temperature; use groq/openai so reranking is temperature 0"
        )
    if not client.available():
        return None, model
    return lambda prompt: client.complete(prompt, max_tokens=1800, temperature=0.0), model


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="read cache but make no LLM calls or filesystem writes")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--no-context", action="store_true", help="use misconception text alone")
    parser.add_argument("--limit", type=int, help="process the first N misconception ids")
    parser.add_argument("--top-k", type=int, default=TOP_K)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--threshold-file", type=Path, default=THRESHOLD_PATH)
    parser.add_argument("--compare-report", type=Path, help="report from the companion context mode")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be at least 1")
    if args.top_k < 1:
        raise SystemExit("--top-k must be at least 1")

    ontology = load_json(ONTOLOGY_PATH)
    misconceptions = load_json(MISCONCEPTIONS_PATH)
    # --no-context is a real text-independent fallback: it does not even read
    # the Eedi question bank.
    questions = [] if args.no_context else load_json(QUESTIONS_PATH)
    incumbent = load_json(INCUMBENT_PATH)
    threshold_config = load_threshold(args.threshold_file)
    ingredients = load_ingredients(ontology)
    if len(ingredients) != 179:
        raise ValueError(f"Expected the full 179-ingredient bank, found {len(ingredients)}")

    misconception_ids = sorted(mid for mid, value in misconceptions.items() if value.get("eedi_name"))
    if args.limit is not None:
        misconception_ids = misconception_ids[: args.limit]
    contexts = collect_question_contexts(questions)
    query_data = {
        mid: build_query(mid, misconceptions[mid], contexts.get(mid, []), use_context=not args.no_context)
        for mid in misconception_ids
    }
    queries = {mid: value[0] for mid, value in query_data.items()}

    print(f"Loading {DEFAULT_MODEL_NAME}; retrieving top {args.top_k} from all {len(ingredients)} ingredients")
    model = load_embedding_model()
    retrieval = retrieve_global(
        queries, ingredients, lambda texts: embed_texts(model, texts, batch_size=128), top_k=args.top_k
    )
    cache = load_json(args.cache) if args.cache.exists() else {}
    complete, reranker_model = (None, "dry-run") if args.dry_run else build_completer()
    if complete is None and not args.dry_run:
        raise SystemExit("No configured LLM provider; set LLM_PROVIDER and its API key, or use --dry-run")

    ingredients_by_id = {item.ingredient_id: item for item in ingredients}
    predictions: dict[str, list[dict[str, Any]]] = {}
    abstentions: list[dict[str, Any]] = []
    for offset, misconception_id in enumerate(misconception_ids, 1):
        ranked, key, was_cached = rerank_one(
            queries[misconception_id], retrieval[misconception_id], ingredients_by_id, complete, cache
        )
        if not args.dry_run and not was_cached:
            # Checkpoint each paid call, so interruption never discards a pass.
            write_json(args.cache, cache)
        links, abstention = accept_or_abstain(
            ranked,
            retrieval[misconception_id],
            threshold=float(threshold_config["acceptance_threshold"]),
            contexts_used=query_data[misconception_id][1],
        )
        predictions[misconception_id] = links
        if abstention:
            abstentions.append(
                {"misconception_id": misconception_id, "cache_key": key, "cached": was_cached, **abstention}
            )
        if offset % 50 == 0:
            print(f"Reranked {offset}/{len(misconception_ids)}")

    report = build_report(
        predictions,
        retrieval,
        abstentions,
        ontology,
        incumbent,
        threshold=float(threshold_config["acceptance_threshold"]),
        split_seed=str(threshold_config["split_seed"]),
        dev_fraction=float(threshold_config["dev_fraction"]),
        no_context=args.no_context,
    )
    if args.compare_report:
        companion = load_json(args.compare_report)
        report["mode_comparison"] = {
            "current_mode": report["mode"],
            "companion_mode": companion.get("mode"),
            "current_diagnostic": report["diagnostic_benchmark"],
            "companion_diagnostic": companion.get("diagnostic_benchmark"),
        }

    output = {
        "_meta": {
            "version": 2,
            "retrieval_model": DEFAULT_MODEL_NAME,
            "reranker_model": reranker_model,
            "llm_temperature": 0,
            "top_k": args.top_k,
            "candidate_bank_size": len(ingredients),
            "acceptance_threshold": threshold_config["acceptance_threshold"],
            "threshold_decision": threshold_config,
            "no_context": args.no_context,
            "cache_key": "sha256(query + ordered candidate_ids)",
            "licence_status": "development_only_pending_Eedi_permission",
        },
        "map": merge_human_links(incumbent, predictions),
    }
    print(
        f"Accepted {sum(len(value) for value in predictions.values())} rerank links; "
        f"abstained on {len(abstentions)}/{len(misconception_ids)} misconceptions"
    )
    if args.dry_run:
        print("Dry run: no files written")
        return 0

    write_json(args.out, output)
    write_json(args.out.with_suffix(".abstentions.json"), {"_meta": output["_meta"], "abstentions": abstentions})
    write_json(args.out.with_suffix(".report.json"), report)
    write_json(args.cache, cache)
    print(f"Wrote {args.out}, {args.out.with_suffix('.abstentions.json')}, and {args.out.with_suffix('.report.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
