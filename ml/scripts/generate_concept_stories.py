#!/usr/bin/env python3
"""Generate Fable-5 narrative story contexts for each concept and ingredient.

Stories are sent to Slack (channel #stories) for human review and editing,
then saved locally to app/src/data/conceptStories.json for the Practice UI.

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  export SLACK_BOT_TOKEN=xoxb-...
  cd ml && python scripts/generate_concept_stories.py
  python scripts/generate_concept_stories.py --dry-run   # print without sending
  python scripts/generate_concept_stories.py --concepts-only  # skip ingredients
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
OUTPUT_PATH = REPO / "app/src/data/conceptStories.json"
CACHE_PATH = REPO / "ml/data/.story_cache.json"

SLACK_STORIES_CHANNEL = "stories"
MODEL = "claude-fable-5"


# ── Prompts ───────────────────────────────────────────────────────────────────

CONCEPT_STORY_PROMPT = """\
You are writing for a 13-17 year old student who just got a math problem wrong.
They are frustrated. They need to understand WHY this topic was invented, not just how to do it.

Write a short, human story (180-220 words) about the concept: {concept_name}

The story must:
1. Open with a surprising real-world moment that makes the concept feel necessary — not abstract
2. Show the PROBLEM that humans were trying to solve when they invented this math
3. Build intuition through the story, not through formulas
4. End with a bridge sentence connecting the story back to the student's actual math work

Tone: warm, curious, a little awe-struck. Like a great teacher telling you something at lunch.
NOT like a textbook. NOT like an AI. Real sentences. No bullet points.
No em dashes. Write like a human who loves this stuff.

Concept: {concept_name}
Description: {description}
Level: {level}
"""

INGREDIENT_STORY_PROMPT = """\
You are writing a tiny story (100-130 words) for a student who just failed to apply a specific skill.

Concept: {concept_name}
Skill: {ingredient_label}
What goes wrong: {failure_mode}

Write a story that:
1. Shows a real moment where someone needed EXACTLY this skill
2. Makes clear what breaks when you get it wrong (the failure mode)
3. Ends with one sentence that reframes the skill as obvious and intuitive

Same tone: warm, human, awe-struck. No em dashes. No bullet points. No AI voice.
"""


# ── Anthropic client ──────────────────────────────────────────────────────────

def generate_story(prompt: str, api_key: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model=MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


# ── Slack ─────────────────────────────────────────────────────────────────────

def slack_post(token: str, channel: str, text: str) -> None:
    import urllib.request, urllib.error
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
    parser.add_argument("--dry-run", action="store_true", help="Print stories, don't send to Slack")
    parser.add_argument("--concepts-only", action="store_true", help="Skip ingredient stories")
    parser.add_argument("--concept-id", help="Only generate for this concept")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    slack_token = os.environ.get("SLACK_BOT_TOKEN")

    if not api_key:
        print("ERROR: set ANTHROPIC_API_KEY", file=sys.stderr)
        sys.exit(1)
    if not slack_token and not args.dry_run:
        print("ERROR: set SLACK_BOT_TOKEN (or use --dry-run)", file=sys.stderr)
        sys.exit(1)

    ontology = json.loads(ONTOLOGY_PATH.read_text())
    cache = load_cache()
    stories: dict = {}

    concepts = ontology.get("concepts", [])
    if args.concept_id:
        concepts = [c for c in concepts if c["id"] == args.concept_id]

    for concept in concepts:
        cid = concept["id"]
        cname = concept.get("name", cid)
        clevel = concept.get("level", "core")
        cdesc = concept.get("description", "")

        # Concept-level story
        cache_key = f"concept::{cid}"
        if cache_key in cache:
            story_text = cache[cache_key]
            print(f"  [cached] {cname}")
        else:
            print(f"  Generating concept story: {cname} ...", end=" ", flush=True)
            prompt = CONCEPT_STORY_PROMPT.format(
                concept_name=cname,
                description=cdesc,
                level=clevel,
            )
            try:
                story_text = generate_story(prompt, api_key)
                cache[cache_key] = story_text
                save_cache(cache)
                print("ok")
                time.sleep(0.5)
            except Exception as e:
                print(f"ERROR: {e}", file=sys.stderr)
                continue

        stories[cid] = {"conceptId": cid, "conceptName": cname, "story": story_text, "ingredientStories": {}}

        # Send concept story to Slack
        slack_msg = (
            f"*Concept story: {cname}* (`{cid}`, {clevel})\n\n"
            f"{story_text}\n\n"
            f"_Edit and reply in thread to approve or suggest changes._"
        )
        if args.dry_run:
            print(f"\n{'='*60}")
            print(slack_msg)
        else:
            slack_post(slack_token, SLACK_STORIES_CHANNEL, slack_msg)
            time.sleep(0.4)

        if args.concepts_only:
            continue

        # Ingredient-level stories
        for ing in concept.get("ingredients", []):
            iid = ing.get("id") or ing.get("ingredient_id", "")
            ilabel = ing.get("label", iid)
            ifailure = ing.get("failure_mode", "")
            if not iid:
                continue

            ing_cache_key = f"ingredient::{iid}"
            if ing_cache_key in cache:
                ing_story = cache[ing_cache_key]
            else:
                print(f"    Ingredient: {ilabel} ...", end=" ", flush=True)
                ing_prompt = INGREDIENT_STORY_PROMPT.format(
                    concept_name=cname,
                    ingredient_label=ilabel,
                    failure_mode=ifailure or "Applying this skill incorrectly",
                )
                try:
                    ing_story = generate_story(ing_prompt, api_key)
                    cache[ing_cache_key] = ing_story
                    save_cache(cache)
                    print("ok")
                    time.sleep(0.4)
                except Exception as e:
                    print(f"ERROR: {e}", file=sys.stderr)
                    continue

            stories[cid]["ingredientStories"][iid] = ing_story

            if not args.dry_run:
                ing_slack_msg = (
                    f"*Ingredient story: {ilabel}* (in {cname})\n\n"
                    f"{ing_story}"
                )
                slack_post(slack_token, SLACK_STORIES_CHANNEL, ing_slack_msg)
                time.sleep(0.4)

    # Save output
    OUTPUT_PATH.write_text(json.dumps(stories, indent=2) + "\n")
    print(f"\nWrote {len(stories)} concept stories → {OUTPUT_PATH.relative_to(REPO)}")
    if not args.dry_run:
        print(f"Sent to Slack #{SLACK_STORIES_CHANNEL}")


if __name__ == "__main__":
    main()
