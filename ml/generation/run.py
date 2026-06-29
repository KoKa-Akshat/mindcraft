"""CLI: generate essence-grounded, format-tagged questions → JSON for the bank.

Examples:
  # dry run (no LLM): show the generation plan + a sample prompt
  python -m generation.run --concepts right_triangle_geometry --dry-run

  # generate with a local model (Ollama running) for a few concepts
  LLM_PROVIDER=ollama LLM_MODEL=llama3.1:8b \
    python -m generation.run --concepts right_triangle_geometry,circles_geometry

  # all ACT-tested concepts, all formats (slow — many LLM calls)
  python -m generation.run --tested --formats all

Output is a flat `Question[]` (C5 shape) the frontend bank loads (Lane B / B4).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

from .essence import build_essence
from .generate import FORMAT_GUIDE, build_prompt, generate_for
from .llm_client import provider

ROOT = pathlib.Path(__file__).resolve().parent.parent
ONTOLOGY_DIR = ROOT / "data" / "5_level_ontology"
L1 = ONTOLOGY_DIR / "01_mindcraft_concept_ontology_v2_6_with_combinations.json"
DEFAULT_OUT = ROOT / "data" / "generated_questions.json"
DEFAULT_FORMATS = ["word_problem", "symbolic_expression"]


def tested_concepts() -> list[str]:
    data = json.loads(L1.read_text())
    return [c["id"] for c in data["concepts"] if c.get("act_relevance", {}).get("tested")]


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--concepts", help="comma-separated concept ids")
    ap.add_argument("--tested", action="store_true", help="all act_relevance.tested concepts")
    ap.add_argument("--formats", default=",".join(DEFAULT_FORMATS),
                    help="comma list, or 'all' for every FormatId")
    ap.add_argument("--levels", default="1,2,3")
    ap.add_argument("--per", type=int, default=3, help="questions per (concept,level,format)")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--dry-run", action="store_true", help="plan + sample prompt, no LLM calls")
    args = ap.parse_args(argv)

    if args.concepts:
        concepts = [c.strip() for c in args.concepts.split(",") if c.strip()]
    elif args.tested:
        concepts = tested_concepts()
    else:
        print("specify --concepts <ids> or --tested", file=sys.stderr)
        return 2

    formats = list(FORMAT_GUIDE) if args.formats == "all" else \
        [f.strip() for f in args.formats.split(",") if f.strip()]
    levels = [int(x) for x in args.levels.split(",")]

    essence = build_essence(ONTOLOGY_DIR)
    plan = [(c, lv, f) for c in concepts for lv in levels for f in formats]
    print(f"plan: {len(concepts)} concepts × {len(levels)} levels × {len(formats)} formats "
          f"× {args.per} = up to {len(plan) * args.per} questions")

    if args.dry_run:
        c, lv, f = plan[0]
        print(f"\n--- sample prompt [{c} L{lv} {f}] ---\n")
        print(build_prompt(c, essence.get(c), lv, f, args.per))
        seeded = sum(1 for c in concepts if essence.get(c) and essence[c].examples)
        print(f"\nessence: {seeded}/{len(concepts)} target concepts have Layer-3 seed examples")
        return 0

    print(f"provider: {provider()}")
    out: list[dict] = []
    for c, lv, f in plan:
        items = generate_for(c, essence.get(c), lv, f, args.per)
        out.extend(items)
        print(f"  {c} L{lv} {f}: {len(items)}")
    pathlib.Path(args.out).write_text(json.dumps(out, indent=2))
    print(f"\nwrote {len(out)} questions → {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
