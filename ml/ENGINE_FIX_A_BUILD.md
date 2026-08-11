# BUILD — Engine Bucket A (mechanical fixes, no pedagogical decisions)

**Lane: Engine (Blake).** Every file below is under `ml/**`. **Zero** `app/**`
files. No API request/response shape changes. No Firestore migration (all new
fields are optional with defaults). No ontology JSON edits.

**Source:** `ml/ENGINE_MECHANISM.md` § *Issues to look into*, bucket A.
**Scope discipline:** do exactly these four. Do NOT fix bucket B/C items you
notice while in these files — log them instead.

**Preconditions**
```bash
cd ml && source mindcraft/bin/activate
python scripts/end2end.py          # must be 85/85 BEFORE you start
```

---

## A1 — Edges must decay toward their real prior (issue #4)

**Bug:** `decay_edge` doesn't know an edge's original prior, so it hardcodes one
per relation (`prerequisite → 0.9`). Bridge-derived prerequisite edges carry
ontology strengths of ~0.4–0.8 (`1 − avg bridge difficulty`), so their evidence
rots toward **0.9** — an attractor they never started at. Edge weight drifts
upward with disuse, which is the opposite of the intended "fade to the prior."

### Files
- `ml/mindcraft_graph/engine/edge_weights.py`
- `ml/mindcraft_graph/engine/decay.py`

### Change 1 — persist the prior on the edge
In `EdgeState`, add:
```python
prior_mean: float | None = None   # ontology strength this edge was seeded from;
                                  # None = legacy doc, fall back to relation estimate
```
Optional-with-default is required: `EdgeState` is serialized into
`knowledge_graphs/{uid}` and existing docs have no such key.

### Change 2 — set it at both creation sites
1. `initialize_edge_from_ontology()` → `prior_mean=edge.strength`.
2. The `discovered` edge minted inside `update_edges_from_events()` (α=β=1) →
   `prior_mean=0.5`. **Don't miss this one** — it does not route through
   `initialize_edge_from_ontology`, which is also why
   `PRIOR_PSEUDO_COUNTS` has no `discovered` key.

### Change 3 — use it in decay
In `decay_edge()`, replace the hardcoded relation→prior_mean ladder with:
```python
prior_mean = edge.prior_mean if edge.prior_mean is not None else <existing ladder>
```
Keep the existing ladder verbatim as the legacy fallback — do not delete it, and
keep `pseudo_total = PRIOR_PSEUDO_COUNTS.get(edge.relation, 2.0)` as-is.

### Verify
- New test `ml/tests/test_edge_decay_prior.py`:
  - An edge seeded at `strength=0.45` with heavy α-evidence, decayed 10 half-lives,
    converges to `weight ≈ 0.45` (±0.02) — **not** 0.9.
  - An `EdgeState` built without `prior_mean` (legacy) reproduces today's numbers
    exactly (regression guard on the fallback).
  - A `discovered` edge converges to `0.5`.
- `python scripts/end2end.py` → still 85/85.

---

## A2 — Bridge confidence must start at the ontology prior (issue #9a)

**Bug:** per-student bridge confidence defaults to `0.0` and climbs `+0.15` per
success, so **5 consecutive wins** are needed to clear the `0.7`
`WEAK_BRIDGE_THRESHOLD`. Consequence: essentially every bridge a student has ever
touched reports as a Tier-1 ("earned evidence") gap at high severity. The concept
layer already does this correctly — the ontology is the prior — and the ingredient
layer just never got the same treatment. The ontology ships the prior we need:
`Bridge.confidence = 1 − difficulty`.

### Files
- `ml/mindcraft_graph/engine/ingredient_runtime.py`

### Change 1 — one helper, because bucket B will reuse it
Add near the other bridge helpers:
```python
def bridge_prior_confidence(bridge: Bridge) -> float:
    """Per-student starting confidence for an unattempted bridge.

    The ontology is the prior (same doctrine as edge_weights.initialize_edge_
    from_ontology). Issue #9b will replace the additive update rule with a
    Beta posterior — it should seed its prior from THIS function, not re-derive it.
    """
    return bridge.confidence
```

### Change 2 — read the prior in the DAG
In `build_minimal_dag()`, the `for bridge in used_bridges:` loop currently does:
```python
confidence = bridge_state.confidence if bridge_state is not None else 0.0
```
→ fall back to `bridge_prior_confidence(bridge)` instead of `0.0`. The `bridge`
object is already in scope.

### Change 3 — seed the stored record on first write
`update_ingredient_state()` constructs a fresh `BridgeConfidence(...)` (default
`confidence=0.0`) the first time a bridge is answered. Add an optional parameter:
```python
def update_ingredient_state(..., prior_confidence: float = 0.0):
```
and use it as the initial `confidence` for a newly created record. Callers with
graph access pass `bridge_prior_confidence(bridge)`; the default keeps every
existing caller (including `serve.py`'s misconception path, which fires on
*ingredients* not bridges) byte-identical.

### Explicitly do NOT change
`_detect_bridge_gaps()` in `api/recommend.py`. Its Tier-1 branch is gated on
`bc.attempts > 0`, so a seeded prior with zero attempts still correctly routes to
the Tier-2 hypothesis path. Thresholds stay where they are.

### Verify
- New test `ml/tests/test_bridge_prior.py`:
  - An unattempted bridge with ontology `difficulty=0.4` yields DAG edge
    `confidence == 0.6` and `need_score == 0.4` (was `0.0` / `1.0`).
  - A bridge with recorded attempts is unaffected by the prior.
  - `update_ingredient_state` with default args produces today's exact values.
- `python scripts/end2end.py` → 85/85.
- Report the before/after count of Tier-1 bridge gaps for test student
  `gBFn9vUGIIa7tAiTTQSl8CbPSao2` (expected: fewer, and less severe).

---

## A3 — Remove genuinely dead code, keep parsed data (issues #2, #3)

**Scope narrowed from the original triage — read this before deleting.**

### Delete: `ConceptProfile.adjusted_strength`
`ml/mindcraft_graph/engine/features.py:61`. Verified zero references across
`ml/`, `app/src`, `webhook/`. It multiplies strength by a difficulty proxy that
is currently just the concept's index in the JSON array (issue #6), so it is
both unused *and* meaningless until #6 lands. Delete the property.

### Do NOT delete: `Combination.spans_concepts`, `Combination.captured_by_dependency_or_bridge`
My triage said "delete"; that was wrong. `spans_concepts` **is** consumed —
`ml/scripts/canonicalize_concept_ids.py:69` treats it as a concept-id-bearing
field to rewrite, and `ml/scripts/reconcile_ontology.py:219` reports on it.
Dropping the model field would silently desync the runtime model from a JSON
field that tooling still maintains, and `captured_by_dependency_or_bridge` is a
data-quality flag (marks combos redundant with existing edges) worth keeping.

Instead, in `ml/mindcraft_graph/models/ingredient.py`, add one comment above the
two fields:
```python
# Parsed and preserved, not read at runtime. spans_concepts is maintained by
# scripts/canonicalize_concept_ids.py + reconcile_ontology.py;
# captured_by_dependency_or_bridge flags combos redundant with existing edges
# (a candidate firing filter — see ENGINE_MECHANISM.md issue #3).
```
This is the point of the item: stop the next reader re-deriving that they're unused.

---

## A4 — Delete the legacy ingredient alias map (issue #11a)

**Proof it is dead** (re-verified against the live ontology):
- All **42/42** concepts have their own ingredients, so `alias_concept_id()`
  returns its input on the first branch, every time. The map is unreachable.
- Worse, **16 of its 17 keys are real canonical concept ids**
  (`trigonometry_basics`, `functions_basics`, `polynomials`, …). It is a latent
  landmine: the day any concept's ingredients are removed or renamed,
  `get_concept_ingredients()` starts silently serving *another concept's*
  ingredients — into `/knowledge-graph`'s per-node ingredient list and the
  ingredient runtime's target selection. Failing loudly (empty list) is correct.

### Files
- `ml/mindcraft_graph/engine/ingredient_graph.py`

### Change
Delete the `CONCEPT_ID_ALIASES` dict and the `alias_concept_id()` method, and
reduce `get_concept_ingredients()` to a direct lookup:
```python
def get_concept_ingredients(self, concept_id: str) -> list[Ingredient]:
    """Return all ingredients belonging to a concept ([] if it has none)."""
    return self.by_concept.get(concept_id, [])
```
`alias_concept_id` has **no callers** outside this one method (verified across
`ml/`). The frontend's `BANK_ALIASES` in `app/src/lib/questionBank.ts` is a
*different*, load-bearing map — **do not touch it**, it's the Product lane and
resolves ontology→question-bank ids, not ontology→ingredient ids.

### Verify
- New test `ml/tests/test_ingredient_graph_no_alias.py`: every concept id in
  Layer 1 returns a non-empty ingredient list; an unknown id returns `[]`.
- `python scripts/end2end.py` → 85/85.
- Card-path harness unchanged:
  ```bash
  python scripts/test_concept_paths.py \
    --complete-ontology data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json \
    --questions data/sample_questions/first_15_questions.csv
  ```

---

## NOT in this build — #13 is fenced by a prior decision

Issue #13 (concept embedding text is `population_failure_prior.notes`, not a
description) was already litigated. `CLASSIFICATION_FIX_BUILD.md` § C-C:

> **"Separate classification index — do NOT touch `concept_embeddings.npz`."**
> `concept_embeddings` are load-bearing far beyond classification (PCA, student
> embeddings, planning, recommendation scoring)… `make_concept_text()` is extended
> only if the fallback path needs it — and if so, the concept-space consumers must
> be re-baked **deliberately, not incidentally.**

That decision was implemented: production runs `classifier_mode="bank"` (k-NN over
tagged bank questions, 0.80 held-out top-1), which **never reads concept text**. So
the original motivation for #13 is already resolved by routing around it.

What remains downstream of the failure-note text is the concept *space* itself:
the 4 PCA axes and their documented labels, map x/y coordinates, student
mastery/strength embeddings and displacement, alignment scores, and explore-mode
ranking. Changing the text re-bakes all of it and invalidates the axis labels in
`api/recommend.py::DEFAULT_AXIS_LABELS`. **Out of scope here** — it needs its own
build file with a re-derivation and re-labeling step.

---

## Definition of done

- [ ] A1–A4 implemented, each as its own commit.
- [ ] 4 new test files pass; `python scripts/end2end.py` = 85/85.
- [ ] Card-path harness output unchanged vs. the pre-change run (attach both).
- [ ] Tier-1 bridge-gap count before/after reported for the test student.
- [ ] No file outside `ml/**` modified (`git diff --stat` in the PR body).
- [ ] Bucket B/C items noticed in passing are logged to
      `ENGINE_MECHANISM.md`, not fixed.

**Not deployed by this build.** `mindcraft-ml` deploy is manual
(`ml/scripts/deploy_hf.sh`) — leave it to Blake.
