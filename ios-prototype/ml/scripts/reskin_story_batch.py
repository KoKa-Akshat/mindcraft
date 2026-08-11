#!/usr/bin/env python3
"""
Batch re-wrap bank questions whose storyContext or stem still reads textbook.

Targets (Tier 2 in agent_work/product/STORY_DISPLAY_PLAN.md):
  - OpenStax NWSL / "For the following exercises" table blobs
  - Eedi frames where protagonist setting mismatches stem (hexagon on triangles_congruence)

Usage:
  cd ml && source mindcraft/bin/activate
  LLM_PROVIDER=groq python scripts/reskin_story_batch.py --dry-run --limit 20
  LLM_PROVIDER=groq python scripts/reskin_story_batch.py --bank openstax --write

Requires GROQ_API_KEY in ml/.env.local.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "ml" / "scripts" / "pipeline"))

# Load ml/.env.local before StoryWrapper reads env vars.
_env = REPO / "ml" / ".env.local"
if _env.exists():
    try:
        from dotenv import dotenv_values  # type: ignore
        import os
        for k, v in dotenv_values(_env).items():
            if v is not None and str(v).strip():
                os.environ[k] = str(v).strip()
    except ImportError:
        pass

from story_wrapper import StoryWrapper  # noqa: E402

OPENSTAX_PATH = REPO / "app" / "src" / "data" / "openstaxMCQ.json"
EEDI_PATH = REPO / "app" / "src" / "data" / "eediQuestions.json"

NWSL_RE = re.compile(r"nwsl|National Women|For the following exercises,\s*use the table", re.I)
POLYGON_RE = re.compile(r"regular\s+(hexagon|pentagon|octagon)", re.I)


def needs_reskin(q: dict) -> bool:
    stem = q.get("question", "")
    if NWSL_RE.search(stem):
        return True
    if POLYGON_RE.search(stem) and q.get("conceptId") == "triangles_congruence":
        ctx = q.get("storyContext", "")
        if "triangle" in ctx.lower() and "hexagon" not in ctx.lower():
            return True
    return False


def load_bank(name: str) -> list[dict]:
    path = OPENSTAX_PATH if name == "openstax" else EEDI_PATH
    data = json.loads(path.read_text())
    return data if isinstance(data, list) else data.get("questions", data)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bank", choices=["openstax", "eedi", "all"], default="all")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    banks = ["openstax", "eedi"] if args.bank == "all" else [args.bank]
    wrapper = StoryWrapper()
    total = 0

    for bank in banks:
        questions = load_bank(bank)
        path = OPENSTAX_PATH if bank == "openstax" else EEDI_PATH
        hits = [q for q in questions if needs_reskin(q)]
        if args.limit:
            hits = hits[: args.limit]

        print(f"{bank}: {len(hits)} questions to re-wrap")
        for q in hits:
            total += 1
            out = wrapper.wrap(
                stem=q["question"],
                concept_id=q["conceptId"],
                answer=q["choices"][q["correctIndex"]] if q.get("choices") else "",
                steps=q.get("explanation", ""),
            )
            if args.dry_run:
                print(f"  {q['id']}: {out.get('storyContext', '')[:80]}…")
                continue
            if args.write:
                q["storyContext"] = out.get("storyContext", q.get("storyContext", ""))
                if out.get("explanation"):
                    q["explanation"] = out["explanation"]
                if out.get("hints"):
                    q["hints"] = out["hints"]

        if args.write and not args.dry_run:
            path.write_text(json.dumps(questions, indent=2, ensure_ascii=False) + "\n")
            print(f"  wrote {path}")

    print(f"done — processed {total}")


if __name__ == "__main__":
    main()
