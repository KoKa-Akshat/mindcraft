# Story Intelligence — Architecture Spec
> Author: Claude (main session). Read by: Cursor, Fable 5, Codex, Blake.
> This is design, not implementation. Do not rewrite story_cell_studio.py,
> questionBank.ts, or run OpenStax batches based on this doc alone.

---

## 1. Agentic generation loop

```
Input: concept_id + misconception_id + world + primitive
         ↓
StoryCellGenerator  [1 LLM call]
  Persona prompt: "You are designing a diagnostic moment inside a story world."
  Required output fields: question, choices[4], correct_reasoning,
    distractor_taxonomy[3], hints[3], world_feedback, transfer_question
         ↓
PedagogyCritic      [1 LLM call, scores 7 dimensions 0–10]
  AUTO-REJECT if: any dim < 4, OR math_integrity < 7, OR avg < 6.5
  REVISE if: avg 6.5–7.4 (regenerate with critique appended to prompt, max 2 retries)
  PASS if: avg ≥ 7.5 AND math_integrity ≥ 8
         ↓
PersonaSimulator    [deterministic, no LLM]
  misconception_student MUST hit primary distractor (else REVISE, counts as retry)
  fast_guesser must not trivially get correct (else question is too easy)
         ↓
Auto-ship gate:
  avg ≥ 8.5 AND all dims ≥ 7 AND all personas behave as expected → storyCells.json
  avg 7.5–8.4 OR any persona anomaly → Akshat review queue (ACTIVE_TASK.md log)
  REVISE exhausted (3 attempts) → reject, log to ml/data/story_cells/rejected.json
```

**Human review queue is a JSON file, not a dashboard yet.** Akshat reads it, leaves
a one-line verdict ("ship" / "fix: [note]"), and Cursor re-runs or ships on that signal.

**What auto-ships vs what needs eyes:**
- Algebra/arithmetic story cells → auto-ship if rubric passes (math is checkable)
- Probability/statistics → always human review (nuance in "fair" language)
- Any cell with `world_feedback` mentioning injury, illness, death → flag for tone review

---

## 2. Data moat schema — log from day one

Every student response to a Story Cell or misconception-tagged question writes one event.
Add this to `/record-outcomes` payload (new optional fields, backwards-compatible):

```jsonc
// StudentResponseEvent (extends existing OutcomeItem)
{
  // existing
  "conceptId": "fractions_addition",
  "outcome": -1 | 0 | 1,
  "effort": 1 | 2 | 3,

  // NEW — log if question has distractor_taxonomy
  "chosen_index": 2,               // which choice the student clicked
  "correct_index": 0,              // from question
  "misconception_id": "mis_fractions__adds_denominators",  // distractor_taxonomy[chosen_index].misconception_id
  "error_type": "wrong_formula",   // distractor_taxonomy[chosen_index].error_type
  "hint_indices_used": [0],        // which hints were revealed before answering
  "time_to_answer_ms": 14200,      // frontend measures from question render to submit
  "is_transfer_question": false,   // true if this was the transfer_question
  "confidence_before": 0.3,        // from gap-scan or last seed_assessment
  "story_cell_id": "cell_fractions_addition_a3f9c1",
  "world": "sky_workshop",
  "primitive": "fill_spill_overflow"
}
```

**Why each field compounds:**
- `misconception_id` → after N events, compute P(misconception | concept, grade) — this is the moat
- `hint_indices_used` → reveals scaffolding effectiveness per concept
- `time_to_answer_ms` → detects random guessing (< 3s on 4-choice = likely guess)
- `is_transfer_question` → measures durable learning, not performance
- `world` + `primitive` → eventually reveal which story contexts produce transfer

**Firestore path:** `interactions/{studentId}/events/{eventId}` (existing path, add new fields).
The mastery engine reads `outcome` as before — new fields are additive, don't change scoring yet.

---

## 3. Personalization v1 — interest tags → world skin

**The spine is shared. Only the wrapper changes.**

```
Student: interestTags: ["space", "cooking"]
                    ↓
World Skin Registry (static map, in app/src/data/worldSkinRegistry.json):
{
  "space":       ["sky_workshop", "map_world"],
  "cooking":     ["creature_sanctuary", "market_world"],
  "sports":      ["map_world", "builder_world"],
  "music":       ["signal_tower"],
  "history":     ["map_world", "market_world"],
  "biology":     ["creature_sanctuary"],
  "engineering": ["builder_world", "sky_workshop"]
}
                    ↓
For concept X → pick world = first match between student's tag list and WORLD_CONCEPT_MAP
                    ↓
storyContext + world_feedback text changes; question spine (stem, choices, correctIndex) UNCHANGED
```

**v1 is a batch job, not live LLM:**
1. After Story Cell batch generates ~42 cells (one per concept), run a reskin pass:
   `python ml/scripts/pipeline/story_cell_studio.py --reskin --world sky_workshop --concepts exponents_powers,scientific_notation`
   This regenerates ONLY `storyContext` and `world_feedback` for a different world.
2. Store per-world variants: `storyCells_sky.json`, `storyCells_market.json`, etc.
3. `questionBank.ts`: `getStoryCells(conceptId, world)` picks the right variant.

**What changes per skin:** `title`, `world`, `storyContext`, `world_feedback`, `narrative_need`.
**What NEVER changes:** `question`, `choices`, `correctIndex`, `hints`, `distractor_taxonomy`.

**v2 (needs Anthropic credits):** Live reskin at question-serve time based on current `interestTags`.
Do not promise this until credits are restored.

**Collect `interestTags` at onboarding** (GradeOnboard step 3 — after goals question):
"Pick 2–3 worlds you like" → 6 icons (space, cooking, sports, music, nature, building).
Write `users/{uid}.interestTags` to Firestore. Firestore rules allow self-write.

---

## 4. Quality rubric with auto-reject thresholds

```
Dimension          Auto-reject  Needs-review  Auto-ship
──────────────────────────────────────────────────────
math_integrity       < 5          5–7           ≥ 8   ← highest bar
diagnostic_power     < 4          4–7           ≥ 7
cognitive_load       < 4          4–6           ≥ 7   (lower = better; invert: 10 = simple)
agency               < 5          5–7           ≥ 7
emotional_safety     < 6          6–7           ≥ 7   ← no "you failed" language
representation_options < 4        4–6           ≥ 7
transfer             < 5          5–7           ≥ 7
──────────────────────────────────────────────────────
AVERAGE              < 6.5        6.5–7.4       ≥ 7.5
```

`math_integrity < 5` is always a hard reject regardless of average — a pedagogically lovely
story with wrong math does active harm to mastery graph integrity.

---

## 5. Evolution loop — aggregate wrong-answer rates update distractor priors

**After every 500 student responses per concept:**

```python
# ml/scripts/update_distractor_priors.py (to build)
for each concept_id:
    events = firestore.query("interactions", where concept_id == X, limit 500)
    for each distractor in story_cell.distractor_taxonomy:
        hit_rate = count(events where chosen_index == distractor.choice_index) / len(events)
        distractor["observed_hit_rate"] = hit_rate
        distractor["n_observations"] = len(events)

    # signal: if primary distractor hit_rate < 0.10 → misconception label may be wrong
    # signal: if primary distractor hit_rate > 0.45 → confirmed strong diagnostic
    # update Layer 1 ingredient "failure_prior" with observed_hit_rate (Bayesian update)
```

**What this builds over time:**
- `distractor.observed_hit_rate` replaces the initial keyword-classification guess
- Layer 1 `population_failure_prior` per ingredient becomes evidence-backed
- Eventually: `P(misconception | grade, prior_performance, concept)` — a per-student
  prior that updates with every wrong answer. This is the moat no competitor can buy.

**Do not overwrite `distractor_taxonomy` in the bank** — write observed rates to a
separate `ml/data/distractor_priors/{concept_id}.json` file. The bank is static.
The engine reads priors at serve time.

---

## 6. VC defensibility

Competitors have content libraries. MindCraft accumulates a **misconception response corpus**.

Every wrong answer a student gives is keyed to a specific mental model (`misconception_id`),
a world context (`world`, `primitive`), a grade level, and a learning trajectory
(`prior_performance`, `hint_indices_used`). After 50,000 student responses, MindCraft
knows that 71% of grade-6 students who fail `fractions_addition` are making the
"adds-denominators-directly" error, that the sky_workshop overflow story repairs this
in 1.8 sessions vs 3.4 for a standard drill, and that students who needed hint[0]
("draw the tank in fourths") almost never need it again on the transfer question.

No content company can replicate this because **content is static and data is structural**.
The moat is: question spine → distractor → misconception_id → observed hit rate →
evidence-backed remediation path. Each story cell is a diagnostic instrument, not a
question. The corpus of student responses is what makes the instrument calibrated.

Pitch line: **"We don't know what students got wrong. We know how they were thinking."**

---

## 7. Lane split — who owns what

| Deliverable | Owner | Files |
|-------------|-------|-------|
| Story Cell generation + reskin pass | Cursor / Blake | `ml/scripts/pipeline/story_cell_studio.py` |
| `distractor_priors` updater script | Cursor / Blake | `ml/scripts/update_distractor_priors.py` (to build) |
| `StudentResponseEvent` new fields in `/record-outcomes` | Cursor / Blake | `ml/serve.py`, `mindcraft_graph/models/` |
| `interestTags` collection UI | Fable 5 | `app/src/pages/GradeOnboard.tsx` |
| `worldSkinRegistry.json` + `getStoryCells(conceptId, world)` | Codex | `app/src/data/worldSkinRegistry.json`, `app/src/lib/questionBank.ts` |
| `StudentResponseEvent` frontend emit (chosen_index, timing, hints) | Codex | `app/src/pages/Practice.tsx`, `app/src/lib/mlApi.ts` |
| Story Cell display (world_feedback reveal, transfer question CTA) | Fable 5 | `app/src/pages/Practice.tsx` question card |
| Quality rubric thresholds in PedagogyCritic | Cursor | `ml/scripts/pipeline/story_cell_studio.py` |

**Shared seam:** `app/src/lib/mlApi.ts` `recordOutcomes()` signature — Codex adds new fields,
Cursor adds them to the serve.py endpoint. Coordinate before both touch this.

---

## Implementation order (do not skip)

1. **Codex now:** Add `chosen_index`, `misconception_id`, `time_to_answer_ms`, `hint_indices_used`
   to the frontend `recordOutcomes()` call. These log silently — engine ignores unknown fields.
2. **Cursor/Blake:** Add the same fields to `serve.py /record-outcomes` → write to Firestore.
3. **After 1+2 are live:** run Story Cell `--concepts all` batch → populate `storyCells.json`.
4. **Then:** `interestTags` onboarding UI + `worldSkinRegistry.json`.
5. **Then:** `update_distractor_priors.py` — only useful once you have real response data.
