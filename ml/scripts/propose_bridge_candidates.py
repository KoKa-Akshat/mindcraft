# ml/scripts/propose_bridge_candidates.py

"""
Propose candidate cross-concept bridges — READ-ONLY, PROPOSE-ONLY.

Built in response to a real product complaint ("the right side of the
Knowledge Map is scattered dots") that turned out to be a real data gap, not
a rendering bug — see agent_work/research/CONTENT_QUALITY_AND_BRIDGING_PLAN.md
for the full diagnosis. 26 of 42 concepts appear in NO bridge group at all
(the entire stats/probability branch, most of geometry, both cross_cutting
concepts), and bridges are what CREATE the concept graph's edges
(`_derive_concept_edges` in complete_ontology_loader.py) and seed the
Beta-Binomial priors every student graph starts from.

This script finds and RANKS candidate concept pairs that look like missing
bridges, using two independent, cross-validating signals:
  S1 — 384-dim sentence-embedding cosine similarity (semantic closeness)
  S2 — Layer-2 archetype co-requirement counts (real exam evidence: how often
       a question actually needs both concepts together)

It NEVER writes to the ontology, NEVER touches serving code or Firestore, and
NEVER auto-authors a bridge. A bridge is a directed, ingredient-level,
judgment-based record (from_ingredient_id, to_ingredient_id, description,
card_hint, difficulty) — this script can nominate a CONCEPT pair as worth
looking at; only a human (Blake) can write the actual bridge. Embedding
similarity is symmetric and concept-level; it can never stand in for that
judgment call. See "Why auto-writing bridges would corrupt the algorithm" in
the plan doc above for the full reasoning — direction, ingredient choice, and
difficulty all feed live student-facing pathfinding and mastery priors, and a
wrong one is expensive to unlearn (20-pseudo-count prior).

Usage (from ml/, with the venv active):
    python scripts/propose_bridge_candidates.py
    python scripts/propose_bridge_candidates.py --draft --top 20

Outputs (the ONLY writes this script makes):
    agent_work/engine/BRIDGE_CANDIDATES_REVIEW.md  — ranked table for Blake
    agent_work/engine/bridge_candidates.json        — same data, structured

--draft (optional, costs a small LLM call per candidate — see llm_client.py,
LLM_PROVIDER in ml/.env.local) additionally asks the model to draft a full
bridge record per top candidate: direction, a specific ingredient pair (
validated against the real nested ingredient list, not the stale
canonical_registries), description, card_hint, difficulty, or an honest
NOT_A_BRIDGE verdict with a reason. A draft is still just a draft — accepting
it into the ontology is a manual edit, same discipline as any other Layer-1
change (see the review file's own header).
"""

from __future__ import annotations

import argparse
import itertools
import json
import os
import pathlib
import sys

import numpy as np

from mindcraft_graph.loaders.complete_ontology_loader import _derive_concept_edges
from mindcraft_graph.representation.embeddings import (
    load_concept_embeddings,
    load_pca_axes,
    project_concept_embeddings,
)

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
ML_DATA = REPO_ROOT / "ml" / "data"
ONTOLOGY_PATH = ML_DATA / "5_level_ontology" / "01_mindcraft_concept_ontology_v2_6_with_combinations.json"
ARCHETYPES_PATH = ML_DATA / "5_level_ontology" / "02_question_archetype_ontology_v1_6_standardized.json"
EMBEDDINGS_PATH = ML_DATA / "concept_embeddings.npz"
PCA_PATH = ML_DATA / "pca_axes.npz"

# Hard guardrail: every write this script makes must land under agent_work/.
# Asserted at the call site (write_outputs), not just documented, so a typo'd
# path fails loud instead of silently writing somewhere real.
OUTPUT_DIR = REPO_ROOT / "agent_work" / "engine"


def _assert_safe_output_path(path: pathlib.Path) -> None:
    resolved = path.resolve()
    if OUTPUT_DIR.resolve() not in resolved.parents and resolved != OUTPUT_DIR.resolve():
        raise RuntimeError(
            f"Refusing to write outside agent_work/: {resolved}. "
            "This script is propose-only — see its own module docstring."
        )


def load_ontology_data() -> dict:
    return json.loads(ONTOLOGY_PATH.read_text())


def load_archetypes_data() -> dict:
    return json.loads(ARCHETYPES_PATH.read_text())


def directed_edges(ontology_data: dict) -> set[tuple[str, str]]:
    """The real, single-direction edge set exactly as the engine derives it.
    Reuses the loader's own `_derive_concept_edges` rather than re-deriving
    edges by hand, so this script can never disagree with what the live
    engine actually sees. This is the set to run cycle detection against -
    NOT the doubled undirected set below, which would make every existing
    edge look like a 2-cycle on its own."""
    return {(e.from_concept, e.to_concept) for e in _derive_concept_edges(ontology_data)}


def existing_edge_pairs(directed: set[tuple[str, str]]) -> set[tuple[str, str]]:
    """Undirected pairs that already have a derived edge (either direction) -
    the set we're looking OUTSIDE of for candidates."""
    pairs: set[tuple[str, str]] = set()
    for a, b in directed:
        pairs.add((a, b))
        pairs.add((b, a))
    return pairs


def existing_bridge_pairs(ontology_data: dict) -> set[tuple[str, str]]:
    """Just the top-level bridges[] pairs (a strict subset of all derived
    edges - comes_from-derived edges aren't authored bridges). Used only to
    calibrate the S1 similarity threshold against real, human-authored bridges."""
    pairs = set()
    for group in ontology_data.get("bridges", []):
        fc, tc = group.get("from_concept"), group.get("to_concept")
        if fc and tc:
            pairs.add(tuple(sorted((fc, tc))))
    return pairs


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def compute_s1_similarities(
    concept_ids: list[str], embeddings: dict[str, np.ndarray]
) -> dict[tuple[str, str], float]:
    sims: dict[tuple[str, str], float] = {}
    for a, b in itertools.combinations(sorted(concept_ids), 2):
        if a not in embeddings or b not in embeddings:
            continue
        sims[(a, b)] = cosine(embeddings[a], embeddings[b])
    return sims


def compute_s2_archetype_counts(archetypes: list[dict]) -> dict[tuple[str, str], int]:
    """Count, per unordered concept pair, how many archetypes require BOTH -
    either as (primary, bridge_concept) or (primary, primary) co-occurrence.
    This is real exam co-requirement evidence, independent of embeddings."""
    counts: dict[tuple[str, str], int] = {}
    for arche in archetypes:
        primaries = list(dict.fromkeys(arche.get("primary_concept_ids", [])))
        bridges = list(dict.fromkeys(arche.get("bridge_concept_ids", [])))
        all_ids = list(dict.fromkeys(primaries + bridges))
        for a, b in itertools.combinations(sorted(all_ids), 2):
            counts[(a, b)] = counts.get((a, b), 0) + 1
    return counts


def zscore(values: dict[tuple[str, str], float], keys: list[tuple[str, str]]) -> dict[tuple[str, str], float]:
    arr = np.array([values.get(k, 0.0) for k in keys], dtype=float)
    std = arr.std()
    if std == 0:
        return {k: 0.0 for k in keys}
    mean = arr.mean()
    return {k: float((values.get(k, 0.0) - mean) / std) for k in keys}


def has_cycle(edges: set[tuple[str, str]], nodes: set[str]) -> bool:
    """Plain DFS cycle check on a directed graph (Kahn-equivalent) - used to
    dry-run a candidate edge before it's even suggested as directional."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {n: WHITE for n in nodes}
    adj: dict[str, list[str]] = {n: [] for n in nodes}
    for a, b in edges:
        adj.setdefault(a, []).append(b)

    def visit(n: str) -> bool:
        color[n] = GRAY
        for nxt in adj.get(n, []):
            if color.get(nxt, WHITE) == GRAY:
                return True
            if color.get(nxt, WHITE) == WHITE and visit(nxt):
                return True
        color[n] = BLACK
        return False

    return any(color[n] == WHITE and visit(n) for n in nodes)


def cycle_risk(directed_edges: set[tuple[str, str]], nodes: set[str], a: str, b: str) -> str:
    """Which direction(s) of a candidate a<->b edge would create a cycle in
    the CURRENT derived edge set. 'none' = safe either way structurally
    (direction is still a judgment call, just not a structural one)."""
    forward_bad = has_cycle(directed_edges | {(a, b)}, nodes)
    backward_bad = has_cycle(directed_edges | {(b, a)}, nodes)
    if forward_bad and backward_bad:
        return "both"
    if forward_bad:
        return f"{a}->{b}"
    if backward_bad:
        return f"{b}->{a}"
    return "none"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top", type=int, default=20, help="How many ranked candidates to output/draft")
    parser.add_argument("--draft", action="store_true", help="Also LLM-draft full bridge records for the top N (costs a small LLM call per candidate)")
    args = parser.parse_args()

    print(f"Loading ontology from {ONTOLOGY_PATH.relative_to(REPO_ROOT)}")
    ontology_data = load_ontology_data()
    concepts = ontology_data["concepts"]
    concept_ids = [c["id"] for c in concepts]
    concept_names = {c["id"]: c["name"] for c in concepts}

    print(f"Loading archetypes from {ARCHETYPES_PATH.relative_to(REPO_ROOT)}")
    archetypes_data = load_archetypes_data()
    archetypes = archetypes_data["archetypes"]

    print(f"Loading embeddings from {EMBEDDINGS_PATH.relative_to(REPO_ROOT)}")
    concept_embeddings = load_concept_embeddings(EMBEDDINGS_PATH)
    pca_components, pca_mean, _ = load_pca_axes(PCA_PATH)
    projections = project_concept_embeddings(concept_embeddings, pca_components, pca_mean)

    directed = directed_edges(ontology_data)
    all_edges = existing_edge_pairs(directed)
    bridge_pairs = existing_bridge_pairs(ontology_data)
    print(f"{len(bridge_pairs)} authored bridge groups, {len(all_edges) // 2} total derived edges (undirected)")

    # Calibrate S1's threshold against real, human-authored bridges - don't
    # invent a cutoff, measure the ones Blake already approved.
    s1_all = compute_s1_similarities(concept_ids, concept_embeddings)
    bridge_sims = [s1_all[tuple(sorted(p))] for p in bridge_pairs if tuple(sorted(p)) in s1_all]
    s1_threshold = min(bridge_sims) if bridge_sims else 0.4
    print(f"S1 calibration: {len(bridge_sims)} authored bridges score {min(bridge_sims):.2f}-{max(bridge_sims):.2f} "
          f"(threshold = {s1_threshold:.2f})" if bridge_sims else "S1 calibration: no authored bridges found in embeddings, using 0.40")

    s2_counts = compute_s2_archetype_counts(archetypes)

    # Candidate pool: every concept pair with NO existing edge in either
    # direction, that clears the calibrated S1 bar (S2 alone can't clear a
    # pair in - archetype co-requirement without semantic closeness is more
    # likely "these two just both showed up on one hard problem" than a real
    # missing bridge; S1 is the gate, S2 boosts the ranking).
    candidates = [
        (a, b) for a, b in itertools.combinations(sorted(concept_ids), 2)
        if (a, b) not in all_edges and s1_all.get((a, b), 0.0) >= s1_threshold
    ]
    print(f"{len(candidates)} candidate pairs clear the S1 bar with no existing edge")

    s2_z = zscore(s2_counts, candidates)
    s1_z = zscore({k: s1_all[k] for k in candidates}, candidates)
    scored = []
    for pair in candidates:
        score = s1_z[pair] + 2.0 * s2_z[pair]
        pc1_a = float(projections[pair[0]][0])
        pc1_b = float(projections[pair[1]][0])
        cluster = "cross_cluster" if (pc1_a > 0) != (pc1_b > 0) else "same_cluster"
        risk = cycle_risk(directed, set(concept_ids), pair[0], pair[1])
        scored.append({
            "pair": pair,
            "names": (concept_names.get(pair[0], pair[0]), concept_names.get(pair[1], pair[1])),
            "s1_similarity": round(s1_all[pair], 3),
            "s2_archetype_count": s2_counts.get(pair, 0),
            "score": round(score, 3),
            "cluster": cluster,
            "cycle_risk": risk,
            "cross_validated": s2_counts.get(pair, 0) > 0,
        })

    scored.sort(key=lambda r: r["score"], reverse=True)
    top = scored[: args.top]

    drafts: dict[str, dict] = {}
    if args.draft:
        drafts = draft_bridge_records(top, ontology_data)

    write_outputs(top, drafts, s1_threshold, len(candidates))


def _load_env_local() -> None:
    """Same tolerant ml/.env.local loader as generation/run.py's own
    _load_env_local - GROQ_API_KEY/LLM_PROVIDER live only in that gitignored
    file, and llm_client.py expects its caller to have already populated
    os.environ (it never loads dotenv itself)."""
    p = REPO_ROOT / "ml" / ".env.local"
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def nested_ingredient_ids(ontology_data: dict, concept_id: str) -> list[str]:
    for c in ontology_data["concepts"]:
        if c["id"] == concept_id:
            return [ing["id"] for ing in c.get("ingredients", [])]
    return []


def draft_bridge_records(top: list[dict], ontology_data: dict) -> dict[str, dict]:
    """LLM drafting pass - draft != decide. One call per candidate pair,
    asking for a full bridge record in the exact ontology shape, or an honest
    NOT_A_BRIDGE verdict. Ingredient ids are validated against the real
    NESTED ingredient list (canonical_registries lags at 167/179 per
    CLAUDE.md - never trust that list for validation)."""
    # `generation` isn't part of the installed mindcraft_graph package
    # (pyproject.toml only includes mindcraft_graph*), so it's not on
    # sys.path by default - add ml/ explicitly, only when --draft is used.
    ml_dir = str(REPO_ROOT / "ml")
    if ml_dir not in sys.path:
        sys.path.insert(0, ml_dir)
    _load_env_local()
    # llm_client.py's own DEFAULT_MODELS["groq"] (llama-3.3-70b-versatile) 404s
    # on this key - same dead-model issue this session already found and fixed
    # for the webhook's own Groq key. Set our own default rather than editing
    # that shared file (ml/generation/'s lane, untouched here) - .env.local's
    # LLM_MODEL, if set, still wins.
    os.environ.setdefault("LLM_MODEL", "openai/gpt-oss-120b")
    from generation.llm_client import complete  # local import: only needed for --draft

    drafts: dict[str, dict] = {}
    for row in top:
        a, b = row["pair"]
        ing_a = nested_ingredient_ids(ontology_data, a)
        ing_b = nested_ingredient_ids(ontology_data, b)
        prompt = f"""You are drafting a candidate BRIDGE for a math learning ontology - a
directed, ingredient-level "enabling" relationship between two concepts a
student might know both of but fail to CONNECT.

Concept A: {a} ({row['names'][0]})
  ingredients: {json.dumps(ing_a)}
Concept B: {b} ({row['names'][1]})
  ingredients: {json.dumps(ing_b)}

Evidence this pair might need a bridge: embedding similarity {row['s1_similarity']},
co-required in {row['s2_archetype_count']} real exam question archetypes.

If there IS a real, specific enabling relationship (a student who has ingredient
X from one concept needs it to use ingredient Y in the other), respond with
strict JSON:
{{"verdict": "BRIDGE", "direction": "A_TO_B" or "B_TO_A",
  "from_ingredient_id": "<must be one of the ingredient ids listed above for the FROM concept>",
  "to_ingredient_id": "<must be one of the ingredient ids listed above for the TO concept>",
  "bridge_description": "<one sentence: what breaks when a student can't connect these>",
  "card_hint": "<one sentence: how to teach the connection>",
  "difficulty": <float 0-1, how hard is this specific connection>}}

If these two concepts are merely SIMILAR (same topic family, same
representation) but there's no real enabling failure mode between them,
respond honestly with:
{{"verdict": "NOT_A_BRIDGE", "reason": "<why this is similarity, not a bridge>"}}

Respond with ONLY the JSON object, nothing else."""
        try:
            # 400 truncated valid JSON mid-string on gpt-oss-120b (a reasoning
            # model - completion tokens cover its reasoning too, not just the
            # final answer). 900 gives real headroom for a one-object reply.
            raw = complete(prompt, system="You are a precise math curriculum designer. Output only valid JSON.", max_tokens=900, temperature=0.3)
            parsed = json.loads(raw.strip().strip("`").removeprefix("json").strip())
            if parsed.get("verdict") == "BRIDGE":
                valid_from = parsed.get("from_ingredient_id") in (ing_a if parsed.get("direction") == "A_TO_B" else ing_b)
                valid_to = parsed.get("to_ingredient_id") in (ing_b if parsed.get("direction") == "A_TO_B" else ing_a)
                if not (valid_from and valid_to):
                    parsed = {"verdict": "DRAFT_INVALID", "reason": "model referenced an ingredient id not in the nested list", "raw": parsed}
            drafts[f"{a}|{b}"] = parsed
        except Exception as exc:  # noqa: BLE001 - a bad draft must not kill the batch
            drafts[f"{a}|{b}"] = {"verdict": "DRAFT_FAILED", "reason": str(exc)}
    return drafts


def write_outputs(top: list[dict], drafts: dict[str, dict], s1_threshold: float, pool_size: int) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    md_path = OUTPUT_DIR / "BRIDGE_CANDIDATES_REVIEW.md"
    json_path = OUTPUT_DIR / "bridge_candidates.json"
    _assert_safe_output_path(md_path)
    _assert_safe_output_path(json_path)

    lines = [
        "# Bridge candidates — ranked, for review",
        "",
        "**This file proposes. It does not decide.** Every row here is a candidate",
        "concept pair with no existing bridge/edge, ranked by two independent",
        "signals (embedding similarity + real exam co-requirement). Nothing in",
        "this file has been written to the ontology. Merging a row into",
        f"`{ONTOLOGY_PATH.relative_to(REPO_ROOT)}` is a manual edit — same discipline",
        "as any other Layer-1 change: rerun `ml/scripts/end2end.py` (expect 85/85",
        "still passing) and `ml/scripts/audit_act_ontology_question_bank.py` after,",
        "bump `meta.version`, then a normal deploy.",
        "",
        f"S1 similarity threshold calibrated from real authored bridges: {s1_threshold:.2f}. "
        f"{pool_size} pairs cleared it with no existing edge; showing top {len(top)}.",
        "",
        "| Pair | S1 sim | S2 (archetypes) | Score | Cluster | Cycle risk | Draft | Accept? |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for row in top:
        a, b = row["pair"]
        name_a, name_b = row["names"]
        draft = drafts.get(f"{a}|{b}")
        if draft is None:
            draft_cell = "(not drafted — rerun with `--draft`)"
        elif draft.get("verdict") == "BRIDGE":
            draft_cell = (
                f"**{draft['direction']}**: {draft['from_ingredient_id']} → {draft['to_ingredient_id']} "
                f"(diff {draft.get('difficulty')}) — {draft.get('bridge_description', '')}"
            )
        elif draft.get("verdict") == "NOT_A_BRIDGE":
            draft_cell = f"_Model says not a bridge_: {draft.get('reason', '')}"
        else:
            draft_cell = f"_Draft failed/invalid_: {draft.get('reason', '')}"
        star = " ⭐" if row["cross_validated"] else ""
        lines.append(
            f"| `{a}` ({name_a}) ↔ `{b}` ({name_b}){star} | {row['s1_similarity']} | "
            f"{row['s2_archetype_count']} | {row['score']} | {row['cluster']} | "
            f"{row['cycle_risk']} | {draft_cell} | ☐ |"
        )
    lines += [
        "",
        "⭐ = cross-validated by both signals (semantic similarity AND real exam co-requirement) — start here.",
        "",
        "## Suggested first batch",
        "",
        "Geometry-cluster, same_cluster or cross_cluster with cycle_risk = none, ⭐ first — "
        "these are the highest-confidence, lowest-structural-risk candidates and land in the "
        "region the founder actually pointed at (the Map's sparse right side).",
    ]
    md_path.write_text("\n".join(lines) + "\n")

    json_path.write_text(json.dumps({
        "s1_threshold": s1_threshold,
        "pool_size": pool_size,
        "candidates": [
            {**row, "draft": drafts.get(f"{row['pair'][0]}|{row['pair'][1]}")}
            for row in top
        ],
    }, indent=2))

    print(f"\nWrote {md_path.relative_to(REPO_ROOT)}")
    print(f"Wrote {json_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
