#!/usr/bin/env python3
"""Post every question in the bank to Slack #questions via Incoming Webhook.

No bot token needed — just a webhook URL.

Setup:
  export SLACK_QUESTIONS_WEBHOOK=https://hooks.slack.com/services/T.../B.../xxx

Usage:
  cd ml && python scripts/send_questions_to_slack.py
  python scripts/send_questions_to_slack.py --dry-run --limit 5
  python scripts/send_questions_to_slack.py --source eedi --concept linear_equations
  python scripts/send_questions_to_slack.py --level 1 --concept quadratic_equations
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

JSON_BANKS = [
    REPO / "app/src/data/actMasterQuestionBank.generated.json",
    REPO / "app/src/data/eediQuestions.json",
    REPO / "app/src/data/generatedQuestions.json",
]


def parse_inline_ts_bank() -> list[dict]:
    src = (REPO / "app/src/lib/questionBank.ts").read_text()
    questions = []
    for m in re.finditer(
        r"\{\s*id:'([^']+)',\s*conceptId:'([^']+)',\s*level:([123]),([\s\S]*?)\}(?=,?\s*\{|,?\s*\])",
        src,
    ):
        block = m.group(0)
        q_m   = re.search(r"question:'((?:[^'\\]|\\.)*)'", block)
        ci_m  = re.search(r"correctIndex:(\d)", block)
        exp_m = re.search(r"explanation:'((?:[^'\\]|\\.)*)'", block)
        if not q_m:
            continue
        questions.append({
            "id": m.group(1),
            "conceptId": m.group(2),
            "level": int(m.group(3)),
            "source": "inline_ts",
            "question": q_m.group(1),
            "correctIndex": int(ci_m.group(1)) if ci_m else 0,
            "explanation": exp_m.group(1) if exp_m else "",
        })
    return questions


def load_json_bank(path: Path) -> list[dict]:
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    source = path.stem
    for q in data:
        q.setdefault("source", source)
    return data


def format_message(q: dict) -> str:
    cid    = q.get("conceptId") or q.get("concept_id", "?")
    level  = q.get("level", "?")
    qid    = q.get("id", "?")
    source = q.get("source", "?")
    exam   = q.get("examTag", "")

    lines = [
        f"*{qid}* · `{cid}` · L{level} · {source}{' · ' + exam if exam else ''}",
        "",
        q.get("question", ""),
    ]

    options     = q.get("options") or q.get("choices") or []
    correct_idx = q.get("correctIndex", q.get("correct_index", 0))
    if options:
        for i, opt in enumerate(options):
            prefix = "✅" if i == correct_idx else "○"
            lines.append(f"  {prefix} {chr(65 + i)}. {opt}")

    exp = q.get("explanation") or q.get("solution") or ""
    if exp:
        lines += ["", f"_Explanation:_ {exp[:280]}{'…' if len(exp) > 280 else ''}"]

    misc = q.get("misconception_label")
    if misc:
        lines += ["", f"⚠️ _Common trap:_ {misc}"]

    return "\n".join(lines)


def webhook_post(webhook_url: str, text: str) -> None:
    payload = json.dumps({"text": text}).encode()
    for attempt in range(5):
        req = urllib.request.Request(
            webhook_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            urllib.request.urlopen(req, timeout=15).read()
            return
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 2 ** attempt * 3
                print(f"\n  [rate limited, waiting {wait}s]", end=" ", flush=True)
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("Slack webhook: too many 429s")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Max questions (0 = all)")
    parser.add_argument("--offset", type=int, default=0, help="Skip first N questions (resume)")
    parser.add_argument("--source", help="Filter by source name")
    parser.add_argument("--concept", help="Filter by conceptId")
    parser.add_argument("--level", type=int, choices=[1, 2, 3])
    args = parser.parse_args()

    webhook_url = os.environ.get("SLACK_QUESTIONS_WEBHOOK")
    if not webhook_url and not args.dry_run:
        print("ERROR: set SLACK_QUESTIONS_WEBHOOK", file=sys.stderr)
        sys.exit(1)

    all_questions: list[dict] = parse_inline_ts_bank()
    for path in JSON_BANKS:
        all_questions += load_json_bank(path)

    if args.source:
        all_questions = [q for q in all_questions if args.source in (q.get("source") or "")]
    if args.concept:
        all_questions = [q for q in all_questions
                         if (q.get("conceptId") or q.get("concept_id")) == args.concept]
    if args.level:
        all_questions = [q for q in all_questions if int(q.get("level", 0)) == args.level]
    if args.offset:
        all_questions = all_questions[args.offset:]
    if args.limit:
        all_questions = all_questions[:args.limit]

    print(f"{'[DRY RUN] ' if args.dry_run else ''}Sending {len(all_questions)} questions{f' (skipped first {args.offset})' if args.offset else ''}...")

    for i, q in enumerate(all_questions):
        msg = format_message(q)
        if args.dry_run:
            print(f"\n{'─' * 56}")
            print(msg)
        else:
            webhook_post(webhook_url, msg)
            time.sleep(1.1)    # stay well under Slack's 1 msg/s webhook limit

        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(all_questions)}...")

    print(f"\nDone. {len(all_questions)} questions {'printed' if args.dry_run else 'sent'}.")


if __name__ == "__main__":
    main()
