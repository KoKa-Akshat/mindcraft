# BUILD — Engine Bucket B (decided; each fix encodes a chosen policy)

**Lane: Engine (Blake).** All files under `ml/**`. One frontend *contract* is
touched but not broken (see B4). No ontology JSON edits.

**Source:** `ml/ENGINE_MECHANISM.md` § *Issues to look into*, bucket B.
**Decisions made by Blake (2026-08-11) — do not re-litigate in code review:**

| Issue | Decision |
|---|---|
| #10 self-report | **Weak evidence, can't trim** — weight 0.4, and a real practice event is required before MASTERED |
| #9b ratchet | **Beta posterior, weak prior** (~2 pseudo-counts) |
| #6 difficulty | **Population failure rate** (`population_failure_prior.overall`) |
| #8 atoms→concept | **Yes, secondary evidence** (`exposure_weight = 0.4`) |

**Preconditions**
```bash
cd ml && source mindcraft/bin/activate
python scripts/end2end.py          # 85/85 before you start
python -m pytest tests/ -q         # green before you start
```

**Build order is a dependency chain: B0 → B2 → B3 → B1 → B4.** B0 plumbs data
that B2 and B3 both need.

---

## B0 — Plumb `failure_prior` into the models (prerequisite for B2 + B3)

Layer 1 already carries the numbers, and **nothing reads them**: every one of the
42 concepts has a numeric `population_failure_prior.overall`, and all 179
ingredients have a numeric `failure_prior`. Today the ingredient value is routed
only into `CardTemplate.difficulty`, and the concept value only into
`Concept.description` (as prose — see issue #13, out of scope).

### Files
- `ml/mindcraft_graph/models/concept.py` → add to `Concept`:
  `population_failure_rate: float = 0.5`
- `ml/mindcraft_graph/models/ingredient.py` → add to `Ingredient`:
  `failure_prior: float = 0.5`
- `ml/mindcraft_graph/loaders/complete_ontology_loader.py` → populate both:
  - `population_failure_rate=float(c.get("population_failure_prior", {}).get("overall", 0.5))`
  - `failure_prior=float(raw_ing.get("failure_prior", 0.5))`
  - **Leave `description` and `CardTemplate.difficulty` exactly as they are.**

### Verify
- `ml/tests/test_failure_prior_plumbing.py`: all 42 concepts and all 179
  ingredients load a value in `(0, 1)` and **not** the 0.5 default (i.e. prove the
  data actually arrives).

---

## B2 — Beta posterior for ingredient mastery + bridge confidence (issue #9b)

**Bug:** `+0.15` per win, `−0.05` per loss. A student answering at chance drifts
`+0.05` per attempt, so **coin-flip performance converges to mastery 1.0.** Same
rule governs bridge confidence. There is no notion of sample size.

**Decision: Beta-Binomial with a weak prior (total pseudo-counts = 2.0).** Reacts
fast on thin data, which is the right trade for the ingredient layer where most
students have a handful of attempts.

### Files
- `ml/mindcraft_graph/config.py`
- `ml/mindcraft_graph/models/ingredient.py`
- `ml/mindcraft_graph/engine/ingredient_runtime.py`
- `ml/mindcraft_graph/work_evidence.py` ← **easy to miss**
- `ml/mindcraft_graph/attempt_fusion.py` ← **easy to miss**
- `ml/mindcraft_graph/firestore_adapter.py`

### Change 1 — the constant goes in config (HARD invariant: never inline it)
```python
# Weak prior: the ontology's failure_prior / bridge difficulty sets the MEAN,
# this sets how much evidence it's worth. 2.0 => the third real attempt already
# outweighs the prior. Chosen deliberately over a strong (~8) prior.
INGREDIENT_PRIOR_PSEUDO_COUNTS = 2.0
```

### Change 2 — carry α/β on both state models
Add to `IngredientMastery` and `BridgeConfidence`:
```python
alpha: float | None = None   # None = legacy doc, reconstructed on first read
beta: float | None = None
```
**Keep the existing `mastery` / `confidence` float fields** and keep writing the
posterior mean into them on every update. Consumers (`build_minimal_dag`,
`prune_mastered_nodes`, `aggregate_to_concept_mastery`, `_detect_bridge_gaps`, the
whole frontend) keep reading `.mastery` / `.confidence` with **zero changes**.

### Change 3 — priors come from the ontology
- Ingredient prior mean = `1 − ingredient.failure_prior` (needs B0).
- Bridge prior mean = `bridge_prior_confidence(bridge)` — **reuse A2's helper, do
  not re-derive.** This is exactly the reuse A2 was written for.
- `α₀ = prior_mean × 2.0`, `β₀ = (1 − prior_mean) × 2.0`.

### Change 4 — the update rule
Success → `α += 1`. Failure → `β += 1`. Then `mastery = α / (α + β)`.
Delete the `delta = 0.15 / −0.05` logic. **Leave `style_scores` alone** (still
`+0.05` on success — that's a preference signal, not a mastery claim).

`update_ingredient_state`'s A2-era `prior_confidence: float = 0.0` parameter
generalizes to `prior_mean: float | None = None`, used for both target types.
`serve.py`'s existing `_bridge_prior_for_card()` call site adapts to the new name;
add the ingredient equivalent so the misconception path in `/record-outcomes`
seeds correctly too.

### Change 5 — legacy docs (there are three other write sites)
Add one shared helper and route **every** write through it:
```python
def ensure_posterior(state, prior_mean: float) -> tuple[float, float]:
    """α/β for a record that may predate the Beta migration.

    Legacy docs have a scalar mastery + attempts and no α/β. Reconstruct rather
    than reset, so existing students don't lose their history:
        α = mastery · (attempts + 2),  β = (1 − mastery) · (attempts + 2)
    """
```
Call sites that construct or mutate these records — all of them must use it:
- `engine/ingredient_runtime.py:756, 760, 774, 783` (`update_ingredient_state`)
- `work_evidence.py:58, 59`
- `attempt_fusion.py:79, 80`
- `firestore_adapter.py:402, 413` (deserialization — where legacy docs enter)

If `work_evidence.py` and `attempt_fusion.py` keep writing scalars directly, they
will silently clobber α/β and re-introduce the ratchet on those paths.

### Verify
- `ml/tests/test_ingredient_posterior.py`:
  - **The headline regression:** 40 alternating win/loss attempts converge to
    `mastery ≈ 0.5 ± 0.03`. Under the old rule this reached `1.0`. This test is
    the whole point of B2.
  - An unattempted ingredient with `failure_prior = 0.3` reads `mastery == 0.7`.
  - A legacy record (`mastery=0.6, attempts=4`, no α/β) reconstructs to
    `α/(α+β) ≈ 0.6` and does not jump.
  - `work_evidence` and `attempt_fusion` paths both preserve α/β across a write.
- `python scripts/end2end.py` → 85/85. **`prune_mastered_nodes` fires at ≥0.8;
  report whether pruning behavior shifts** (it should — cold-start ingredients now
  start at `1 − failure_prior` instead of 0.0, so some prune immediately).

---

## B3 — Difficulty means population failure rate (issue #6)

**Read this first — A3 changed the ground under this fix.** `estimate_difficulty`
fed exactly one consumer, `ConceptProfile.adjusted_strength`, and **A3 deleted it.**
Difficulty now has **no consumer at all** (only `features.py:85` copying the field
through `apply_affective_modifier`). So the decision "difficulty = failure rate"
is right, but it no longer unblocks a behavior change by itself.

Split accordingly:

### B3a — do now: make the number honest (no ranking change)
- `ml/mindcraft_graph/models/concept.py`: `estimate_difficulty(concept)` returns
  `0.1 + 0.9 × concept.population_failure_rate`. Drop the `max_order` parameter.
  Range stays `[0.1, 1.0]` so nothing can multiply by zero.
- Keep `typical_order` — it still records curriculum position, just no longer
  masquerades as difficulty.
- `ml/mindcraft_graph/engine/features.py`: update the one call site; delete the
  now-unused `max_order` computation at line 109.

**Deliverable: a correct, available, deliberately-unconsumed difficulty signal.**
Do not invent a consumer for it.

### B3b — NOT in this build: where difficulty enters ranking
Two candidates, both real pedagogical claims that need their own decision:
1. Difficulty-weighted strength (restore `adjusted_strength` as an explicit
   ranking input) — "failing a hard concept should count less than failing an easy one."
2. Cold-start mastery prior — an untouched high-failure concept starts below the
   `σ(β₀) = 0.12` floor instead of level with everything else. This is what
   `population_priors` was authored for, per `CLAUDE.md`, but it moves every
   untouched node and therefore changes trim's UNKNOWN branch and "learn next".

Log both in `ENGINE_MECHANISM.md` under bucket C. **Build neither here.**

### Verify
- `ml/tests/test_difficulty.py`: a high-failure concept scores higher difficulty
  than a low-failure one; range is `[0.1, 1.0]`; no dependence on JSON ordering
  (shuffle the concept list, difficulties are unchanged — this is the regression
  that proves issue #6 is dead).
- `python scripts/end2end.py` → 85/85, **and no ranking output should move.** If
  any recommendation changes, you wired a consumer — back it out.

---

## B1 — Self-report is weak evidence and cannot mark mastery (issue #10)

**Bug:** a gap-scan `easy` rating writes `outcome=+0.5, exposure_weight=1.0`,
which is enough to (a) clear `strength_score ≥ 0` → MASTERED, and (b) push mastery
to ≈0.402, just over `trim_chain`'s `> 0.4` second branch. Either way the concept
is trimmed from every chain the student ever sees, on nothing but a self-rating.

**Decision: weight 0.4, and MASTERED additionally requires ≥1 non-assessment event.**

### Files
- `ml/serve.py` (`/seed-assessment`)
- `ml/mindcraft_graph/engine/features.py`
- `ml/mindcraft_graph/planning/pathfinder.py`

### Change 1 — weight
`/seed-assessment`: `exposure_weight=1.0` → `0.4`. Add a comment naming this as
the secondary-evidence tier documented on `SessionEvent`.
**Do not touch `Diagnostic.tsx`'s probe path** — those are real answered
questions posted to `/record-outcomes`, and they should stay at full weight.

### Change 2 — profiles must distinguish self-report from practice
`ConceptProfile` gains:
```python
practice_event_count: int = 0   # events from real work (event_type != "assessment")
```
`compute_concept_profiles` increments it when `event.event_type != "assessment"`.
In `apply_affective_modifier`, a forced STRUGGLING profile keeps
`practice_event_count` at whatever the existing profile had (an affective override
is not practice either — but it forces STRUGGLING, never MASTERED, so it's unaffected).

### Change 3 — gate BOTH mastered branches in `trim_chain`
```python
can_be_mastered = profile is not None and profile.practice_event_count >= 1
```
- Branch 1 (`strength_score >= mastery_threshold`) → MASTERED only if `can_be_mastered`, else UNKNOWN.
- Branch 2 (`mastery.mastery > 0.4`) → same gate. **Don't skip this one** — the
  weight change alone drops an `easy` seed to ≈0.336 and under the threshold, but
  two `easy` ratings on one concept would climb back over it.
- STRUGGLING is untouched. UNKNOWN still back-propagates as it does today: a
  self-rated concept becomes UNKNOWN, so it's still trimmed when a *later* chain
  step is genuinely mastered. That's intended — self-report informs, never decides.

### Do NOT gate `get_mastered_chain_concepts`
It and `choose_roadmap_start` are **dead code** — defined in `pathfinder.py`,
called only by each other, never by `find_path` or `serve.py` (verified). They
contain a second, divergent mastery threshold (0.45/0.0). Leave them alone and log
as new issue #14; deleting them is a separate call.

### Verify
- `ml/tests/test_self_report_gate.py`:
  - A concept with **only** an `easy` assessment event is **not** trimmed.
  - Same concept plus one successful practice event **is** trimmed.
  - A `hard` rating still yields STRUGGLING and survives trim (regression — the
    affective/self-reported-weakness path must not weaken).
  - Two `easy` ratings on one concept still don't trim it (branch-2 guard).
- `python scripts/end2end.py` → 85/85.
- **Report the chain-length delta** for test student
  `gBFn9vUGIIa7tAiTTQSl8CbPSao2` before/after. Chains should get *longer* — that
  is the fix working, not a regression.

---

## B4 — `/submit-answer` writes a real event instead of an overwrite (issue #8)

**Bug:** it overwrites `graph.state.mastery_by_concept[cid]` with the ingredient
aggregate, but logs no event. Every other endpoint rebuilds mastery from the event
log, so the next `/recommend` erases it. Ingredient→concept feedback is a no-op.

**Decision: emit a real event at `exposure_weight = 0.4`.**

### Files
- `ml/serve.py` (`/submit-answer`)

### Change
Replace the `ConceptMastery` overwrite block with:
1. For each concept from `_concepts_for_card_target(...)`, build a `SessionEvent`:
   - `event_type="flashcard"` (already in the `Literal` set; correct for a card)
   - `outcome=outcome_from(1.0 if req.student_succeeded else 0.0)` — reuse
     `config.outcome_from`, do not hand-roll a value
   - `effort=0.5`, `duration_minutes=2.0`, `exposure_weight=0.4`
2. `append_interactions(student_id, events, source="card")` — a distinct source
   from `"practice"` so card evidence stays separable/auditable.
3. Rebuild the graph from `load_student_events(...)` and save, matching the
   pattern `/record-outcomes` already uses. **Delete the hand-written mastery
   assignment entirely.**

### Contract — keep the response key populated
`updatedConceptMastery` is consumed by the frontend (`app/src/lib/mlApi.ts:115`).
Keep the key and the `Record<string, number>` shape, but populate it from the
**rebuilt graph's** mastery values rather than the raw aggregate. Same shape, now
truthful. `styleScores` is unchanged.

`aggregate_to_concept_mastery` stays as-is and remains useful for diagnosis — it
is simply no longer the thing that writes mastery.

### Verify
- `ml/tests/test_submit_answer_event.py`:
  - A `/submit-answer` call appends exactly one interaction per affected concept
    at weight 0.4 with `source="card"`.
  - **The regression that matters:** mastery after `/submit-answer` survives a
    subsequent graph rebuild (previously it did not).
  - `updatedConceptMastery` is non-empty and matches the rebuilt graph.
- `python scripts/end2end.py` → 85/85.

---

## Definition of done

- [ ] B0, B2, B3a, B1, B4 — one commit each, in that order.
- [ ] 6 new test files pass; full `pytest tests/ -q` green; `end2end.py` = 85/85.
- [ ] **Headline regressions demonstrated in the PR body:**
      alternating win/loss converges to 0.5 (not 1.0) · difficulty is
      order-independent · an `easy`-only concept is no longer trimmed ·
      `/submit-answer` mastery survives a rebuild.
- [ ] Chain-length delta and prune-behavior delta reported for the test student.
- [ ] B3b's two options and issue #14 appended to `ENGINE_MECHANISM.md` bucket C /
      dead-code. Nothing from bucket C built.
- [ ] `git diff --stat` shows `ml/**` only.

**Not deployed by this build.** `mindcraft-ml` deploy is manual
(`ml/scripts/deploy_hf.sh`) — Blake's call. Note B2 changes stored
`ingredient_states` doc shape (additive, back-compat via `ensure_posterior`), so
deploy engine and let it self-heal before assuming old docs are migrated.
