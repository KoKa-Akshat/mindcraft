#!/usr/bin/env python3
"""Export the live content graph into the small JSON the 3D viewer consumes.

Source of truth is the content pipeline's graph_data.json (nodes with real
lesson objects and sims, prerequisite + cross_subject edges). That file is
big (tens of MB) and full of chapter bodies the viewer never needs, so this
script projects it down to the minimum the browser needs to draw and
highlight the graph:

    nodes: {id, name, subject, level, hasLesson, hasSim}
    edges: {source, target, relation, weight}

Re-run this after every content-merge round. It is idempotent: nodes and
edges are sorted, so the same input always produces the same graph payload
(only the generatedAt stamp moves), and everything it reports (node counts,
subject list, colors) is derived from the file at run time, never hardcoded.

Usage:
    python3 scripts/export_concept_graph.py
    python3 scripts/export_concept_graph.py --source /path/to/graph_data.json
    python3 scripts/export_concept_graph.py --out app/public/full-concept-graph.json

The source path can also come from the MINDCRAFT_GRAPH_DATA env var.
"""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DEFAULT_SOURCE = Path(
    "/private/tmp/claude-501/-Users-akoirala/ecdb2be0-20e4-4b62-a08a-9acc53a4fbc5"
    "/scratchpad/ios-preview/graph_data.json"
)
DEFAULT_OUT = ROOT / "app" / "public" / "full-concept-graph.json"

# Hand-tuned, hue-spaced palette. Subjects are alphabetical and their hues walk
# the color wheel, so neighbours in the legend are never confusable, and every
# color reads clearly against the viewer's near-black background. Pinned per
# subject id (not per index) so adding a subject never recolors existing ones.
SUBJECT_COLORS = {
    "act-math": "#c4f547",
    "algebra-1": "#8ee06a",
    "biology": "#43d98b",
    "blockchain": "#f0a93c",
    "calculus": "#38d6c4",
    "chemistry": "#45c2f0",
    "circuits": "#5aa8ff",
    "computer-science": "#8b8cf7",
    "networking": "#a97cf0",
    "psychology": "#c96ee8",
    "quantum-computing": "#ef6fc6",
    "statistics-course": "#f56a92",
    "us-history": "#f5794f",
}


def fallback_color(subject_id: str) -> str:
    """Stable color for a subject that appears after this palette was written.

    Hue comes from a hash of the id, so a brand new subject gets a usable,
    repeatable color with zero code changes. Saturation and lightness are
    fixed in the same band as the curated colors so it does not look alien.
    """
    digest = hashlib.sha256(subject_id.encode("utf-8")).digest()
    hue = (digest[0] << 8 | digest[1]) / 65535.0
    r, g, b = colorsys.hls_to_rgb(hue, 0.62, 0.72)
    return "#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(b * 255))


def pretty(subject_id: str) -> str:
    return subject_id.replace("-", " ").replace("_", " ").title()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(os.environ.get("MINDCRAFT_GRAPH_DATA", DEFAULT_SOURCE)),
        help="graph_data.json produced by the content pipeline",
    )
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="viewer JSON to write")
    args = parser.parse_args()

    source: Path = args.source
    if not source.exists():
        print(f"ERROR: source graph not found: {source}", file=sys.stderr)
        print("Pass --source or set MINDCRAFT_GRAPH_DATA.", file=sys.stderr)
        return 1

    raw = json.loads(source.read_text())
    raw_nodes = raw.get("nodes") or []
    raw_edges = raw.get("edges") or []
    subject_titles = {s["id"]: s.get("title") or pretty(s["id"]) for s in (raw.get("subjects") or [])}

    nodes = []
    seen: set[str] = set()
    duplicates = 0
    for n in raw_nodes:
        node_id = n.get("id")
        if not node_id:
            continue
        if node_id in seen:
            duplicates += 1
            continue
        seen.add(node_id)
        lesson = n.get("lesson") or None
        sims = n.get("sims") or []
        nodes.append(
            {
                "id": node_id,
                "name": n.get("name") or node_id,
                "subject": n.get("subject") or "unknown",
                "level": n.get("level") or "core",
                "hasLesson": bool(lesson and (lesson.get("body") or lesson.get("summary"))),
                "hasSim": bool(sims),
            }
        )

    # Sorted for stable diffs across re-runs. Ids come in two shapes, bare
    # ("circles_geometry", act-math only) and subject-prefixed
    # ("biology::phylogenetics"), and both are carried through untouched:
    # the viewer and the search resolver key off whatever id lands here.
    nodes.sort(key=lambda n: (n["subject"], n["id"]))

    edges = []
    dangling = 0
    edge_seen: set[tuple[str, str, str]] = set()
    for e in raw_edges:
        src, dst = e.get("from"), e.get("to")
        if not src or not dst:
            continue
        if src not in seen or dst not in seen:
            dangling += 1
            continue
        relation = e.get("relation") or "prerequisite"
        key = (src, dst, relation)
        if key in edge_seen:
            continue
        edge_seen.add(key)
        edges.append(
            {
                "source": src,
                "target": dst,
                "relation": relation,
                "weight": round(float(e.get("weight") or 0.0), 3),
            }
        )
    edges.sort(key=lambda e: (e["source"], e["target"], e["relation"]))

    # Per-subject rollup, computed from what is actually in the file today.
    by_subject: dict[str, dict] = {}
    for n in nodes:
        s = by_subject.setdefault(
            n["subject"],
            {
                "id": n["subject"],
                "title": subject_titles.get(n["subject"], pretty(n["subject"])),
                "color": SUBJECT_COLORS.get(n["subject"]) or fallback_color(n["subject"]),
                "nodeCount": 0,
                "withLesson": 0,
                "withSim": 0,
            },
        )
        s["nodeCount"] += 1
        s["withLesson"] += 1 if n["hasLesson"] else 0
        s["withSim"] += 1 if n["hasSim"] else 0
    subjects = sorted(by_subject.values(), key=lambda s: s["id"])

    payload = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": str(source),
        "counts": {
            "nodes": len(nodes),
            "edges": len(edges),
            "withLesson": sum(1 for n in nodes if n["hasLesson"]),
            "withSim": sum(1 for n in nodes if n["hasSim"]),
            "subjects": len(subjects),
        },
        "subjects": subjects,
        "nodes": nodes,
        "edges": edges,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, separators=(",", ":")))

    c = payload["counts"]
    print(f"source  {source}")
    print(f"wrote   {args.out}  ({args.out.stat().st_size / 1024:.0f} KB)")
    print(
        f"nodes   {c['nodes']}  ({c['withLesson']} with a lesson, {c['withSim']} with a sim)"
    )
    print(f"edges   {c['edges']}  across {c['subjects']} subjects")
    if duplicates:
        print(f"note    skipped {duplicates} duplicate node ids")
    if dangling:
        print(f"note    skipped {dangling} edges pointing at unknown nodes")
    missing = [s["id"] for s in subjects if s["id"] not in SUBJECT_COLORS]
    if missing:
        print(f"note    new subjects on a generated color: {', '.join(missing)}")
        print("        add them to SUBJECT_COLORS in this script for a hand-picked hue")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
