"""Per-concept "essence" distilled from the Layer 3 ACT question bank.

For each concept we collect real example questions, their answer reasoning, and
common misconceptions — joined Layer 3 instance → Layer 2 archetype → concept.
This grounds generation in genuine ACT patterns instead of free invention.
Pure data aggregation (no LLM); concepts with no seeds get an empty essence and
fall back to concept-name-only prompting downstream.
"""
from __future__ import annotations

import json
import pathlib
from dataclasses import dataclass, field

L1 = "01_mindcraft_concept_ontology_v2_6_with_combinations.json"
L2 = "02_question_archetype_ontology_v1_6_standardized.json"
L3 = "03_question_instance_bank_schema_and_seed_v1_6.json"

MAX_EXAMPLES = 6  # cap per concept to keep prompts small


@dataclass
class ConceptEssence:
    concept_id: str
    examples: list[dict] = field(default_factory=list)   # {text, choices, answer}
    misconceptions: list[str] = field(default_factory=list)
    archetypes: list[str] = field(default_factory=list)


def _archetype_to_concepts(ontology_dir: pathlib.Path) -> dict[str, list[str]]:
    data = json.loads((ontology_dir / L2).read_text())
    return {
        a["archetype_id"]: a.get("primary_concept_ids", [])
        for a in data.get("archetypes", [])
    }


def _instance_concepts(inst: dict, arch_map: dict[str, list[str]]) -> list[str]:
    links = inst.get("links", {})
    for key in ("concept_ids", "primary_concept_ids"):
        ids = links.get(key) or []
        if ids:
            return ids
    # Fall back to the archetype join.
    out: list[str] = []
    for aid in links.get("question_archetype_ids", []):
        out.extend(arch_map.get(aid, []))
    return out


def build_essence(ontology_dir: str | pathlib.Path) -> dict[str, ConceptEssence]:
    ontology_dir = pathlib.Path(ontology_dir)
    arch_map = _archetype_to_concepts(ontology_dir)
    data = json.loads((ontology_dir / L3).read_text())

    out: dict[str, ConceptEssence] = {}
    for inst in data.get("question_instances", []):
        concepts = _instance_concepts(inst, arch_map)
        if not concepts:
            continue
        raw = inst.get("raw_question", {})
        intel = inst.get("intelligence", {})
        text = raw.get("summary") or raw.get("text")
        for cid in concepts:
            ess = out.setdefault(cid, ConceptEssence(concept_id=cid))
            if text and len(ess.examples) < MAX_EXAMPLES:
                ess.examples.append({
                    "text": text,
                    "choices": raw.get("choices"),
                    "answer": intel.get("answer"),
                })
            risks = intel.get("student_misconception_risks")
            if isinstance(risks, str):
                risks = [risks]            # some seeds store a single string
            for m in (risks or [])[:2]:
                if isinstance(m, str) and m.strip() and m not in ess.misconceptions:
                    ess.misconceptions.append(m)
            for aid in inst.get("links", {}).get("question_archetype_ids", []):
                if aid not in ess.archetypes:
                    ess.archetypes.append(aid)
    return out
