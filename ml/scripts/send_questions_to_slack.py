#!/usr/bin/env python3
"""Post every question in the bank to Slack #questions (one message per question).

Reads all 4 bank sources:
  - app/src/lib/questionBank.ts (inline static questions, 227)
  - app/src/data/actMasterQuestionBank.generated.json (206)
  - app/src/data/eediQuestions.json (1,283)
  - app/src/data/generatedQuestions.json (stubs)

Usage:
  export SLACK_BOT_TOKEN=xoxb-...
  cd ml && python scripts/send_questions_to_slack.py
  python scripts/send_questions_to_slack.py --dry-run --limit 5
  python scripts/send_questions_to_slack.py --source eedi --concept linear_equations
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SLACK_QUESTIONS_CHANNEL = "questions"

JSON_BANKS = [
    REPO / "app/src/data/actMasterQuestionBank.generated.json",
    REPO / "app/src/data/eediQuestions.json",
    REPO / "app/src/data/generatedQuestions.json",
]


def parse_inline_ts_bank() -> list[dict]:
    """Extract inline questions from questionBank.ts via regex."""
    src = (REPO / "app/src/lib/questionBank.ts").read_text()
    questions = []
    for m in re.finditer(
        r"\{\s*id:'([^']+)',\s*conceptId:'([^']+)',\s*level:([123]),([\s\S]*?)\}(?=,?\s*\{|,?\s*\])",
        src,
    ):
        block = m.group(0)
        q_match = re.search(r"question:'((?:[^'\\]|\\.)*)'", block)
        opts_match = re.findall(r"'((?:[^'\\]|\\.)*)'", block)
        correct_match = re.search(r"correctIndex:(\d)", block)
        exp_match = re.search(r"explanation:'((?:[^'\\]|\\.)*)'", block)
        if not q_match:
            continue
        questions.append({
            "id": m.group(1),
            "conceptId": m.group(2),
            "level": int(m.group(3)),
            "source": "inline_ts",
            "question": q_match.group(1),
            "correctIndex": int(correct_match.group(1)) if correct_match else 0,
            "explanation": exp_match.group(1) if exp_match else "",
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


def format_slack_message(q: dict) -> str:
    cid = q.get("conceptId") or q.get("concept_id", "?")
    level = q.get("level", "?")
    qid = q.get("id", "?")
    source = q.get("source", "?")
    exam = q.get("examTag", "")

    lines = [
        f"*Q {qid}* · `{cid}` · Level {level} · {source}{' · ' + exam if exam else ''}",
        "",
        q.get("question", ""),
    ]

    options = q.get("options") or q.get("choices") or []
    correct_idx = q.get("correctIndex", q.get("correct_index", 0))
    if options:
        for i, opt in enumerate(options):
            prefix = "✅" if i == correct_idx else "○"
            lines.append(f"  {prefix} {chr(65+i)}. {opt}")

    exp = q.get("explanation") or q.get("solution") or ""
    if exp:
        lines += ["", f"_Explanation:_ {exp[:300]}{'...' if len(exp) > 300 else ''}"]

    misc = q.get("misconception_label")
    if misc:
        lines += ["", f"⚠️ _Common trap:_ {misc}"]

    return "\n".join(lines)


def slack_post(token: str, channel: str, text: str) -> None:
    import urllib.request
    payload = json.dumps({"channel": channel, "text": text}).encode()
    req = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
    if not resp.get("ok"):
        print(f"  Slack error: {resp.get('error')}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Max questions (0 = all)")
    parser.add_argument("--source", help="Filter by source name (e.g. eedi, actMaster)")
    parser.add_argument("--concept", help="Filter by conceptId")
    parser.add_argument("--level", type=int, choices=[1, 2, 3], help="Filter by level")
    args = parser.parse_args()

    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token and not args.dry_run:
        print("ERROR: set SLACK_BOT_TOKEN (or use --dry-run)", file=sys.stderr)
        sys.exit(1)

    # Load all banks
    all_questions: list[dict] = []
    all_questions += parse_inline_ts_bank()
    for path in JSON_BANKS:
        all_questions += load_json_bank(path)

    # Filter
    if args.source:
        all_questions = [q for q in all_questions if args.source in (q.get("source") or "")]
    if args.concept:
        all_questions = [q for q in all_questions
                         if (q.get("conceptId") or q.get("concept_id")) == args.concept]
    if args.level:
        all_questions = [q for q in all_questions if int(q.get("level", 0)) == args.level]
    if args.limit:
        all_questions = all_questions[:args.limit]

    print(f"Sending {len(all_questions)} questions to Slack #{SLACK_QUESTIONS_CHANNEL}")

    for i, q in enumerate(all_questions):
        msg = format_slack_message(q)
        if args.dry_run:
            print(f"\n{'─'*60}")
            print(msg)
        else:
            slack_post(token, SLACK_QUESTIONS_CHANNEL, msg)
            time.sleep(0.3)  # Slack rate limit: ~3 req/s

        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(all_questions)} sent...")

    print(f"\nDone. {len(all_questions)} questions {'printed' if args.dry_run else 'sent to Slack'}.")


if __name__ == "__main__":
    main()
