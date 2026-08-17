# BUILD — Decouple the predictor from mastery (Stage 1: item-aware prediction)

**Lane: Engine.** All files under `ml/`. Touches **no** Product file, adds **no**
endpoint, changes **no** existing behavior. Product (`app/**`) is untouched.

| Task | Files |
|---|---|
| P1 — dedup at read | `ml/mindcraft_graph/firestore_adapter.py` |
| P2 — predictor module | `ml/validation/predictor.py` *(new)* |
| P3 — harness uses it | `ml/validation/replay.py`, `ml/validation/run_harness.py` |
| P4 — fit + report | `ml/validation/fit_predictor.py` *(new)* |

---

## Why

The harness currently predicts whether a student answers a question correctly
using **one scalar — the concept's mastery score, used directly as P(correct)**:

```python
# validation/replay.py
predicted = concept_mastery_before
```

Nothing about the *question* enters. Two questions of wildly different
difficulty in the same concept get the identical prediction. Level affects
`outcome_from()` when an outcome is **folded**, and never when a prediction is
**made**. `format_mastery_before` is computed alongside and discarded.
`bridge_conf_before` is permanently `None`.

Worse, it is a category error: mastery is
`σ(−2.0 + 0.8·log(W+1) + 1.5·avg_outcome + 0.3·recency)` — a **pedagogical index
with hand-set coefficients**, never fit to "fraction of questions answered
correctly." Scoring it with Brier grades it on a task it was never built for.

Measured on deduped data (n=151):

| Predictor | Brier (lower better) |
|---|---|
| Current — mastery as P(correct) | **0.3221** |
| Constant (predict the base rate 0.5232) | **0.2495** |

**Do not "fix" this by changing mastery.** Mastery has many consumers —
pathfinder trim, exam re-ranking, "learn next", decay, displacement, the UI.
They all want a stable aggregate of exposure and outcome, which is what it
already is. The defect is one line in the harness, so the fix is **additive**:
add a predictor, leave mastery alone.

This is the standard learner-modeling split: mastery ≈ student ability **θ**
(state), prediction ≈ **P(correct | θ, item)** (Item Response Theory). They are
different objects; conflating them is the bug.

---

## P1 — Dedup at read (prerequisite, do first)

28.4% of `attempt_observations` are duplicates — the same
`(student, question, outcome)` written repeatedly (see
`ENGINE_BOOK_ACCURACY_REVIEW.md` §3.1). They **flatter** the metric: the replay
folds the same outcome repeatedly, dragging mastery toward it, so the next
identical prediction scores well. Any fit on raw data optimizes against noise.

In `load_attempt_observations`, collapse on `(student_id, question_id, correct)`
keeping the **earliest** timestamp. Genuine re-attempts survive — they carry a
different `correct` value (10 such cases today).

- Keep it behind a `dedupe: bool = True` parameter so the raw stream stays
  reachable for forensics.
- Rows with `question_id is None` are never collapsed.
- Log the collapse count at INFO. **Do not** silently swallow — the bare
  `except Exception: return []` in this file has hidden two multi-feature
  outages already; if you touch these handlers, make them log.

---

## P2 — `validation/predictor.py` (new, pure functions, no I/O)

```
P(correct) = sigmoid( a * (theta - b) )
```

**`theta`** — student ability for this item, from state the replay already
tracks:
- `concept_mastery_before` (always present)
- `format_mastery_before` when the item has a format (currently discarded)
- Start with `theta = w_c * concept + w_f * format`, `w_f = 0` allowed so
  concept-only is the degenerate case. Two weights, not a learned encoder.

**`b`** — item difficulty, **read from the ontology, not fitted**:
- `population_failure_prior.overall` — present for **42/42 concepts** (verified)
- adjusted by the item's `level` (1/2/3)
- This is what makes the fit viable at n=151: difficulty is supplied, not
  estimated per item.

**`a`** — one global discrimination parameter.

Total free parameters: **3–4** (`a`, `w_c`, `w_f`, a level scale). That budget is
deliberate. Do not add parameters without adding data.

Signature shape (adapt to taste, keep it I/O-free and unit-testable):

```python
def predict(theta_inputs: ThetaInputs, item: ItemParams, params: PredictorParams) -> float
```

**This finally gives difficulty a consumer.** `ENGINE_MECHANISM.md` issue #15 has
been open as *"difficulty is honest now but has no ranking consumer."* This is
the consumer. Note in that file that #15 is addressed here.

---

## P3 — Wire the harness to it

- `ReplayRow` gains the fields the predictor needs (`level`, `format_id` already
  present; add item difficulty). Keep `concept_mastery_before` **unchanged** so
  the old number stays reportable.
- `predicted` becomes the predictor's output. Report **both** in
  `run_harness.py` so every run shows the comparison:

```
brier_mastery_baseline : 0.3221   # what we do today
brier_constant         : 0.2495   # predict the base rate
brier_predictor        : ?        # this build
```

A run that doesn't print all three is not finished.

---

## P4 — Fit, honestly

`validation/fit_predictor.py`: fit the 3–4 parameters by minimizing Brier, with
**leave-one-student-out cross-validation**. Report in-sample and held-out
separately.

Non-negotiable, given how small the data is:
- 151 observations, **50% from one student**. Report per-student held-out
  numbers, never a single pooled figure.
- If held-out Brier is worse than in-sample by a wide margin, say so plainly.
  A predictor that beats the baseline only in-sample has not beaten it.

---

## Acceptance

- [ ] P1 dedup lands first; harness re-run shows `observations: 151`.
- [ ] `brier_predictor` **< 0.2495** (the constant baseline) on **held-out**
      folds — not just in-sample. This is the bar; beating 0.3221 is not enough,
      that only means beating a known-broken predictor.
- [ ] All three Brier numbers printed every run.
- [ ] `ml` test suite green (`pytest`), `python scripts/end2end.py` still 85/85.
- [ ] `git diff --stat` shows `ml/**` only.

**If the predictor cannot beat the constant on held-out data, report that.** That
is a real and publishable result at n=151 — it means we need volume, not a
better model, and the correct next move is fixing the duplicate-write bug and
waiting. Do not tune until it passes.

---

---

## PRE-REGISTRATION — the 2-parameter variant (written 2026-08-15, before running)

Stage 1 was built and fitted. It **failed** its acceptance criterion. Recording
the next experiment's prediction *before* running it, so the result can't be
rationalized after the fact.

### What happened

In-sample Brier **0.2387** (beats the 0.2495 constant, and far better than the
0.3221 mastery baseline). Held out, observation-weighted across 151 rows:

| | |
|---|---|
| Predictor | **0.2676** |
| Constant | **0.2538** |
| | **loses by 0.0138** |

"5 of 9 students beat the constant" is misleading: **117 of 151 held-out rows
(77.5%) sit in failing folds**, and the only two folds with meaningful held-out
n — `Qy0e` (81) and `Xu7` (29) — both lose. The passing folds have n of 1, 3, 4,
4, 12, 13.

### The diagnosis

Parameters are **not identified** at this volume:

| param | range across folds |
|---|---|
| discrimination | 0.37 → 1.10 |
| concept_weight | 0.80 → **5.00** (pinned to its bound) |
| format_weight | **−2.21** → 1.97 (sign flip) |
| level_scale | **−0.11** → 1.08 (sign flip) |

But the per-student readout shows `format_weight` is worse than unidentified —
it is **mis-specified**. Format mastery is a **global node, not per-concept**, so
adding it to a per-concept score leaks cross-concept competence into concepts the
student is failing: `functions_basics` 25% accuracy with format mastery 0.80 →
predicted 0.71; `factoring_polynomials` 40% with format 0.78 → 0.70. That
independently explains both the separability harness's −0.25 concept/format
correlation and the fold where the optimizer drove `w_f` to −2.21 — it was
cancelling a backwards term, not learning that format hurts.

### The experiment

Fit **2 parameters only**: `a` and `w_c`. Set `format_weight = 0` and
`level_scale = 0` (not fitted, not merely bounded near zero).

### The predictions — stated now

1. **In-sample Brier gets worse** than 0.2387 (fewer parameters, less to fit
   with). Expect roughly 0.240–0.250.
2. **The generalization gap shrinks materially.** Per-fold
   `held_out − train` should fall well below the current 0.0635 / 0.0430 /
   0.0314 on the three largest folds.
3. **`concept_weight` stops pinning at 5.0** and lands in a stable range across
   folds — this is the identification test.
4. **Observation-weighted held-out Brier improves toward 0.2538**, and may still
   not beat it.

### How to read the outcome

- **Gap collapses and held-out beats 0.2538** → diagnosis confirmed; the 4-param
  model was overfitting on two mis-specified terms. Promote the 2-param model.
- **Gap collapses but held-out still loses** → identification was the problem,
  volume is the remaining one. Correct move is to **stop modeling** and go fix
  the duplicate-write bug (`PRACTICE_LOOP_EVIDENCE_BUILD.md` A), then re-run.
  This is a legitimate result — record it and move on.
- **Gap does not collapse** → the diagnosis was wrong; the instability is
  elsewhere (likely `Qy0e` holding 54% of rows). Do not add parameters back.

**Do not** tune, re-bound, or add features to make this pass. If it fails, the
finding is "we need volume," and the cheapest volume is the idempotent-finish fix.

### Also do, independently of the outcome

- **Drop `deploy_smoke_1782584817`** and any non-student account from the corpus.
  It contributes 3 rows and a meaningless 0.3681 held-out Brier.
- **Report observation-weighted aggregates**, not just per-fold. The current
  output makes a failing model look like a 5-of-9 success.

### Next, once volume allows

`b` is currently keyed **per concept**, not per item (`replay.py:95`,
`difficulty_by_concept`). Within a concept, difficulty takes only 3 values (one
per level), so two different questions in the same concept at the same level get
identical predictions — the only true per-item input is `level`. **Empirical item
difficulty** (a question's observed failure rate once enough students have
answered it, falling back to the concept prior when cold) is the natural next
term, and unlike ingredient-level θ it needs no tagging, no classifier, and no
new data model.

**On gradient boosting:** not at n=151 — a GBM has effectively hundreds of
parameters where 4 are already unidentified, and 54% of rows come from one
student. There is also an interpretability cost that matters here: IRT parameters
are meaningful (`θ` is ability, `b` is difficulty), which is what lets the product
select items near P≈0.7. A GBM gives a number with no such handle. Revisit when
there are ~10³ observations across ~50+ students, and even then as a
*benchmark* for the parametric model rather than a replacement.

---

## Explicitly out of scope

- **Changing `compute_mastery_score` or any mastery consumer.** Not this build.
- **Ingredient-level `theta`.** Data-blocked: **0 of 1,713** live bank questions
  carry ingredient tags (verified). That is Stage 2 and depends on the
  classifier/enrichment audit — see `CLASSIFIER_INGREDIENT_AUDIT_PROMPT.md`.
- **Wiring the predictor into `serve.py` or the product.** It lives in
  `validation/` precisely so the blast radius is zero until it earns its way out.
  Once it beats the baseline, promoting it to `engine/` is its own reviewed
  change — and the first product consumer would be item selection (choose items
  near P≈0.7), not a mastery replacement.
- Bridge confidence as an input — the field exists but is never populated.

---

## PRE-REGISTRATION — ingredient ability arms (written 2026-08-16, before running)

This experiment is expected to be null. Its purpose at the current volume is to
verify and measure the question → misconception → ingredient-state wiring, not
to select or promote a predictor.

### Predicted outcomes

- **Constant:** expected to remain the hardest baseline to beat on held-out
  students because the corpus is tiny and founder-dominated.
- **Concept-mastery 2-parameter incumbent:** expected to improve in-sample over
  the constant and tie or lose to it held out, consistent with Stage 1.
- **Ingredient `min` (primary):** expected to show more item-level variation but
  tie or lose to the constant and incumbent held out. If the signal is visible
  at all, it should be strongest on resolved, human-only map rows.
- **Ingredient `mean` (secondary comparison):** expected to be no better than
  `min`; averaging should dilute a single broken required ingredient.

Coverage below roughly 50% makes every model comparison uninformative, whatever
the Brier score. All-row results must therefore be accompanied by resolved-only
and provenance-split results.

### What would count as evidence

Nothing available at n≈148 can establish that the ingredient idea works. A
directionally favorable held-out score here is a warning to check wiring and
overfitting, not promotion evidence. Credible evidence would require a new,
substantially larger and more diverse learner cohort, a pre-registered repeat,
adequate question resolution, and a stable held-out improvement on resolved
rows that is not confined to one student or one provenance group.

### Actions by outcome

- **Null or loss:** keep the validation-only wiring, report coverage and
  provenance splits, add no parameters, and wait for learner volume and/or a
  better misconception map.
- **Win only in-sample or only on all rows:** treat it as overfit or fallback
  mixing; do not tune or promote.
- **Win only on human-only resolved rows:** record map quality as the leading
  explanation and prioritize improving/reviewing LLM-provenance links; do not
  promote the model.
- **Broad held-out win:** audit leakage, determinism, folds, fallback, and joins;
  retain the result as a hypothesis for the larger pre-registered repeat, with
  no product promotion at this sample size.
