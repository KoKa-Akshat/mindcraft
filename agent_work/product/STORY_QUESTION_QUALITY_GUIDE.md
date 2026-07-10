# Story-Question Quality Guide

**Status:** Canonical content bar for every story-wrapped question in MindCraft.
**Applies to:** First Spark cells (`app/public/demo/v2/spark-bank.json`), the
Groq weave prompt (`webhook/api/spark-experience.ts`), and the Engine-lane
story pipelines (`ml/scripts/pipeline/story_generator.py`,
`ml/scripts/pipeline/story_wrapper.py`, `ml/scripts/generate_story_cells.py`,
`ml/scripts/reskin_story_batch.py`). Hold every generated or hand-written
story cell against this before it ships.
**Companions:** `WORLD_VISION.md` (why stories), `BRAND_BOOK.md` (voice),
`agent_work/product/FIRST_SPARK_FABLE5_BRIEF.md` (the Spark surface).

## The bar (owner's words)

> "Any story has a situation, task, action (the math, properly integrated into
> the story), and result. All our question-story designs should do that at the
> bare minimum."

Every story-wrapped question must carry all four, and the ACTION is where
almost all failures happen:

| Beat | What it is | Where it lives |
|------|-----------|----------------|
| **Situation** | The scene: a person, a place, a night that matters | `storyIntro` / intro templates |
| **Task** | What the character must settle before the scene can move | end of intro / start of stem |
| **Action** | The math itself, as a mechanic that is NATIVE to that world | the question stem |
| **Result** | The world responds to the number, in-world, no verdict | `world_feedback.correct` / `.incorrect` (C4: never a checkmark) |

## The Action test (where reskins fail)

Ask of every cell: **would a real person in this world reach for this exact
calculation, unprompted, to get through their day?**

- A chef scaling a recipe: yes.
- A chemist mixing base and dye to a 3 : 4 ratio: yes.
- A coach converting a route between km and miles for two crews: yes.
- A chemist drawing colored capsules out of a box to state a probability: **no.**

Thematic adjacency is not mechanical authenticity. "Probability is science-ish,
so give the scientist a probability question" produces decorated worksheets,
which is exactly what the brief forbids ("a generic worksheet with decorative
flavor text").

## Anti-example (documented failure, 2026-07)

A visitor typed "chemistry and math" and got Suri on a field survey drawing
colored capsules from a sample box. The SETTING was on-theme (chemistry >
discovery cluster > lab/survey), but the ACTION was a bag-of-marbles
probability drill with nouns swapped (bag > "sample box", marbles >
"capsules"). Nothing about drawing capsules is chemistry. The scene was
scenery.

The repaired version gives the chemist a mixing-ratio question (base solution
and dye, 3 : 4, 1200 ml measured), because mixing to exact parts IS what a
person at a bench does (`cell_spark_lab_blend_117`).

Rule of thumb: **if you can swap the scene's nouns back to the original
worksheet without changing a single verb, the story failed.** In the capsule
cell, "draw a capsule from the sample box" is verb-for-verb "draw a marble
from the bag". In the blend cell, "pour the second component to match the
reference shade" has no worksheet ancestor.

Note the survey/capsule cell itself is not banned: random draws from a tagged
sample ARE native to field sampling. It fails only when handed to interests
whose native mechanic is something else. Matching, not just writing, carries
the bar.

## Authenticity comes from SELECTION, not mutation

Math is frozen (numbers, units, choice order, correct index never change).
So you cannot make a question authentic by rewriting it; you make the
EXPERIENCE authentic by choosing a source question whose underlying mechanic
already belongs to the world:

| World | Native mechanics (pull questions with these) |
|-------|----------------------------------------------|
| Kitchen / stall / market | portions, scaling, unit price, margin, split of takings |
| Lab / clinic / ward | mixture ratios, dilution, dose per weight, unit conversion, reading error |
| Field station / trail / survey | means of logged readings, sample draws, rates over time |
| Route desk / expedition / space | unit conversion, distance-rate-time, coordinates |
| Workshop / pattern table / garage | area, scale, fit, right angles, material per piece |
| Studio / stage / rehearsal | tempo, measures, steady increments (sequences), sync ratios |
| Server room / edit bay / launch | odds and drop rates, cost-per-unit, frame rates, render queues |

In First Spark this is enforced by `pickCell()` in
`app/public/demo/v2/spark-engine.mjs`: the winning cluster fixes the SCENE,
then each interest's `concepts[]` list (its native mechanics, most-native
first) selects WHICH cell inside that scene. Lexicon entries must therefore
order `concepts[]` by mechanical nativeness, not by curriculum importance:
nursing = ratios (dosage) first, probability last.

## Checklist for a new story cell

1. Source question chosen because its mechanic is native to the world
   (Action test above), not because its topic sounds adjacent.
2. `storyIntro` establishes situation + stakes in 2 to 3 sentences. Warm,
   serious, never remedial, never "math is fun" (BRAND_BOOK.md).
3. Multi-interest templates (`introTemplates`) weave BOTH interests into ONE
   scene via `{a_noun}` / `{b_noun}` / `{a}` / `{b}`. **Every template must
   contain both an a-slot and a b-slot** — a template with no slots silently
   produces an intro that ignores the visitor (this shipped once; four
   templates had no slots at all).
4. Stem re-sets the task inside the scene with every number, unit, and choice
   verbatim from the source.
5. `world_feedback` responds in story physics for BOTH outcomes, works no
   matter which wrong choice was picked, nudges toward the mechanic without
   revealing the answer, and never says right/wrong (C4).
6. Zero em dashes in any visitor-visible string. No AI-slop phrasing.
7. Distractor taxonomy: each wrong choice mapped to the real misconception it
   represents.

## For LLM generation pipelines

Put the bar in the prompt, not just the review. The Spark Groq skin
(`webhook/api/spark-experience.ts`, system rule 7) words it like this and any
story generator should carry an equivalent clause:

> Every scene needs situation, task, action, result: the ACTION is the math
> itself doing a job that genuinely belongs in that world. Never bolt an
> abstract exercise onto a themed backdrop: a chemist drawing colored capsules
> from a box is scenery, not chemistry. If the question's mechanic cannot be
> made native to their world, set the scene around a character for whom it IS
> native and let the visitor's interests be the stakes.

Verification to run after content changes:
`node app/scripts/sparkAcceptance.mjs` (12-pair brief matrix + thin-lexicon
pairs; asserts both interests appear, flagship-quality cell chosen, feedback
present, no em dashes). Mechanic authenticity itself cannot be asserted by
string checks: eyeball the printed cell + concept per pair against this guide.
