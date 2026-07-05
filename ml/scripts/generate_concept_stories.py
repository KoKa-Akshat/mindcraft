#!/usr/bin/env python3
"""Generate Katha narrative stories for each concept and ingredient using Groq (free).

Stories are posted to Slack via Incoming Webhooks (no bot token needed),
then saved to app/src/data/conceptStories.json for the Practice UI.

Setup:
  export GROQ_API_KEY=gsk_...
  export SLACK_STORIES_WEBHOOK=https://hooks.slack.com/services/T.../B.../xxx
  export SLACK_QUESTIONS_WEBHOOK=https://hooks.slack.com/services/T.../B.../yyy  (optional)

Usage:
  cd ml && python scripts/generate_concept_stories.py
  python scripts/generate_concept_stories.py --dry-run          # print without Slack
  python scripts/generate_concept_stories.py --concepts-only    # skip ingredients
  python scripts/generate_concept_stories.py --concept-id linear_equations
  python scripts/generate_concept_stories.py --limit 5          # first N concepts only
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ONTOLOGY_PATH = REPO / "ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
OUTPUT_PATH   = REPO / "app/src/data/conceptStories.json"
CACHE_PATH    = REPO / "ml/data/.story_cache.json"

MODEL = "llama-3.3-70b-versatile"  # Groq free tier, ~2k tokens/min generous limit


# ── Prompts ───────────────────────────────────────────────────────────────────

CONCEPT_STORY_PROMPT = """\
You are writing for a 13–17 year old student who just got a math problem wrong. They are
frustrated. They need to understand WHY this topic was invented, not just how to do it.

Write a story (180–220 words) about the concept: {concept_name}

Rules:
1. Open with a surprising real-world moment that makes this math feel necessary — not abstract.
   Think: a ship navigator, an architect, a detective, a musician, a game designer.
2. Show the actual PROBLEM humans were trying to solve when they invented this math.
3. Build intuition through the story — no formulas. The reader should feel the concept before they name it.
4. End with one bridge sentence connecting the story back to the student's actual math work.

Tone: warm, curious, a little awe-struck. Like a great teacher telling a story at lunch.
NOT like a textbook. NOT like an AI. Real sentences. No bullet points. No em dashes.
No "In conclusion" or "In summary." Write like someone who genuinely loves this stuff.
No bold or headers. Just flowing prose.

Concept: {concept_name}
What it covers: {description}
Level: {level}

Write the story now:"""

INGREDIENT_STORY_PROMPT = """\
Write a tiny story (100–130 words) for a student who just failed to apply a specific skill.

Concept: {concept_name}
Skill they're missing: {ingredient_label}
What goes wrong when they get it wrong: {failure_mode}

The story must:
1. Show a real moment where someone needed EXACTLY this skill — a cook, a carpenter, a coder.
2. Make vivid what breaks when you skip this step (the failure mode).
3. End with one sentence that makes the skill feel obvious, not scary.

Same tone: warm, human, no em dashes, no bullet points, no AI voice. Pure prose.

Write the story now:"""


# ── Groq client ───────────────────────────────────────────────────────────────

def generate_story(prompt: str, api_key: str) -> str:
    from groq import Groq
    client = Groq(api_key=api_key)
    resp = client.chat.completions.create(
        model=MODEL,
        max_tokens=512,
        temperature=0.85,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content.strip()


# ── Slack webhook ─────────────────────────────────────────────────────────────

def slack_webhook_post(webhook_url: str, text: str) -> None:
    import urllib.request, urllib.error
    payload = json.dumps({"text": text}).encode()
    req = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            r.read()
    except urllib.error.HTTPError as e:
        print(f"  Slack webhook error {e.code}: {e.read().decode()[:200]}", file=sys.stderr)


# ── Cache ─────────────────────────────────────────────────────────────────────

def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text())
    return {}


def save_cache(cache: dict) -> None:
    CACHE_PATH.write_text(json.dumps(cache, indent=2))


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print stories, don't post to Slack")
    parser.add_argument("--concepts-only", action="store_true", help="Skip ingredient stories")
    parser.add_argument("--concept-id", help="Only generate for this concept slug")
    parser.add_argument("--limit", type=int, default=0, help="Max concepts to process (0 = all)")
    parser.add_argument("--no-cache", action="store_true", help="Re-generate even if cached")
    args = parser.parse_args()

    api_key     = os.environ.get("GROQ_API_KEY")
    webhook_url = os.environ.get("SLACK_STORIES_WEBHOOK")

    if not api_key:
        print("ERROR: set GROQ_API_KEY  (get one free at console.groq.com)", file=sys.stderr)
        sys.exit(1)
    if not webhook_url and not args.dry_run:
        print("ERROR: set SLACK_STORIES_WEBHOOK (Incoming Webhook URL from api.slack.com/apps)", file=sys.stderr)
        sys.exit(1)

    ontology = json.loads(ONTOLOGY_PATH.read_text())
    cache    = {} if args.no_cache else load_cache()
    stories: dict = {}

    # Load existing output so we preserve already-generated stories
    if OUTPUT_PATH.exists():
        try:
            stories = json.loads(OUTPUT_PATH.read_text())
        except Exception:
            stories = {}

    concepts = ontology.get("concepts", [])
    if args.concept_id:
        concepts = [c for c in concepts if c["id"] == args.concept_id]
    if args.limit:
        concepts = concepts[:args.limit]

    print(f"Generating stories for {len(concepts)} concepts using {MODEL} via Groq...")

    for concept in concepts:
        cid   = concept["id"]
        cname = concept.get("name", cid)
        clevel= concept.get("level", "core")
        cdesc = concept.get("description", "")

        # ── Concept story ────────────────────────────────────────────────────
        cache_key = f"concept::{cid}"
        if cache_key in cache and not args.no_cache:
            story_text = cache[cache_key]
            print(f"  [cached] {cname}")
        else:
            print(f"  {cname} ({clevel})...", end=" ", flush=True)
            prompt = CONCEPT_STORY_PROMPT.format(
                concept_name=cname,
                description=cdesc or cname,
                level=clevel,
            )
            try:
                story_text = generate_story(prompt, api_key)
                cache[cache_key] = story_text
                save_cache(cache)
                print("ok")
                time.sleep(0.6)   # Groq rate limit: generous but be polite
            except Exception as e:
                print(f"ERROR: {e}", file=sys.stderr)
                continue

        stories[cid] = {
            "conceptId":       cid,
            "conceptName":     cname,
            "story":           story_text,
            "ingredientStories": stories.get(cid, {}).get("ingredientStories", {}),
        }

        # Post concept story to Slack #stories
        slack_msg = (
            f"*{cname}* (`{cid}` · {clevel})\n\n"
            f"{story_text}\n\n"
            f"_Reply in thread to suggest edits. ✏️_"
        )
        if args.dry_run:
            print(f"\n{'─'*60}")
            print(slack_msg)
        elif webhook_url:
            slack_webhook_post(webhook_url, slack_msg)
            time.sleep(0.5)

        if args.concepts_only:
            continue

        # ── Ingredient stories ───────────────────────────────────────────────
        for ing in concept.get("ingredients", []):
            iid     = ing.get("id") or ing.get("ingredient_id", "")
            ilabel  = ing.get("label", iid)
            ifailure= ing.get("failure_mode", "")
            if not iid:
                continue

            ing_cache_key = f"ingredient::{iid}"
            if ing_cache_key in cache and not args.no_cache:
                ing_story = cache[ing_cache_key]
            else:
                print(f"    {ilabel}...", end=" ", flush=True)
                ing_prompt = INGREDIENT_STORY_PROMPT.format(
                    concept_name=cname,
                    ingredient_label=ilabel,
                    failure_mode=ifailure or "applying this skill incorrectly",
                )
                try:
                    ing_story = generate_story(ing_prompt, api_key)
                    cache[ing_cache_key] = ing_story
                    save_cache(cache)
                    print("ok")
                    time.sleep(0.5)
                except Exception as e:
                    print(f"ERROR: {e}", file=sys.stderr)
                    continue

            stories[cid]["ingredientStories"][iid] = ing_story

            if not args.dry_run and webhook_url:
                slack_webhook_post(
                    webhook_url,
                    f"  ↳ *{ilabel}* (in {cname})\n{ing_story}",
                )
                time.sleep(0.4)

        # Save after each concept so partial runs aren't lost
        OUTPUT_PATH.write_text(json.dumps(stories, indent=2) + "\n")

    OUTPUT_PATH.write_text(json.dumps(stories, indent=2) + "\n")
    print(f"\n{len(stories)} concept stories → {OUTPUT_PATH.relative_to(REPO)}")
    if not args.dry_run and webhook_url:
        print(f"Posted to Slack #stories via webhook")


if __name__ == "__main__":
    main()
