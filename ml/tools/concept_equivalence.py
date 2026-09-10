#!/usr/bin/env python3
"""
Build the concept equivalence table, so a student stops proving the same thing twice.

The ontology is 108 subject graphs holding 28,631 concepts and 45,565
dependency edges, none of which cross a subject boundary. Concepts are
therefore duplicated across silos: `pre-calc::linear-regression` and
`hydroponics::linear-regression` are the same idea with two ids and no link.

The mastery engine is concept-agnostic and correct. It has simply never been
told those two ids denote one thing, so a student who demonstrated regression
while growing lettuce is asked to demonstrate it again in pre-calc, from zero.

This builds the table that fixes that. It does NOT merge anything. Merging
concepts across subjects would destroy the per-subject curricula that make the
graphs useful. An equivalence is a claim that evidence transfers, and nothing
more.

Output is tiered by confidence, because "same name" is good evidence and not
proof, and a person has to sign off on the ones that are only probably right.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

REPO = Path("/Volumes/SSK SSD/Developer/mindcraft")
GRAPHS = REPO / "ml/data/dynamic_graphs"
OUT = REPO / "agent_work/scoping/generated"


def normalise(text: str) -> str:
    """Lowercase alphanumerics only, so 'Node Voltage' == 'node-voltage'."""
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def main() -> None:
    concepts: dict[str, dict] = {}
    for path in sorted(GRAPHS.glob("*.json")):
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        for concept in data.get("concepts", []):
            if (cid := concept.get("id")):
                concepts[cid] = concept

    # Group by normalised id tail. Two concepts in different subjects whose
    # ids reduce to the same string are candidates.
    by_tail: dict[str, list[str]] = defaultdict(list)
    for cid in concepts:
        by_tail[normalise(cid.split("::")[-1])].append(cid)

    high: list[dict] = []
    medium: list[dict] = []

    for tail, ids in by_tail.items():
        subjects = {cid.split("::")[0] for cid in ids}
        if len(ids) < 2 or len(subjects) < 2:
            continue

        labels = {normalise(concepts[cid].get("label", "")) for cid in ids}
        # Depth in the local graph is a rough proxy for how advanced a
        # treatment is. Two concepts at wildly different depths may share a
        # name and not a meaning, so they go to the slower queue.
        depths = [len(concepts[cid].get("dependencies") or []) for cid in ids]
        spread = max(depths) - min(depths)

        record = {
            "key": tail,
            "members": sorted(ids),
            "subjects": sorted(subjects),
            "labels": sorted(
                {concepts[cid].get("label", "") for cid in ids}
            ),
            "dependency_counts": dict(zip(sorted(ids), depths)),
        }

        # Same id tail AND same label AND comparable position: as sure as a
        # string comparison can make anyone.
        if len(labels) == 1 and spread <= 3:
            high.append(record)
        else:
            record["needs_review_because"] = (
                "labels differ" if len(labels) > 1
                else f"dependency count spread of {spread}"
            )
            medium.append(record)

    OUT.mkdir(parents=True, exist_ok=True)

    # The runtime artefact. Flat, small, and the only thing the engine reads.
    table = {
        "version": "1.0.0",
        "note": (
            "Evidence transfers between members of a class. Concepts are NOT "
            "merged: each keeps its own id, subject, and prerequisites."
        ),
        "classes": [
            {"key": r["key"], "members": r["members"]} for r in high
        ],
    }
    (OUT / "concept_equivalence_table.json").write_text(json.dumps(table, indent=1))
    (OUT / "concept_equivalence_review.json").write_text(
        json.dumps({"auto": high, "needs_human": medium}, indent=1)
    )

    covered = sum(len(r["members"]) for r in high)
    print(f"concepts            : {len(concepts)}")
    print(f"auto-accept classes : {len(high)}  covering {covered} concept ids")
    print(f"needs human review  : {len(medium)}")
    print()
    print("largest classes:")
    for r in sorted(high, key=lambda x: -len(x["members"]))[:8]:
        print(f"  {r['key'][:34]:34s} {len(r['members'])} ids across {len(r['subjects'])} subjects")
    print()
    print("written to", OUT)


if __name__ == "__main__":
    main()
