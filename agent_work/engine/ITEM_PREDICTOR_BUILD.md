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
