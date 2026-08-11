# Story Cell Narrative Rules — Compression & Dual Presentation
> Author: Fable 5 (manual curation lane), 2026-07-08.
> Audience: Cursor (implements enforcement in `story_cell_studio.py` + merge script),
> all generation agents, Akshat (narrative review), Blake (math review).
> Extends `STORY_INTELLIGENCE_SPEC_V2.md` §1 — gates unchanged; this file governs
> the NARRATIVE LAYER of every cell. Math spine rules are untouched and frozen.

**Why this file exists:** parents and ND students are bouncing off two failure
modes: **cognitive overload** (a paragraph of backstory before any math) and
**forced narrative** (a scene, then an unrelated textbook ask). Every rule below
is a fix for one of those two.

The one-line law: **the story buys attention; the math spends it.** A story
sentence that doesn't raise the stake of the math move is over budget.

---

## 1. Field length budgets (STRICT — validator-enforced)

| Field | Max chars | Rule |
|-------|-----------|------|
| `storyContext` | **≤ 120** | One breath. Protagonist + stake. No backstory paragraph, no scene-setting chain. |
| `narrative_need` | **≤ 100** | What must happen in the scene — verb-first ("William must name the price…"). |
| `student_action` | **≤ 80** | The cognitive demand, one sentence, math verbs allowed here. |
| `world_feedback` | **≤ 200** | **String only** — never a `{correct, incorrect}` object. Celebrate the effort + land ONE math insight. |
| `question` | No cap, but **must contain the math task** — table/graph/data inline if needed. Story does NOT live in `question`; it lives in `storyContext`. |
| `title` | ≤ 8 words | |
| `presentation.minimal.storyContext` | **≤ 60** | See §3. |

Enforcement: `story_cell_studio.py` should reject (revise-loop, not silently
truncate) any generated cell over budget. `merge_story_cells_for_app.py` should
refuse to ship a cell whose `world_feedback` is not a string.

**Calibration anchors (from the live pilot):**
- **Anti-pattern — slot-1 "The Steady Drift"**: `storyContext` ~600 chars — a
  full scene with dialogue, two characters, a moral, AND the data, before the
  student sees a single choice. The data then repeats inside `question`. This
  is the overload shape. (Compressed reskin: see
  `batch_ingredient_fable5_reskin.json`.)
- **Target — slot-2 "The Joining Fee"**: `storyContext` ~150 chars, slots 3–4
  cells 103–112 chars. Protagonist + stake, done: *"A Kingston carter quotes
  William two prices: 8 pence for one mile, 11 for two. The docks lie six
  miles out."*
- Legacy cells over budget are **grandfathered until reskinned** — the budgets
  gate new generation and reskins, they do not retroactively unship slot-1.

---

## 2. "Math-first, story-second" integration rule

**The cover test (mandatory, run per cell):** cover `storyContext` completely.
The `question` stem + `choices` must still make sense and be fully answerable.
If covering the story removes information needed to compute, the cell FAILS —
move that information into `question`.

- **Bad:** a long story preamble inside `question`, then a disconnected
  textbook ask ("…and so, solve for x").
- **Good:** `storyContext` = "William needs the joining fee from the ledger."
  `question` = the table + the explicit ask.

**Forbidden in `storyContext`:** worksheet verbs — "solve for x", "find the
slope", "calculate", "simplify", "evaluate". If the story needs a verb for the
math, use the world's verb (name the price, fill the chart line, stack the
sacks, check the slate).

**Required division of labor:**
- `narrative_need` names the **story stake** (what the world loses/gains).
- `student_action` names the **math move** (worksheet verbs live HERE).
- These two fields must not be paraphrases of each other; if they are
  interchangeable, the story is decorative and the cell should be rewritten or
  demoted to minimal-only.

**Data lives once.** If the numbers appear in `storyContext`, they may be
*recalled* in `question` ("the two quoted prices") only when the question
re-states them in full — never make the student scroll back up to retrieve a
number from prose. Preferred shape: numbers in a markdown table inside
`question`; `storyContext` refers to them generically.

---

## 3. Dual presentation modes (spec for Cursor — do NOT build UI yet)

Every cell carries a new optional field:

```json
"presentation": {
  "default": "story",
  "minimal": {
    "storyContext": "Storage rate table — find the fee at week 0.",
    "world_feedback": "£20 is the starting fee before any weeks. Slope was £9/week."
  }
}
```

Rules for `minimal`:
- `minimal.storyContext` **≤ 60 chars**, plain language, **no character
  names**, no world nouns that require context (no "chandlery", no
  "sanctuary" — "table", "chart", "equation" are fine).
- `minimal.world_feedback` states the answer + the one-line why. No praise
  theater, no dialogue.
- The math spine (`question`, `choices`, `correctIndex`, `hints`,
  `distractor_taxonomy`) is SHARED between modes — minimal swaps only the two
  narrative fields, exactly like the voice overlays in Spec V2 §4. Note the
  `question` stem may retain world nouns (sacks, herring); minimal mode
  removes the narrative *chrome*, it does not launder the stem. Cells written
  under the §2 cover test are already answerable this way.
- **`minimal` is REQUIRED on every new cell** from this file's date forward.
  This is the ND / low-chrome path: same diagnosis, near-zero narrative load.
- Mode selection (student preference toggle, per-student default) is a future
  Product-lane build. Until then `minimal` ships as data, unused.

---

## 4. Cognitive load scoring — raise the bar

When self-scoring (or critic-scoring) `cognitive_load`:

- **Penalize** if `storyContext` + `question` combined exceed **120 words**.
- **Penalize** if the student must read the story to know *what to compute*
  (cover-test failure = automatic ≤ 5 on this dimension).
- **Penalize** each additional named character beyond one per cell.
- **Reward** if the table/diagram/data sits inside `question` and the story is
  one line of stakes (this is the 9–10 shape).

**Target: new cells score `cognitive_load` ≥ 8.** For calibration: slot-1
"Steady Drift" would score ~5 under this rubric (600-char scene, data buried
in prose, moral delivered before the question); the slot-3/4 cells score 8–9
(one-line stake, data in a table, one named character).

A cell that cannot reach 8 without gutting its diagnostic design may still
ship through Gate B (Spec V2 §1.1) — but only with `cognitive_load` ≥ 6 and a
`minimal` presentation present, so the low-chrome path exists for the students
the chrome is costing.

---

## 5. Representation consistency

- `world_feedback`: **always a string** (slot-1 Waterfowl's
  `{correct, incorrect}` object is the known violation — fixed in its reskin;
  merge script must reject new objects).
- `format`: `multiple_choice` for all pilot cells (slot-1 Waterfowl's
  `scenario_decision` is grandfathered; do not mint new format values without
  a spec change).
- Tables: markdown tables belong in `question`, never in `storyContext`.
- `examTag`: `ACT_*` when ACT-aligned; `GCSE` only when the cell is
  Eedi-linked; `null` when neither claim is honest.
- Characters: reuse the pilot protagonists (William / market_world, Simon /
  creature_sanctuary). New named characters require an Akshat sign-off — every
  new name is working memory spent off-math.
- Feedback tone: `world_feedback` celebrates the *move* ("split the price into
  rate and fee"), never the student's identity ("you're so smart") and never
  by shaming a character who erred. §1.2.3 tone-flag substrings apply to every
  narrative field including `minimal.*`.

---

## 6. What changed vs slot-1 practice (summary for reviewers)

1. Story compressed from scene-with-dialogue (~600 chars) to protagonist +
   stake (≤ 120 chars); the moral moved out of the preamble and into
   `world_feedback` / `explanation`, after the student has worked.
2. The math task is now guaranteed self-contained in `question` (cover test),
   so a student who skips the story loses nothing but flavor.
3. Every cell ships a `presentation.minimal` low-chrome variant for ND
   students — same spine, no cast.
4. `world_feedback` standardized to a single string with one math insight;
   branching correct/incorrect prose is the renderer's job, not the data's.
5. `cognitive_load` scoring now penalizes exactly the overload patterns
   parents reported, so the gate catches them before review does.
