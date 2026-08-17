# BUILD — Wire ingredient evidence into the item predictor

**Status:** ready to implement. **Written 2026-08-16.**
**Lane: Engine** — `ml/validation/**` only. No API change, no Product-tree file,
no C5 seam change. Safe to run in parallel with the ontology restructure.

**Read [`ITEM_PREDICTOR_BUILD.md`](ITEM_PREDICTOR_BUILD.md) first.** This build
inherits its pre-registration discipline, and §5 below is not optional.

---

## 1. What this fixes

The predictor's only ability input is **concept mastery**, and its difficulty
term is `difficulty_by_concept[cid]` — the ontology's authored
`population_failure_prior.overall` (`run_harness.py:24`), a hand-set constant per
concept. With `level_scale` and `format_weight` pinned to zero by the
2-parameter experiment, **no per-item input remains**: every question in a
concept receives an identical prediction.

The per-question differentiator already exists and is unread by the predictor:

```
question → distractor_taxonomy[].misconception_id      Eedi's own human tags
         → misconception_ingredient_map                655 links
         → ingredient_ids
student  → IngredientStudentState.ingredient_mastery   already maintained
```

Two questions in the same concept trap different misconceptions, which resolve to
different ingredients, on which the student has different mastery. That is the
signal.

**Why ingredients and not misconceptions** (decided, do not relitigate):
misconception-keyed features memorise — 1,749 of them, and an unseen question's
specific traps are almost certainly ones the student has never met. Ingredient-
keyed features generalise — 179 of them, and an unseen question's ingredients are
almost certainly ones the student has history on. Generalisation to unseen
questions is the point.

**Consequence, stated plainly:** this makes the predictor depend on
`misconception_ingredient_map` quality, where 344 of 655 links are
`llm`-provenance agreeing with independent ground truth at **0.545** (vs 0.928
`human`). In mastery that weakness is contained by an `exposure_weight` 0.15
discount. Here there is no discount. **Carry provenance through and report
metrics split by it** (§4) — otherwise a null result cannot be attributed
between "the idea is wrong" and "half the map is wrong."

---

## 2. Where the join happens

**In the harness, at replay time. Do not touch `questionBank.ts`.**

`ReplayRow` construction (`replay.py:82–105`) already receives `question_id` from
the adapter (`firestore_adapter.py:208`) and currently drops it. Thread it
through, then join in `ml/validation/`:

1. load `app/src/data/eediQuestions.json` (cross-lane **read**; precedent:
   `backfill_distractor_misconceptions.py` already reads it)
2. `question_id` → `distractor_taxonomy[].misconception_id`
3. → `misconception_ingredient_map['map']` → `ingredient_ids` + provenance
4. → the student's `ingredient_mastery` for those ids, replayed forward the same
   way `concept_state` already is

This keeps the whole build inside `ml/validation/` and independent of
[`INGREDIENT_TAG_EMISSION_BUILD.md`](INGREDIENT_TAG_EMISSION_BUILD.md). If that
build lands first, read its materialised `ingredients` field instead and delete
the join — but do not wait for it.

---

## 3. The model

Replace the ability term. Everything else stays as the 2-parameter experiment
left it (`format_weight = 0`, `level_scale = 0`).

```
θ = ingredient_weight × agg( ingredient_mastery[i] for i in question_ingredients )
P = sigmoid( discrimination × (θ − difficulty) )
```

**Two fitted parameters only: `discrimination` and `ingredient_weight`.** Do not
add more. Stage 1 of the predictor work showed four parameters are not
identified at this volume; nothing about this build changes that.

### DECISION — the aggregator `agg`

- **`min` (conjunctive)** — the question is failed if *any* required ingredient
  is broken. This is the DINA model's assumption and matches the pedagogy.
  **Recommended.**
- **`mean`** — lower variance, but lets a strong ingredient mask a broken one,
  which is exactly the diagnosis we want to keep.

Implement `min` as primary and `mean` as a comparison arm. Report both. Do not
pick the winner after seeing held-out scores — declare `min` primary in the
pre-registration and report `mean` as secondary.

The research prompt
([`KC_MAPPING_RESEARCH_PROMPT.md`](KC_MAPPING_RESEARCH_PROMPT.md), Q5) asks
whether AFM/PFA give a better-founded formulation. **If that report lands before
this build starts, read it first** — it may replace this hand-rolled model with
an established one.

### Fallback and coverage

**Coverage is the binding limitation and must be measured, not assumed.**
Measured bank-side ceiling:

| source | rows | with `distractor_taxonomy` |
|---|---|---|
| `eediQuestions.json` | 1,508 | 1,508 (**1,170 resolve to ≥1 ingredient**) |
| `actMasterQuestionBank.generated.json` | 205 | **0** |
| `generatedQuestions.json` | 2 | **0** |
| static bank in `questionBank.ts` | ~227 | 0 |

So **at most ~60% of bank rows can resolve**, and the observed subset may be far
lower. When a question resolves to no ingredient, fall back to concept mastery
and **flag the row**.

---

## 4. Reporting

Report, every run:

1. **Resolution rate** — observations that resolved to ≥1 ingredient, out of
   total. **If this is below ~50%, the comparison is uninformative and must be
   reported as such**, whatever the Brier says.
2. Brier for: constant, concept-mastery 2-param (the incumbent), ingredient
   `min`, ingredient `mean` — in-sample and held-out, observation-weighted and
   per-student.
3. **Held-out Brier restricted to resolved rows only**, alongside the all-rows
   figure. Mixing fallback rows into the headline hides the effect in both
   directions.
4. **Split by map provenance** — resolved rows whose ingredients came only from
   `human` links vs any `llm` link. If `human`-only rows behave differently, that
   is the map-quality signal and it is the most valuable output of this build.
5. Generalisation gap (held-out − in-sample). The 2-param run cut this from
   0.0289 to 0.0162 by removing parameters; a jump back up means overfitting.

---

## 5. Pre-registration — write this down BEFORE running

**Expect a null. This build is plumbing, not an improvement.**

The binding constraint is unchanged: **148 observations, ~54% from one student,
and both students are the founders** — not the target population. No feature
added here makes 148 observations sufficient. A model that beats the constant
on this data has most likely overfit, and a model that ties it has told you
nothing about ingredients.

Before running, write into `ITEM_PREDICTOR_BUILD.md`:

- the predicted outcome for each arm
- **what would count as evidence the idea works** — and note honestly that at
  n=148 the answer is probably "nothing available here"
- what will be done for each outcome

Then:

- **Do not tune to pass.** The 2-parameter run's value was that it stopped on a
  null. Repeat that.
- **Do not promote on a win.** A win at this n is a warning sign, not a result.
- **Do not add parameters** to rescue a null.

**The real success criterion for this build is that the wiring is correct and
measured, so it is ready when volume exists.** Judge it on that.

---

## 6. Acceptance criteria

1. `question_id` threaded from adapter → `ReplayRow` without changing the
   adapter's output shape.
2. Join implemented in `ml/validation/` only. `git diff --stat` shows **no**
   file outside `ml/` modified.
3. Resolution rate reported and non-zero.
4. All four arms reported, both restricted and all-rows, split by provenance.
5. Fallback path exercised by a test: a question with no `distractor_taxonomy`
   predicts via concept mastery and is flagged, not dropped.
6. Determinism — same inputs, same output. No randomness in the fit.
7. `cd ml && pytest` and repo-root `pytest ml/tests` pass; `end2end.py` 85/85.
8. Pre-registration committed **before** the first scored run, in its own commit,
   so the timestamp order is provable in git history.

---

## 7. Out of scope

- Per-item free difficulty. Not estimable at n=148 — most bank questions have
  0–1 observations. Pooling at the ingredient level is what this build does
  instead.
- Any change to `compute_mastery_score` or the live mastery model.
- The `exposure_weight` 0.15 discount on ingredient evidence in `serve.py`.
- Synthetic training data. Fitting a predictor on generated sessions measures the
  generator, not students. (Simulation for **power analysis** — recovering known
  parameters at varying n — is a separate and legitimate build.)
