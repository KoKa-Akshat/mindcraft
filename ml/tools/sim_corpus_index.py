#!/usr/bin/env python3
"""
Index the McCreary simulation corpus and find the missing cross-subject edges.

Two problems, one tool, because they turn out to be the same problem.

    1. 4,144 simulation files sit in a local mirror with no machine-readable
       description of what each one teaches or what you can turn on it.
    2. The 108 concept graphs hold 45,565 dependency edges and exactly zero of
       them cross a subject boundary. The ontology is 108 disconnected islands,
       so no learning path that crosses a subject can be expressed, and every
       interesting question crosses a subject.

The connection: a simulation is evidence. When one sim maps to concepts that
live in two different subject graphs, that sim is a bridge somebody already
built by hand, in code, without anyone writing the edge down. This tool reads
the corpus and recovers those bridges.

Nothing here writes into the graphs. It emits proposals with the evidence
attached, because an ontology edge asserted by a script and never reviewed is
worse than a missing one.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field, asdict
from pathlib import Path

REPO = Path("/Volumes/SSK SSD/Developer/mindcraft")
MIRROR = REPO / "agent_work/product/archive_mirror/out"
GRAPHS = REPO / "ml/data/dynamic_graphs"
OUT = REPO / "agent_work/scoping/generated"

# Words that match everything and therefore mean nothing. A sim called
# "intro-to-vectors" should not bridge to every concept containing "intro".
STOPWORDS = {
    "a", "an", "and", "the", "of", "to", "in", "for", "with", "or", "is",
    "intro", "introduction", "basic", "basics", "simple", "demo", "explorer",
    "simulator", "simulation", "sim", "microsim", "interactive", "viewer",
    "builder", "calculator", "visualizer", "visualiser", "tool", "lab",
    "example", "test", "new", "old", "part", "one", "two", "step", "how",
    "what", "why", "using", "make", "your", "you", "it", "on", "at", "by",
}

# Recovering a sim's inputs. 917 of 998 slider files in this corpus use this
# exact idiom, which is what makes a build-time regex worth writing at all.
SLIDER_RE = re.compile(
    r"""(?P<name>\w+)\s*=\s*createSlider\(\s*
        (?P<min>-?[\d.]+)\s*,\s*(?P<max>-?[\d.]+)\s*,\s*
        (?P<default>-?[\d.]+)\s*(?:,\s*(?P<step>-?[\d.]+)\s*)?\)""",
    re.VERBOSE,
)
CANVAS_H_RE = re.compile(r"//\s*CANVAS_HEIGHT:\s*(\d+)")

# What kind of thing a file actually is. 1,028 of them are not p5 sketches at
# all, and a shim that assumes p5 would silently produce nonsense for a quarter
# of the corpus.
KIND_MARKERS = [
    ("vis-network", ("vis.Network", "vis-network", "new vis.")),
    ("chartjs", ("new Chart(", "chart.js", "Chart.register")),
    ("mermaid", ("mermaid.initialize", "mermaid.render")),
    ("p5", ("function setup()", "function draw()", "createCanvas(")),
]

# The full p5 MicroSim template. A sim that satisfies all four is one the
# generic shim can drive without being read by a human first.
TEMPLATE_MARKERS = ("drawHeight", "controlHeight", "updateCanvasSize", "windowResized")


def tokens(text: str) -> set[str]:
    """Meaningful lowercase word stems from a slug, id segment, or label."""
    raw = re.split(r"[^a-z0-9]+", text.lower())
    return {w for w in raw if len(w) > 2 and w not in STOPWORDS}


@dataclass
class Sim:
    repo: str
    slug: str
    kind: str = "unknown"
    follows_template: bool = False
    canvas_height: int | None = None
    sliders: list[dict] = field(default_factory=list)
    js_bytes: int = 0
    concepts: list[str] = field(default_factory=list)
    subjects: list[str] = field(default_factory=list)

    @property
    def shim_tier(self) -> str:
        """How much human work this sim needs before it can be a live Frame.

        display  the sim renders and nothing can be driven from outside
        input    sliders are recoverable, so a generic shim can set them
        dataflow needs a person, because no sim in this corpus declares outputs
        """
        if self.kind != "p5":
            return "display"
        if self.sliders and self.follows_template:
            return "input"
        return "display"


def load_graphs() -> tuple[dict[str, dict], dict[str, set[str]]]:
    """Every concept in every subject graph, plus a token index over them."""
    concepts: dict[str, dict] = {}
    index: dict[str, set[str]] = defaultdict(set)
    for path in sorted(GRAPHS.glob("*.json")):
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        for concept in data.get("concepts", []):
            cid = concept.get("id")
            if not cid:
                continue
            concepts[cid] = concept
            label = concept.get("label", "")
            tail = cid.split("::")[-1]
            for token in tokens(tail) | tokens(label):
                index[token].add(cid)
    return concepts, index


def match_concepts(
    sim_slug: str, index: dict[str, set[str]], concepts: dict[str, dict]
) -> list[str]:
    """Concept ids a sim plausibly teaches.

    Deliberately strict. A loose matcher on 28,631 concepts produces thousands
    of bridges nobody will read, which is the same as producing none. A match
    requires the sim's own words to cover most of the concept's words, so
    "pn-junction" matches `pn-junction` and not `junction-field-effect`.
    """
    sim_tokens = tokens(sim_slug)
    if not sim_tokens:
        return []

    scored: list[tuple[float, str]] = []
    for cid in {c for t in sim_tokens for c in index.get(t, ())}:
        concept_tokens = tokens(cid.split("::")[-1]) | tokens(
            concepts[cid].get("label", "")
        )
        if not concept_tokens:
            continue
        shared = sim_tokens & concept_tokens
        # Both directions matter. Covering the concept says the sim is about
        # it; covering the sim says the sim is not about six other things too.
        coverage = len(shared) / len(concept_tokens)
        precision = len(shared) / len(sim_tokens)
        if coverage >= 0.6 and precision >= 0.4 and len(shared) >= 2:
            scored.append((coverage + precision, cid))

    scored.sort(reverse=True)
    return [cid for _, cid in scored[:6]]


def scan_sim(repo_dir: Path, entry: dict) -> Sim:
    sim = Sim(repo=repo_dir.name, slug=entry.get("slug", "?"))
    for asset in entry.get("local_assets") or []:
        if not asset.endswith(".js"):
            continue
        path = repo_dir / asset
        if not path.exists():
            continue
        try:
            source = path.read_text(errors="replace")
        except OSError:
            continue
        sim.js_bytes += len(source)

        for kind, markers in KIND_MARKERS:
            if any(m in source for m in markers):
                sim.kind = kind
                break

        if all(m in source for m in TEMPLATE_MARKERS):
            sim.follows_template = True

        if (found := CANVAS_H_RE.search(source)):
            sim.canvas_height = int(found.group(1))

        for m in SLIDER_RE.finditer(source):
            sim.sliders.append(
                {
                    "name": m.group("name"),
                    "min": float(m.group("min")),
                    "max": float(m.group("max")),
                    "default": float(m.group("default")),
                    "step": float(m.group("step")) if m.group("step") else None,
                }
            )
    return sim


def main() -> None:
    concepts, index = load_graphs()
    print(f"graphs      : {len(set(c.split('::')[0] for c in concepts))} subjects, "
          f"{len(concepts)} concepts")

    sims: list[Sim] = []
    for manifest_path in sorted(MIRROR.glob("*/sims.json")):
        repo_dir = manifest_path.parent
        try:
            entries = json.loads(manifest_path.read_text()).get("sims", [])
        except json.JSONDecodeError:
            continue
        for entry in entries:
            if entry.get("error"):
                continue
            sim = scan_sim(repo_dir, entry)
            if sim.js_bytes == 0:
                continue
            sim.concepts = match_concepts(sim.slug, index, concepts)
            sim.subjects = sorted({c.split("::")[0] for c in sim.concepts})
            sims.append(sim)

    print(f"sims scanned: {len(sims)} with real js content")

    # ---- the bridges -------------------------------------------------------
    # A sim whose concepts span two subject graphs is a cross-subject link that
    # somebody already built, in code, and never wrote down as an edge.
    #
    # Two kinds come out, and conflating them would be a real mistake:
    #
    #   equivalence  the same concept exists in both graphs under the same
    #                name. Not a dependency, an identity. These are the
    #                valuable ones, because mastery should transfer across
    #                them and today it does not: a student who has proven
    #                `beginning-electronics::node-voltage` is asked to prove
    #                `circuits::node-voltage-method` all over again.
    #
    #   association  different concepts that one simulation teaches together.
    #                A candidate prerequisite edge, and the one that actually
    #                needs a human to decide direction.
    equivalences: dict[tuple[str, str], set[tuple[str, str]]] = defaultdict(set)
    bridges: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for sim in sims:
        if len(sim.subjects) < 2:
            continue
        # Split-graph artefacts: `learning-graphs__docs` and
        # `learning-graphs__degree-chart` are one subject in two files, so a
        # link between them is not a cross-subject anything.
        roots = {s.split("__")[0] for s in sim.subjects}
        if len(roots) < 2:
            continue
        by_tail: dict[str, list[str]] = defaultdict(list)
        for cid in sim.concepts:
            by_tail[cid.split("::")[-1]].append(cid)
        for i, a in enumerate(sim.subjects):
            for b in sim.subjects[i + 1:]:
                if a.split("__")[0] == b.split("__")[0]:
                    continue
                for tail, ids in by_tail.items():
                    subs = {x.split("::")[0] for x in ids}
                    if a in subs and b in subs:
                        equivalences[(a, b)].add(
                            (f"{a}::{tail}", f"{b}::{tail}")
                        )
                bridges[(a, b)].append(
                    {"sim": f"{sim.repo}/{sim.slug}", "concepts": sim.concepts}
                )

    kinds = Counter(s.kind for s in sims)
    tiers = Counter(s.shim_tier for s in sims)
    mapped = sum(1 for s in sims if s.concepts)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "sim_corpus_index.json").write_text(
        json.dumps([asdict(s) for s in sims], indent=1)
    )
    (OUT / "cross_subject_bridges.json").write_text(
        json.dumps(
            [
                {
                    "subjects": list(pair),
                    "evidence_count": len(ev),
                    "equivalences": sorted(equivalences.get(pair, ())),
                    "evidence": ev[:8],
                }
                for pair, ev in sorted(bridges.items(), key=lambda kv: -len(kv[1]))
            ],
            indent=1,
        )
    )

    print()
    print("kinds       :", dict(kinds))
    print("shim tiers  :", dict(tiers))
    print(f"concept-mapped: {mapped} of {len(sims)} ({mapped/len(sims)*100:.1f}%)")
    print(f"sliders total : {sum(len(s.sliders) for s in sims)}")
    print()
    eq_pairs = sum(len(v) for v in equivalences.values())
    print(f"cross-subject bridges proposed: {len(bridges)} subject pairs")
    print(f"concept equivalences found    : {eq_pairs} "
          f"(same concept, two silos, no link, mastery does not transfer)")
    for pair, ev in sorted(bridges.items(), key=lambda kv: -len(kv[1]))[:12]:
        print(f"  {pair[0]:34s} <-> {pair[1]:34s} {len(ev):4d} sims")
    print()
    print("written to", OUT)


if __name__ == "__main__":
    main()
