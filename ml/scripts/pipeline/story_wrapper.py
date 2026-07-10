#!/usr/bin/env python3
"""
Story wrapper — generates the `storyContext` field for bank questions.

Every question that enters the bank gets a 1-2 sentence narrative wrapper
tying it into its concept's story world (WORLD_VISION.md — the questions are
the puzzles that advance the story; the scratchpad becomes a Jarvis that can
say "here's where the bearing drifted"). The UI renders `storyContext` as the
scene-setter above the stem: the protagonist's framing of the very problem
the student is about to solve.

Inputs (read-only):
    app/src/data/questionContextFrames.json — 47 frames:
        {conceptId: {protagonist, settingLine, questionBridge, ...}}
    app/src/data/conceptStories.json — 41 story worlds (setting texture)

One LLM call per (concept, stem) also yields the protagonist-VOICED
explanation and hints, so the MCQ pipeline needs no separate annotation call.

Cache: ml/data/.story_context_cache.json keyed by sha1(conceptId||stem).
Fallback (no LLM / bad output): `frame.questionBridge` verbatim — always
intentional-sounding, never an error string.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base import LLMClient, ML_DATA, REPO  # noqa: E402
from mcq_generator import parse_llm_json as _parse_llm_json  # noqa: E402
from mcq_generator import repair_ctrl_chars  # noqa: E402

FRAMES_PATH = REPO / "app" / "src" / "data" / "questionContextFrames.json"
STORIES_PATH = REPO / "app" / "src" / "data" / "conceptStories.json"
STORY_CONTEXT_CACHE_PATH = ML_DATA / ".story_context_cache.json"

MAX_CONTEXT_CHARS = 320  # 1-2 sentences; anything longer is a paragraph


class StoryWrapper:
    """(question_stem, conceptId) -> storyContext + voiced explanation/hints."""

    PROMPT = """\
You write scene-setting narration for a math learning world.

Concept story world:
- Protagonist: {protagonist}
- Setting: {setting}
- World flavor: {flavor}

The student is about to solve this problem:
{stem}

The correct answer is {answer} (steps: {steps}).

Write JSON with three fields:

1. "storyContext": 1-2 sentences (under 220 characters) that put the
   protagonist in the scene NEEDING this exact problem solved. Present tense.
   Reads like a novel, not a worksheet. Must NOT hint at the answer, the
   method, or any numbers not already in the problem. Must NOT address the
   student directly with instructions like "solve" or "calculate".

2. "explanation": 2-4 sentences walking through WHY the answer is {answer},
   written in {protagonist}'s voice as if they are working it out beside the
   student — concrete steps, no textbook tone, no "to solve this equation".
   End by naming the answer.

3. "hints": 3 escalating hints in {protagonist}'s voice —
   first a strategy nudge, then the first concrete step, then the full setup
   stopping just short of the answer. None of them may state the answer.

Use plain math notation everywhere (12^21, 3/4, -5) — no LaTeX commands,
no backslashes, no dollar signs.

Voice: warm, direct, genuinely excited to help a student who has struggled
with math before. Never stilted or corporate-sounding. NEVER use an em dash
(—) anywhere in any field; use a period, colon, or comma instead.

Reply with ONLY the JSON object."""

    def __init__(self, client: LLMClient | None = None,
                 use_llm: bool = True) -> None:
        self.client = client or LLMClient()
        self.use_llm = use_llm
        self.frames: dict = self._load(FRAMES_PATH)
        self.stories: dict = self._load(STORIES_PATH)
        self.cache: dict[str, dict] = {}
        if STORY_CONTEXT_CACHE_PATH.exists():
            try:
                self.cache = json.loads(STORY_CONTEXT_CACHE_PATH.read_text())
            except json.JSONDecodeError:
                self.cache = {}
        self._dirty = 0
        self.stats = {"llm": 0, "cache_hits": 0, "fallbacks": 0}

    @staticmethod
    def _load(path: Path) -> dict:
        if path.exists():
            try:
                return json.loads(path.read_text())
            except json.JSONDecodeError:
                pass
        return {}

    # -- frames -----------------------------------------------------------------

    def frame_for(self, concept_id: str) -> dict | None:
        return self.frames.get(concept_id)

    def fallback_context(self, concept_id: str) -> str:
        """questionBridge verbatim — the designed no-LLM scene-setter."""
        frame = self.frame_for(concept_id) or {}
        bridge = str(frame.get("questionBridge") or "").strip()
        if bridge:
            return bridge
        # No frame at all (rare): a neutral, intentional-sounding line.
        story = self.stories.get(concept_id) or {}
        name = story.get("conceptName") or concept_id.replace("_", " ")
        return (f"A new page of the field journal opens: {name}. "
                "The next entry is yours to work out.")

    # -- validation ----------------------------------------------------------------

    @staticmethod
    def _valid_context(text: str, answer: str | None) -> bool:
        if not text or len(text) > MAX_CONTEXT_CHARS:
            return False
        if "—" in text:
            return False  # em dash — voice rule, forces a regenerate/fallback
        if re.search(r'\b(solve|calculate|find the answer|choose the)\b',
                     text, re.I):
            return False  # worksheet voice
        if answer:
            ans = str(answer).strip().lower()
            if len(ans) >= 2 and ans in text.lower():
                return False  # leaked the answer
        return True

    # -- public -----------------------------------------------------------------

    def wrap(self, stem: str, concept_id: str, answer: str | None = None,
             steps: list[str] | None = None) -> dict:
        """Returns {"storyContext", "explanation", "hints", "used_llm"}.

        storyContext is ALWAYS non-empty (fallback = frame.questionBridge).
        explanation/hints may be empty when no LLM — caller applies templates.
        """
        frame = self.frame_for(concept_id) or {}
        protagonist = frame.get("protagonist") or "The guide"
        fallback = {
            "storyContext": self.fallback_context(concept_id),
            "explanation": "",
            "hints": [],
            "used_llm": False,
        }

        key = hashlib.sha1(f"{concept_id}||{stem}".encode()).hexdigest()
        if key in self.cache:
            self.stats["cache_hits"] += 1
            cached = dict(self.cache[key])
            cached["used_llm"] = True
            return cached

        if not (self.use_llm and self.client.available()):
            self.stats["fallbacks"] += 1
            return fallback

        story = (self.stories.get(concept_id) or {}).get("story", "")
        prompt = self.PROMPT.format(
            protagonist=protagonist,
            setting=frame.get("settingLine") or "an unnamed workshop",
            flavor=story[:400] or frame.get("questionBridge") or "",
            stem=stem[:900],
            answer=answer or "(not needed for the scene)",
            steps="; ".join((steps or [])[:6])[:500] or "(not shown)",
        )
        raw = self.client.complete(prompt, max_tokens=600, temperature=0.7)
        data = _parse_llm_json(raw or "")
        if not data:
            self.stats["fallbacks"] += 1
            return fallback

        context = repair_ctrl_chars(data.get("storyContext", "")).strip()
        explanation = repair_ctrl_chars(data.get("explanation", "")).strip()
        hints = [repair_ctrl_chars(h).strip() for h in (data.get("hints") or [])
                 if str(h).strip()][:3]
        if not self._valid_context(context, answer):
            context = fallback["storyContext"]
        # An explanation that never names the verified answer is suspect.
        if answer and normalize_in(explanation, answer) is False:
            explanation = ""
        # Voice rule: an em dash anywhere means this text is discarded, same
        # treatment as any other validation failure — caller's template
        # fallback fills the gap instead of shipping the violation.
        if "—" in explanation:
            explanation = ""
        hints = [h for h in hints if "—" not in h]

        result = {"storyContext": context, "explanation": explanation,
                  "hints": hints if len(hints) == 3 else []}
        # Only cache complete results — a discarded explanation should be
        # retried on the next run, not frozen as an empty string.
        if explanation and result["hints"]:
            self.cache[key] = result
            self._dirty += 1
            if self._dirty >= 20:
                self.save_cache()
        self.stats["llm"] += 1
        return {**result, "used_llm": True}

    def save_cache(self) -> None:
        if self._dirty:
            STORY_CONTEXT_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            STORY_CONTEXT_CACHE_PATH.write_text(
                json.dumps(self.cache, ensure_ascii=False))
            self._dirty = 0


_NOTATION_RE = re.compile(
    r'[\s${}(),×·*]|\\\(|\\\)|\\times\b|\\cdot\b|\\!|\\,')


def normalize_in(text: str, answer: str) -> bool:
    """Loose 'does the explanation name the answer' check.

    Notation-insensitive: '2^{14} \\times 19^{14}' in the answer matches
    '$2^{14} × 19^{14}$' or '2^14 · 19^14' in the explanation — whitespace,
    dollar/brace/paren wrappers, and multiplication signs are all stripped
    from both sides before the containment test.
    """
    if not text:
        return False
    ans = _NOTATION_RE.sub('', str(answer).strip().strip('.').lower())
    if not ans:
        return True
    return ans in _NOTATION_RE.sub('', text.lower())
