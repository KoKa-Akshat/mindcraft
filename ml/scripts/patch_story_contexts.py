#!/usr/bin/env python3
"""
Deterministic storyContext fixes — no LLM required.

Patches known mismatches (hexagon stem + triangle scene, NWSL table intros).
Safe to re-run; only overwrites when the fix differs from current value.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EEDI = REPO / "app" / "src" / "data" / "eediQuestions.json"
OPENSTAX = REPO / "app" / "src" / "data" / "openstaxMCQ.json"

POLYGON_SCENE = {
    "triangles_congruence": "Euclid traces the shape in the sand at Alexandria. Equal sides, equal corners, every angle waiting to be named.",
    "lines_angles": "The surveyor lays out the regular figure on the field map before the crew sets the corners.",
    "area_volume": "The mason's template shows the regular polygon. Each side matched, each corner identical.",
}

NWSL_SCENE = (
    "Florence spreads ten ward ledgers across her table at Scutari, "
    "each row a week's patient tally. She must read the shape of the numbers before trusting the chart."
)


def polygon_scene(concept_id: str, sides: int) -> str:
    base = POLYGON_SCENE.get(concept_id, "The scholar sketches a regular polygon. Every side equal, every corner matching.")
    return base.replace("the shape", f"a regular {sides}-gon").replace("the regular figure", f"a regular {sides}-gon")


def patch_question(q: dict) -> bool:
    stem = q.get("question", "")
    cid = q.get("conceptId", "")
    changed = False

    m = re.search(r"regular\s+(hexagon|pentagon|octagon|heptagon|nonagon|decagon)", stem, re.I)
    if m:
        sides = {"pentagon": 5, "hexagon": 6, "heptagon": 7, "octagon": 8, "nonagon": 9, "decagon": 10}[m.group(1).lower()]
        new_ctx = polygon_scene(cid, sides)
        if q.get("storyContext") != new_ctx:
            q["storyContext"] = new_ctx
            changed = True

    if re.search(r"nwsl|National Women|use the table", stem, re.I) and cid == "descriptive_statistics":
        if q.get("storyContext") != NWSL_SCENE:
            q["storyContext"] = NWSL_SCENE
            changed = True

    return changed


def patch_bank(path: Path) -> int:
    data = json.loads(path.read_text())
    questions = data if isinstance(data, list) else data.get("questions", data)
    n = 0
    for q in questions:
        if patch_question(q):
            n += 1
    path.write_text(json.dumps(questions, indent=2, ensure_ascii=False) + "\n")
    return n


def main() -> None:
    eedi_n = patch_bank(EEDI)
    openstax_n = patch_bank(OPENSTAX)
    print(f"Patched {eedi_n} eedi + {openstax_n} openstax storyContext fields")


if __name__ == "__main__":
    main()
