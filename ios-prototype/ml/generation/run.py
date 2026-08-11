"""CLI: generate essence-grounded, format-tagged questions → JSON for the bank.

Examples:
  # dry run (no LLM): show the generation plan + a sample prompt
  python -m generation.run --concepts right_triangle_geometry --dry-run

  # generate with a local model (Ollama running) for a few concepts
  LLM_PROVIDER=ollama LLM_MODEL=llama3.1:8b \
    python -m generation.run --concepts right_triangle_geometry,circles_geometry

  # ACT-tested concepts missing canonical static-bank coverage
  python -m generation.run --uncovered --dry-run

  # all ACT-tested concepts, all formats (slow — many LLM calls)
  python -m generation.run --tested --formats all

Output is a flat `Question[]` (C5 shape) the frontend bank loads (Lane B / B4).
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
from typing import Any

from .coverage import act_tested_concepts, uncovered_concepts
from .essence import build_essence
from .generate import FORMAT_GUIDE, build_prompt, generate_for
from .llm_client import provider
from .verify import verify_items

ROOT = pathlib.Path(__file__).resolve().parent.parent
ONTOLOGY_DIR = ROOT / "data" / "5_level_ontology"
DEFAULT_OUT = ROOT / "data" / "generated_questions.json"
DEFAULT_VERIFY_REPORT = ROOT / "data" / "generated_questions.verify_report.json"
DEFAULT_FORMATS = ["word_problem", "symbolic_expression"]


def _load_env_local() -> None:
    """Load ml/.env.local (KEY=VALUE, tolerant of spaces/quotes) into os.environ
    so secrets like GROQ_API_KEY live only in that gitignored file."""
    p = ROOT / ".env.local"
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def tested_concepts() -> list[str]:
    return act_tested_concepts()


def _target_key(target: tuple[str, int, str]) -> str:
    c, lv, f = target
    return f"{c}:L{lv}:{f}"


def _parse_start_at(raw: str) -> tuple[str, int, str]:
    try:
        concept_id, raw_level, fmt = raw.split(":", 2)
        level = int(raw_level.removeprefix("L"))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("use concept_id:L1:format_id") from exc
    return concept_id, level, fmt


def _write_outputs(
    out_path: pathlib.Path,
    items: list[dict],
    verify_report_path: pathlib.Path | None = None,
    drops: list[dict] | None = None,
    completed_targets: list[str] | None = None,
) -> None:
    out_path.write_text(json.dumps(items, indent=2))
    if verify_report_path is not None:
        report: dict[str, Any] = {
            "generatedKept": len(items),
            "dropped": len(drops or []),
            "drops": drops or [],
            "completedTargets": completed_targets or [],
        }
        verify_report_path.write_text(json.dumps(report, indent=2))


def main(argv: list[str]) -> int:
    _load_env_local()
    ap = argparse.ArgumentParser()
    ap.add_argument("--concepts", help="comma-separated concept ids")
    ap.add_argument("--tested", action="store_true", help="all act_relevance.tested concepts")
    ap.add_argument(
        "--uncovered",
        action="store_true",
        help="ACT-tested canonical concepts missing static coverage at any level",
    )
    ap.add_argument(
        "--zero-only",
        action="store_true",
        help="with --uncovered, target only concepts with zero canonical static items",
    )
    ap.add_argument("--formats", default=",".join(DEFAULT_FORMATS),
                    help="comma list, or 'all' for every FormatId")
    ap.add_argument("--levels", default="1,2,3")
    ap.add_argument("--per", type=int, default=3, help="questions per (concept,level,format)")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--verify", action="store_true", help="blind re-solve generated items and drop mismatches")
    ap.add_argument("--verify-attempts", type=int, default=2, help="blind solver retries per item")
    ap.add_argument("--verify-report", default=str(DEFAULT_VERIFY_REPORT))
    ap.add_argument("--append-existing", action="store_true", help="append to existing --out/--verify-report files")
    ap.add_argument("--start-at", type=_parse_start_at, help="resume from concept_id:L1:format_id")
    ap.add_argument("--dry-run", action="store_true", help="plan + sample prompt, no LLM calls")
    args = ap.parse_args(argv)

    selectors = [bool(args.concepts), args.tested, args.uncovered]
    if sum(selectors) != 1:
        print("specify exactly one of --concepts <ids>, --tested, or --uncovered", file=sys.stderr)
        return 2

    if args.concepts:
        concepts = [c.strip() for c in args.concepts.split(",") if c.strip()]
    elif args.tested:
        concepts = tested_concepts()
    elif args.uncovered:
        concepts = uncovered_concepts(include_partial=not args.zero_only)
    else:
        print("specify exactly one of --concepts <ids>, --tested, or --uncovered", file=sys.stderr)
        return 2

    formats = list(FORMAT_GUIDE) if args.formats == "all" else \
        [f.strip() for f in args.formats.split(",") if f.strip()]
    levels = [int(x) for x in args.levels.split(",")]
    invalid_formats = sorted(set(formats) - set(FORMAT_GUIDE))
    if invalid_formats:
        print(f"unknown format(s): {', '.join(invalid_formats)}", file=sys.stderr)
        return 2
    invalid_levels = [lv for lv in levels if lv not in (1, 2, 3)]
    if invalid_levels:
        print(f"levels must be 1, 2, or 3; got {invalid_levels}", file=sys.stderr)
        return 2
    if args.start_at:
        start_concept, start_level, start_format = args.start_at
        if start_level not in (1, 2, 3):
            print(f"--start-at level must be L1, L2, or L3; got L{start_level}", file=sys.stderr)
            return 2
        if start_format not in FORMAT_GUIDE:
            print(f"--start-at format is unknown: {start_format}", file=sys.stderr)
            return 2

    essence = build_essence(ONTOLOGY_DIR)
    plan = [(c, lv, f) for c in concepts for lv in levels for f in formats]
    if args.start_at:
        try:
            start_idx = plan.index(args.start_at)
        except ValueError:
            print(f"--start-at target not in generation plan: {_target_key(args.start_at)}", file=sys.stderr)
            return 2
        plan = plan[start_idx:]
    if not plan:
        print("generation plan is empty", file=sys.stderr)
        return 2
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
    out_path = pathlib.Path(args.out)
    report_path = pathlib.Path(args.verify_report)
    out: list[dict] = []
    drops: list[dict] = []
    completed_targets: list[str] = []
    if args.append_existing:
        if out_path.exists():
            existing = json.loads(out_path.read_text())
            if not isinstance(existing, list):
                print(f"--out is not a Question[] JSON file: {out_path}", file=sys.stderr)
                return 2
            out = existing
        if args.verify and report_path.exists():
            existing_report = json.loads(report_path.read_text())
            drops = existing_report.get("drops", [])
            completed_targets = existing_report.get("completedTargets", [])
    for c, lv, f in plan:
        target = _target_key((c, lv, f))
        items = generate_for(c, essence.get(c), lv, f, args.per)
        generated_count = len(items)
        if args.verify and items:
            items, item_drops = verify_items(items, attempts=args.verify_attempts)
            drops.extend(item_drops)
        out.extend(items)
        completed_targets.append(target)
        if args.verify:
            print(f"  {c} L{lv} {f}: kept {len(items)}/{generated_count}")
        else:
            print(f"  {c} L{lv} {f}: {len(items)}")
        _write_outputs(
            out_path,
            out,
            report_path if args.verify else None,
            drops,
            completed_targets,
        )
    _write_outputs(
        out_path,
        out,
        report_path if args.verify else None,
        drops,
        completed_targets,
    )
    print(f"\nwrote {len(out)} questions → {args.out}")
    if args.verify:
        print(f"verification dropped {len(drops)} items → {args.verify_report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
