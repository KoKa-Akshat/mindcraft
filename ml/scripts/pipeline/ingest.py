#!/usr/bin/env python3
"""
MindCraft unified question-bank ingestion CLI.

Usage:
    python ml/scripts/pipeline/ingest.py --source openstax --out app/src/data/openstaxQuestions.json
    python ml/scripts/pipeline/ingest.py --source amc --years 2015-2023 --out app/src/data/amcQuestions.json
    python ml/scripts/pipeline/ingest.py --source khan --topic algebra --out app/src/data/khanQuestions.json
    python ml/scripts/pipeline/ingest.py --source eedi --train data/eedi/train.csv --out app/src/data/eediQuestions.json
    python ml/scripts/pipeline/ingest.py --all --out-dir app/src/data/
    python ml/scripts/pipeline/ingest.py --source openstax --dry-run --limit 20 --no-llm
    python ml/scripts/pipeline/ingest.py --stories        # regenerate concept stories

Notes:
- `eedi` delegates to the battle-tested ml/scripts/ingest_eedi.py (its output
  is the bare Question[] array questionBank.ts already imports; the new
  sources write {"_meta", "questions"} envelopes).
- LLM annotation requires LLM_PROVIDER (+ key) in the environment or
  ml/.env.local; without it the pipeline still runs with template
  explanations/hints (`--no-llm` skips LLM work explicitly).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = PIPELINE_DIR.parent
REPO = SCRIPTS_DIR.parents[1]
sys.path.insert(0, str(PIPELINE_DIR))
sys.path.insert(0, str(PIPELINE_DIR / "sources"))
sys.path.insert(0, str(SCRIPTS_DIR))

from base import ConceptMapper, run_pipeline  # noqa: E402

SOURCES = ("openstax", "amc", "khan", "eedi")


def load_env_local() -> None:
    """Pick up LLM keys from ml/.env.local without requiring an export."""
    env_path = REPO / "ml" / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def parse_years(spec: str | None) -> tuple[int, int] | None:
    if not spec:
        return None
    if "-" in spec:
        lo, hi = spec.split("-", 1)
        return int(lo), int(hi)
    year = int(spec)
    return year, year


def build_adapter(source: str, mapper: ConceptMapper):
    if source == "openstax":
        from openstax import OpenStaxAdapter
        return OpenStaxAdapter(mapper)
    if source == "amc":
        from amc import AMCAdapter
        return AMCAdapter(mapper)
    if source == "khan":
        from khan import KhanAdapter
        return KhanAdapter(mapper)
    raise ValueError(f"unknown source: {source}")


def run_eedi(args: argparse.Namespace) -> None:
    """Delegate to the existing (unmodified) Eedi pipeline."""
    import ingest_eedi  # ml/scripts/ingest_eedi.py
    concept_filter = set(args.concepts.split(",")) if args.concepts else None
    ingest_eedi.ingest(
        train_path=args.train or "data/eedi/train.csv",
        mapping_path=args.mapping or "data/eedi/misconception_mapping.csv",
        out_questions=args.out or "app/src/data/eediQuestions.json",
        out_misconceptions="ml/data/eedi_misconceptions.json",
        report_path="data/eedi/ingest_report.json",
        use_llm=not args.no_llm,
        dry_run=args.dry_run,
        concept_filter=concept_filter,
        limit=args.limit,
    )


def run_source(source: str, args: argparse.Namespace, out_path: Path,
               mapper: ConceptMapper) -> None:
    if source == "eedi":
        run_eedi(args)
        return
    adapter = build_adapter(source, mapper)
    fetch_kwargs: dict = {}
    if source == "amc" and args.years:
        fetch_kwargs["years"] = parse_years(args.years)
    if source == "khan" and args.topic:
        fetch_kwargs["topic"] = args.topic
    run_pipeline(
        adapter,
        out_path=out_path,
        annotate=not args.no_llm,
        dry_run=args.dry_run,
        limit=args.limit,
        concept_filter=set(args.concepts.split(",")) if args.concepts else None,
        fetch_kwargs=fetch_kwargs,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="MindCraft multi-source question-bank ingestion")
    parser.add_argument("--source", choices=SOURCES + ("all",),
                        help="Which source to ingest")
    parser.add_argument("--all", action="store_true",
                        help="Ingest every source (openstax, amc, khan)")
    parser.add_argument("--out", help="Output JSON path (single source)")
    parser.add_argument("--out-dir", default="app/src/data",
                        help="Output directory for --all "
                             "(writes {source}Questions.json per source)")
    parser.add_argument("--dry-run", action="store_true",
                        help="No files written; print stats only")
    parser.add_argument("--no-llm", action="store_true",
                        help="Skip LLM annotation (template explanations/hints)")
    parser.add_argument("--limit", type=int, help="Process only first N items")
    parser.add_argument("--concepts", help="Comma-separated concept ID filter")
    parser.add_argument("--years", help="AMC year range, e.g. 2015-2023")
    parser.add_argument("--topic", help="Khan topic slug, e.g. algebra")
    parser.add_argument("--train", help="Eedi train.csv path")
    parser.add_argument("--mapping", help="Eedi misconception_mapping.csv path")
    parser.add_argument("--stories", action="store_true",
                        help="Regenerate concept stories instead of questions")
    parser.add_argument("--force-stories", action="store_true",
                        help="With --stories: regenerate even passing stories")
    args = parser.parse_args()

    load_env_local()
    os.chdir(REPO)  # relative default paths (eedi) resolve against repo root

    if args.stories:
        from story_generator import regenerate_stories
        regenerate_stories(
            concept_filter=set(args.concepts.split(",")) if args.concepts else None,
            dry_run=args.dry_run, limit=args.limit, force=args.force_stories,
        )
        return

    if not args.source and not args.all:
        parser.error("pass --source <name>, --all, or --stories")

    sources = list(SOURCES[:3]) if (args.all or args.source == "all") else [args.source]
    mapper = ConceptMapper()  # shared across sources (one ontology load)

    for source in sources:
        if args.out and len(sources) == 1:
            out_path = Path(args.out)
        else:
            out_path = Path(args.out_dir) / f"{source}Questions.json"
        print(f"\n### Ingesting source: {source} -> {out_path}")
        run_source(source, args, out_path, mapper)


if __name__ == "__main__":
    main()
