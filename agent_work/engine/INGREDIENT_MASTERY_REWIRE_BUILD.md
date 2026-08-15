# BUILD — Let ingredients move concept mastery

**Lane: Engine.** All files under `ml/`. No Product file, no new endpoint, no
API shape change.

| Task | Files |
|---|---|
| I1 — resolve the double-write conflict | `ml/mindcraft_graph/engine/ingredient_runtime.py` |
| I2 — aggregate on the practice path | `ml/serve.py` |
| I3 — misconception multiset on the event | `ml/mindcraft_graph/models/events.py`, `ml/serve.py` |

---

## Why

Today the evidence chain **dead-ends one level below concepts**. Verified in
`serve.py:890–935`:

1. Wrong answers carrying a `misconception_id` are collected (`correct <= 0`)
2. `ing_state.misconception_counts[mis_id] += 1`
3. `misconception_ingredient_map[mis_id]` → linked ingredients (655 mapped;
   provenance 344 llm / 282 human / 29 embedding; reaching 97 of 179 ingredients)
4. Each fires a synthetic negative card event → `update_ingredient_state(...)`

**Step 4 is where it stops.** `aggregate_to_concept_mastery` exists and works,
but nothing on this path calls it. So misconceptions move ingredients, and
ingredients move nothing. Concept mastery is driven purely by raw question
correctness — which is also the reason a per-question predictor has nothing
finer than the concept to work with.

---

## I1 — Resolve the double-write conflict *(do this first, it is the real design decision)*

There is a genuine conflict that must be settled before wiring anything:

- **Concept mastery is rebuilt from the `interactions` event log on every call**
  (`update_student_state` folds events in timestamp order; no score is stored).
- **`aggregate_to_concept_mastery` overwrites `mastery_by_concept` directly.**

Wire them naively and they fight: the next `/recommend` rebuild silently discards
whatever the aggregation wrote.

**Take the event path.** Ingredient evidence should emit a **`SessionEvent`**
like everything else, not overwrite state:

- `event_type="problem_set"` (or a new `"ingredient"` type if you prefer the
  provenance — then add it to the `Literal` and handle it everywhere `event_type`
  is switched on).
- `exposure_weight` **well below 1.0** — this is second-hand evidence, inferred
  from a distractor via a mapping that is 53% LLM-generated. `0.15` matches the
  existing "tertiary" tier. Put it in `config.py`.
- `outcome` derived from the aggregated ingredient masteries for that concept,
  weighted by connectivity (what `aggregate_to_concept_mastery` already computes).

This keeps the "events are the only source of truth, mastery is always rebuilt"
invariant that the whole engine depends on. **Do not** introduce a second write
path into `mastery_by_concept`.

If you conclude the overwrite approach is genuinely better, stop and write up
why — that is an architecture change, not an implementation choice.

---

## I2 — Aggregate on the practice path

In `/record-outcomes`, after the ingredient-state updates in the
`misconception_items` block:

1. Aggregate the touched ingredients to their parent concepts.
2. Emit one low-weight `SessionEvent` per affected concept (I1's shape).
3. Append via `append_interactions` with a distinct `source` (e.g.
   `"ingredient_aggregate"`) so it is separable in Firestore and in the harness.

**Guard against double-counting.** The same session already emitted a full-weight
concept event from raw correctness. The ingredient-derived event must be
*additional, weaker* evidence about the same performance — not a second full vote
on it. That is exactly what the low `exposure_weight` is for; make the reasoning
explicit in a comment, because the next reader will wonder.

**Only fire for concepts whose ingredients actually moved.** A concept with no
mapped misconception in this session emits nothing.

---

## I3 — Misconception multiset on the event

`SessionEvent` currently carries no misconception information, so the concept
layer cannot see *why* a student failed.

- Add `misconceptions: dict[str, int] = Field(default_factory=dict)` — a
  multiset, matching the shape `ing_state.misconception_counts` already uses.
- Populate from the session's wrong answers in `/record-outcomes`.
- Persist through `append_interactions` / `load_student_events` (both need the
  field; Firestore stores it as a map).
- **Nothing has to consume it yet.** This is substrate for the strength work
  below and for session-level prediction. Land the plumbing, keep it inert.

`Field(default_factory=...)` for the mutable default — house style, and required
here.

---

## Acceptance

- [ ] A wrong answer with a mapped misconception moves ingredient state **and**
      produces a concept-level event that **survives a graph rebuild** (this is
      the whole point — assert it explicitly by rebuilding and re-reading).
- [ ] A session with no mapped misconceptions produces **no** extra event.
- [ ] Concept mastery does not double-count: a session's ingredient-derived event
      is strictly lower-weight than its raw-correctness event.
- [ ] `misconceptions` round-trips Firestore (write, read, compare).
- [ ] `pytest` green; `python scripts/end2end.py` still 85/85.
- [ ] `git diff --stat` shows `ml/**` only.

---

## Known limits — state them, don't fix them here

- **97 of 179 ingredients** are reachable from the misconception map; the other
  82 cluster in matrices / complex numbers / logarithmic functions / integrals.
  This build lights up on the reachable set and silently no-ops elsewhere. That
  is correct behavior.
- **Only 1 of 211 observations currently carries a `misconceptionId`** — the
  stream is nearly empty in production today. Expect this build to fire rarely
  until the deploy-lag fix has been live for a while (re-measure in a week).
- The map is **53% LLM-generated**. The low `exposure_weight` is not timidity; it
  is the honest confidence level of the evidence.

## Out of scope

- Ingredient-level `θ` in the item predictor. Data-blocked: **0 of 1,713** live
  bank questions carry ingredient tags. See
  `CLASSIFIER_INGREDIENT_AUDIT_PROMPT.md`.
- Feeding misconceptions into `strength_score`. Genuinely promising — a recurring
  misconception is high-conviction evidence about *intuition*, which is what
  strength is for, and shared misconceptions across concepts are a natural
  alignment signal. It needs I3's substrate first, then its own build.
- Any change to `compute_mastery_score` or the decay half-life.
