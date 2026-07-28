"""Deterministic archetype/exemplar index used only for problem classification."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from mindcraft_graph.models.concept import Ontology, canonical_concept_id
from mindcraft_graph.models.ingredient import IngredientOntology
from mindcraft_graph.representation.embeddings import DEFAULT_EMBEDDING_DIM, embed_texts

REPRESENTATION_VERSION = "bank-knn-classifier-v2"

@dataclass(frozen=True)
class ClassificationEntry:
    entry_id: str
    archetype_id: str
    concept_ids: tuple[str, ...]
    required_ingredient_ids: tuple[str, ...]
    bridge_concept_ids: tuple[str, ...]
    vector: np.ndarray
    kind: str = "archetype"


@dataclass(frozen=True)
class ClassificationIndex:
    entries: tuple[ClassificationEntry, ...]
    source_hash: str
    representation_version: str = REPRESENTATION_VERSION


def compute_source_hash(
    paths: list[Path | str],
    *,
    include_seed_stems: bool = True,
) -> str:
    digest = hashlib.sha256(REPRESENTATION_VERSION.encode())
    digest.update(f"|include_seed_stems={include_seed_stems}".encode())
    for raw_path in paths:
        path = Path(raw_path)
        digest.update(path.name.encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def _flatten(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            out.extend(_flatten(item))
        return out
    if isinstance(value, dict):
        out = []
        for key in sorted(value):
            out.extend(_flatten(value[key]))
        return out
    return []


def _seed_stems_by_archetype(
    layer3: dict[str, Any],
    excluded_question_instance_ids: set[str] | None = None,
) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    excluded_question_instance_ids = excluded_question_instance_ids or set()
    for instance in layer3.get("question_instances", []):
        if instance.get("question_instance_id") in excluded_question_instance_ids:
            continue
        raw = instance.get("raw_question", {})
        stem = raw.get("summary") or raw.get("text")
        if not stem:
            continue
        links = instance.get("links", {})
        archetype_ids = links.get("question_archetype_ids") or links.get("archetype_ids") or []
        for archetype_id in archetype_ids:
            out.setdefault(archetype_id, []).append(stem.strip())
    return out


def build_classification_index(
    ontology: Ontology,
    ingredient_ontology: IngredientOntology,
    layer2_path: Path | str,
    layer3_path: Path | str,
    model: Any,
    *,
    source_paths: list[Path | str] | None = None,
    batch_size: int = 64,
    include_seed_stems: bool = True,
    excluded_question_instance_ids: set[str] | None = None,
    bank_paths: list[Path | str] | None = None,
    excluded_bank_question_ids: set[str] | None = None,
    bank_index_path: Path | str | None = None,
    bank_metadata_path: Path | str | None = None,
) -> ClassificationIndex:
    """Build bank voters, archetype exemplars, and sparse-concept fallbacks."""
    layer2_path = Path(layer2_path)
    layer3_path = Path(layer3_path)
    layer2 = json.loads(layer2_path.read_text())
    layer3 = json.loads(layer3_path.read_text())
    concept_ids = {concept.id for concept in ontology.concepts}
    ingredient_ids = {ingredient.id for ingredient in ingredient_ontology.ingredients}
    seeds = _seed_stems_by_archetype(layer3, excluded_question_instance_ids)
    bank_paths = [Path(path) for path in (bank_paths or [])]
    excluded_bank_question_ids = excluded_bank_question_ids or set()

    specs: list[dict[str, Any]] = []
    precomputed_bank_entries: list[ClassificationEntry] = []
    if (bank_index_path is None) != (bank_metadata_path is None):
        raise ValueError("bank_index_path and bank_metadata_path must be provided together")
    if bank_index_path is not None and bank_metadata_path is not None:
        bank_vectors = np.load(Path(bank_index_path), allow_pickle=False)["embeddings"]
        bank_metadata = json.loads(Path(bank_metadata_path).read_text())
        if len(bank_vectors) != len(bank_metadata):
            raise ValueError("Bank index vectors and metadata have different lengths")
        for meta, vector in zip(bank_metadata, bank_vectors):
            question_id = str(meta.get("id") or "")
            source_id = str(meta.get("conceptId") or meta.get("concept_id") or "")
            try:
                concept_id = canonical_concept_id(source_id, ontology)
            except ValueError as exc:
                raise ValueError(f"Unresolved bank conceptId {source_id!r} for {question_id}") from exc
            if question_id in excluded_bank_question_ids:
                continue
            precomputed_bank_entries.append(ClassificationEntry(
                entry_id=f"bank::{meta.get('source', 'bank')}::{question_id}",
                archetype_id="",
                concept_ids=(concept_id,),
                required_ingredient_ids=(),
                bridge_concept_ids=(),
                vector=np.asarray(vector, dtype=np.float32),
                kind="bank",
            ))
    seen_bank_ids: set[str] = set()
    for bank_path in bank_paths:
        payload = json.loads(bank_path.read_text())
        questions = payload if isinstance(payload, list) else payload.get("questions", [])
        if not isinstance(questions, list):
            raise ValueError(f"Bank must contain a question list: {bank_path}")
        for offset, question in enumerate(questions):
            question_id = str(question.get("id") or f"row-{offset}")
            source_id = str(question.get("conceptId") or question.get("concept_id") or "")
            try:
                concept_id = canonical_concept_id(source_id, ontology)
            except ValueError as exc:
                raise ValueError(
                    f"Unresolved bank conceptId {source_id!r} in {bank_path}:{question_id}"
                ) from exc
            if question_id in excluded_bank_question_ids:
                continue
            stem = question.get("question") or question.get("stem") or question.get("text")
            if not isinstance(stem, str) or not stem.strip():
                raise ValueError(f"Missing bank question text in {bank_path}:{question_id}")
            entry_id = f"bank::{bank_path.name}::{question_id}"
            if entry_id in seen_bank_ids:
                raise ValueError(f"Duplicate bank entry id: {entry_id}")
            seen_bank_ids.add(entry_id)
            specs.append({
                "entry_id": entry_id,
                "archetype_id": "",
                "concept_ids": (concept_id,),
                "required_ingredient_ids": (),
                "bridge_concept_ids": (),
                "kind": "bank",
                "text": stem.strip(),
            })
    covered: set[str] = set()
    for archetype in layer2.get("archetypes", []):
        archetype_id = archetype["archetype_id"]
        primary = tuple(archetype.get("primary_concept_ids", []))
        bridges = tuple(archetype.get("bridge_concept_ids", []))
        required = tuple(archetype.get("required_ingredient_ids", []))
        unresolved_concepts = (set(primary) | set(bridges)) - concept_ids
        unresolved_ingredients = set(required) - ingredient_ids
        if unresolved_concepts or unresolved_ingredients:
            raise ValueError(
                f"Invalid archetype links for {archetype_id}: "
                f"concepts={sorted(unresolved_concepts)} "
                f"ingredients={sorted(unresolved_ingredients)}"
            )
        if not primary:
            raise ValueError(f"Archetype {archetype_id} has no primary_concept_ids")
        covered.update(primary)
        descriptive = " ".join(_flatten({
            "concept_path_template": archetype.get("concept_path_template", []),
            "rewrite_template": archetype.get("rewrite_template", {}),
            "difficulty_drivers": archetype.get("difficulty_drivers", []),
            "canonical_tags": archetype.get("canonical_tags", {}),
        })).strip()
        specs.append({
            "entry_id": f"archetype::{archetype_id}::shape",
            "archetype_id": archetype_id,
            "concept_ids": primary,
            "required_ingredient_ids": required,
            "bridge_concept_ids": bridges,
            "kind": "archetype",
            "text": descriptive,
        })
        for idx, stem in enumerate(seeds.get(archetype_id, []) if include_seed_stems else []):
            specs.append({
                "entry_id": f"archetype::{archetype_id}::seed::{idx}",
                "archetype_id": archetype_id,
                "concept_ids": primary,
                "required_ingredient_ids": required,
                "bridge_concept_ids": bridges,
                "kind": "archetype",
                "text": stem,
            })
    ingredients_by_concept: dict[str, list[str]] = {}
    for ingredient in ingredient_ontology.ingredients:
        ingredients_by_concept.setdefault(ingredient.concept_id, []).append(ingredient.name)
    concept_seeds: dict[str, list[str]] = {}
    archetype_to_concepts = {
        archetype["archetype_id"]: archetype.get("primary_concept_ids", [])
        for archetype in layer2.get("archetypes", [])
    }
    for archetype_id, stems in seeds.items():
        for concept_id in archetype_to_concepts.get(archetype_id, []):
            concept_seeds.setdefault(concept_id, []).extend(stems)

    for concept in ontology.concepts:
        if concept.id in covered:
            continue
        text = " ".join([
            concept.name,
            concept.description,
            *ingredients_by_concept.get(concept.id, []),
            *concept_seeds.get(concept.id, [])[:6],
        ]).strip()
        specs.append({
            "entry_id": f"fallback::{concept.id}",
            "archetype_id": "",
            "concept_ids": (concept.id,),
            "required_ingredient_ids": (),
            "bridge_concept_ids": (),
            "kind": "fallback",
            "text": text,
        })

    vectors = embed_texts(model, [spec["text"] for spec in specs], batch_size=batch_size)
    if vectors.ndim != 2 or vectors.shape[1] != DEFAULT_EMBEDDING_DIM:
        raise ValueError(f"Unexpected classification embedding shape: {vectors.shape}")
    entries = tuple(precomputed_bank_entries) + tuple(
        ClassificationEntry(
            entry_id=spec["entry_id"],
            archetype_id=spec["archetype_id"],
            concept_ids=tuple(spec["concept_ids"]),
            required_ingredient_ids=tuple(spec["required_ingredient_ids"]),
            bridge_concept_ids=tuple(spec["bridge_concept_ids"]),
            vector=vector,
            kind=spec["kind"],
        )
        for spec, vector in zip(specs, vectors)
    )
    paths = source_paths or [layer2_path, layer3_path, *bank_paths]
    if bank_index_path is not None:
        for bank_source in (Path(bank_index_path), Path(bank_metadata_path)):
            if bank_source not in [Path(path) for path in paths]:
                paths.append(bank_source)
    source_hash = compute_source_hash(
        list(paths), include_seed_stems=include_seed_stems
    )
    if excluded_question_instance_ids:
        source_hash = hashlib.sha256(
            (source_hash + "|excluded=" + ",".join(sorted(excluded_question_instance_ids))).encode()
        ).hexdigest()
    return ClassificationIndex(entries=entries, source_hash=source_hash)


def save_classification_index(index: ClassificationIndex, path: Path | str) -> None:
    metadata = [{
        "entry_id": entry.entry_id,
        "archetype_id": entry.archetype_id,
        "concept_ids": list(entry.concept_ids),
        "required_ingredient_ids": list(entry.required_ingredient_ids),
        "bridge_concept_ids": list(entry.bridge_concept_ids),
        "kind": entry.kind,
    } for entry in index.entries]
    np.savez_compressed(
        Path(path),
        vectors=np.stack([entry.vector for entry in index.entries]),
        metadata=np.array(json.dumps(metadata)),
        source_hash=np.array(index.source_hash),
        representation_version=np.array(index.representation_version),
    )


def load_classification_index(path: Path | str) -> ClassificationIndex:
    data = np.load(Path(path), allow_pickle=False)
    metadata = json.loads(str(data["metadata"].item()))
    vectors = data["vectors"]
    entries = tuple(
        ClassificationEntry(
            entry_id=meta["entry_id"],
            archetype_id=meta["archetype_id"],
            concept_ids=tuple(meta["concept_ids"]),
            required_ingredient_ids=tuple(meta["required_ingredient_ids"]),
            bridge_concept_ids=tuple(meta["bridge_concept_ids"]),
            vector=vector,
            kind=meta["kind"],
        )
        for meta, vector in zip(metadata, vectors)
    )
    return ClassificationIndex(
        entries=entries,
        source_hash=str(data["source_hash"].item()),
        representation_version=str(data["representation_version"].item()),
    )


def cache_matches(index: ClassificationIndex, expected_source_hash: str) -> bool:
    return (
        index.representation_version == REPRESENTATION_VERSION
        and index.source_hash == expected_source_hash
    )
