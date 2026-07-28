# Build File — Concept/Ingredient Classification Fix

**Lane:** Engine (`ml/**`). **Owner:** Blake. **Implementer:** Cursor/Codex.
**Architect:** Opus (this file — no code).
**Why now:** combinations testing is blocked on this. See "Evidence" below.

---

## The problem (measured, not guessed)

Ran `ml/scripts/test_concept_paths.py` on the 15-question harness (2026-07-24):

```
Mean recall (no combinations):    0.190
Mean recall (with combinations):  0.190   ← identical
Combinations impact: +1 helped (order only) | 0 hurt | 14 no change
```

Combinations look inert — but they aren't the problem. They can only reorder /
co-fire ingredients **within a correctly-classified concept**. The recall floor
is driven by the classifier picking the **wrong concept entirely**:

- Q1 "3, 8, 14, 21, 29, ___" (a **sequences** problem) → engine fires
  `number_properties__factor_*`. Recall 0.0.
- Q14 (rational expressions) → 0.0 / 0.0.
- Q15 (functions) classifies right → 0.5 precision / 0.667 recall.

**Combinations cannot be evaluated or tuned until classification recall comes
up.** Fix classification first; re-measure combinations after.

## Root cause (pinpointed)

`classify_problem()` (`mindcraft_graph/engine/ingredient_runtime.py:100`) is pure
cosine similarity: one problem embedding vs. one **concept vector**. That concept
vector is built by `make_concept_text()`
(`mindcraft_graph/representation/embeddings.py:42`) from **name + description
only**:

```python
return f"{concept.name}. {concept.description.strip()}"
```

A single description sentence is not discriminative enough to separate 42
concepts. "Find the next term in a sequence" does not embed near a terse
"Sequences and patterns" description, but *does* embed near number-property
description text. That mismatch is the recall floor.

Secondary signal already exists but is unused: `classify_problem` computes
`secondary_concepts` (top-3) and throws them away — only `primary_concept` feeds
ingredient selection.

---

## The fix

### Phase 1 — classify against Layer 2 archetypes (deterministic, do this first)

**Root insight: classify to the archetype, not the concept.** An archetype is a
question *pattern* that maps to exactly one `primary_concept_ids` and a fixed
`required_ingredient_ids` set. Matching a problem against 84 specific patterns is
far more discriminative than against 42 thin concept descriptions — and it hands
you the concept AND the ingredients for free, which is the fix to the
"ingredients are confounding" problem (ingredients become an *output* of the
match, never the basis of it).

Proof this targets the measured failure: Q1 ("3, 8, 14, 21, 29, ___") maps to
archetype `growing_difference_sequence_next_term` →
`concept_path_template: ["sequence recognition","successive differences",
"difference pattern","next-term prediction"]` → `sequences_series`. Matching Q1
against that pattern text classifies it right instead of `number_properties`.

Layer 2 (`02_question_archetype_ontology_*.json`, 84 archetypes) is **already
authored but not loaded by the engine** (`serve.py` loads L1 only). Wiring it in
IS the fix. Concretely:

- **Build an archetype-exemplar matcher.** For each archetype, assemble matchable
  text from `concept_path_template` + `difficulty_drivers` + `canonical_tags`
  (+ real seed stems joined via `evidence_from_seed_questions` → Layer 3, if you
  want stronger exemplars — same L3 join `ml/generation/essence.py` already does;
  reuse it). Embed each archetype (multi-exemplar: match the problem on the **max**
  similarity across a concept's archetypes, not one averaged blob).
- **Resolve match → concept + ingredients** via the archetype's
  `primary_concept_ids` / `required_ingredient_ids`. This replaces the
  concept-description cosine in `classify_problem`.
- **Coverage fallback (required):** archetypes cover **28 of 42 concepts**. The 14
  uncovered (calculus + advanced: `derivatives`, `integrals`, `limits_continuity`,
  `rational_expressions`, `factoring_polynomials`, `vectors`, …) fall back to
  enriched fallback text inside the separate classification-index builder using
  ingredient `label`s and any available L3 example stems. Never crash, never drop
  a concept.
- The embedding cache is baked at build/startup (`representation/embeddings.py`,
  Dockerfile bakes it, self-invalidates on mismatch). The cache key MUST change
  when the archetype/concept text source changes, or prod serves stale vectors.

> This layer is also what makes ingredient-targeted **generation** verifiable
> later (classify a generated question → confirm it fires its target ingredient).
> That's the phase-2 dependency; see the note at the bottom.

### Phase 2 — multi-concept tags (gated)

A question can legitimately belong to more than one concept. Those extra tags are
not noise — they are **the mechanism that lets one question surface (and be
themed) under multiple concepts.** Same question under `linear_equations` wears
the linear story; under `functions_basics` it wears the functions story. Theme is
a serve-time function of (concept-context × question) — already keyed that way in
`webhook/api/story-module.ts` (`cacheDocId(conceptId, questionId)`). Classification
is what produces the tags that make a question *eligible* to appear under each
concept in the first place.

- When `secondary_concepts[0]`'s similarity is within a margin `τ` of the primary,
  emit it as an additional concept tag AND let it contribute target ingredients.
- **Gate it.** Widening the active set inflates recall while tanking precision.
  Expose `τ` as a config constant, sweep it, pick the value that improves **F1 and
  order**, not recall alone.
- **Downstream implication (flag, do not build here):** the bank tags one concept
  today (`app/src/lib/questionBank.ts` — `conceptId: string`). Consuming
  multi-concept tags for per-concept theming needs `conceptId` →
  `conceptIds: string[]` (or a tags layer) on the Product side. That is a separate
  Lane-B change; this build only needs to *emit* the multi-concept set. Do not
  touch the bank schema from Engine lane.

**Keep intrinsic vs. contextual separate.** Ingredients + concept tags are
intrinsic question metadata (this phase produces them). Theme/story is contextual,
applied at serve time by story-module. Never bake a story into a question or into
generation — a multi-concept question must be able to wear a different story per
context.

### Phase 3 (fallback only) — LLM classify bookend

Only if Phase 1+2 don't clear the bar. Add a Groq classify step
(`LLM_PROVIDER=groq` already set in `ml/.env.local`) that picks concept(s) from
the problem text. Cost: latency + nondeterminism on a hot path — which is exactly
what the deterministic-spine architecture avoids. Do not reach for this first.

---

## Implementation contracts (v2 — resolves Codex review)

These make the build unambiguous. Treat them as binding.

### C-A. Embed by shape, resolve by link

Build each archetype's matchable text from its **descriptive** fields only:
`concept_path_template` + `rewrite_template` + `difficulty_drivers` +
`canonical_tags`, plus real seed stems joined via `evidence_from_seed_questions`
→ Layer 3. **Never** put `archetype_id`, `question_family`, `primary_concept_ids`,
or `bridge_concept_ids` into the embedded text — those are keys/links. After a
match, the archetype's `primary_concept_ids` + `required_ingredient_ids` +
`bridge_concept_ids` are carried as **resolution metadata** on the result.

### C-B. A real classification result (archetype ingredients need somewhere to go)

Today ingredients are derived from `primary_concept + features`
(`ingredient_pipeline.py:45`), discarding the archetype's own
`required_ingredient_ids`. Introduce a `ClassificationResult` (new dataclass, or
new fields on `ProblemFeatures`) carrying: `concept_ids` (ordered),
`required_ingredient_ids` (from the matched archetype), `archetype_id`, and the
match `scores`. `select_target_ingredients()` must **prioritize the matched
archetype's `required_ingredient_ids`**, falling back to concept-wide
`features`-based selection **only** for fallback (non-archetype) classifications.

### C-C. Separate classification index — do NOT touch `concept_embeddings.npz`

`concept_embeddings` are load-bearing far beyond classification (PCA, student
embeddings, planning, recommendation scoring). Overwriting `make_concept_text()`
or the canonical `.npz` would silently perturb all of those. **Build a new,
separate `classification_index`** (own cache file) containing: archetype exemplar
vectors + their resolution metadata; enriched fallback vectors for the 14
archetype-uncovered concepts; and a `{source_hash, representation_version}` header
so it self-invalidates. `concept_embeddings.npz` stays the canonical concept-space
representation, untouched. `make_concept_text()` is extended only if the fallback
path needs it — and if so, the concept-space consumers must be re-baked
deliberately, not incidentally.

### C-D. Harness needs a classifier-mode switch (baseline must be reproducible)

The harness currently toggles combinations only; both runs use the same classifier
(`test_concept_paths.py:251`), so "old vs. new classifier" isn't reproducible. Add
`--classifier concept|archetype` (default `concept` = today's behavior) so the
before/after is a flag, not a manual snapshot. All four cells (classifier × combos)
must be runnable.

### C-E. Phase 2 selection semantics (exact)

- `τ` means `primary_score − candidate_score <= τ` (a margin, not an absolute).
- Compare on **archetype match scores**, not concept-level max.
- **Dedupe** multiple archetypes resolving to the same concept (keep the
  highest-scoring).
- A secondary concept contributes **its winning archetype's
  `required_ingredient_ids`**, not all of that concept's ingredients.
- Cap emitted concepts at **`MAX_CONCEPTS` (start = 3)**; expose as config.

### C-F. Concept-ID integrity (at index-build time)

Layer 2 has been canonicalized so every `primary_concept_ids` and
`bridge_concept_ids` value is an existing Layer 1 concept ID. Treat both fields
as foreign keys into the same Layer 1 registry. During index construction,
validate every reference and **fail fast** on any unresolved ID; never drop a
primary or bridge concept silently. This prevents older name-derived slugs from
re-entering the runtime vocabulary.

### C-G. `build_essence()` is a starting point, not a drop-in

`build_essence()` produces *concept*-level example collections; it does **not**
emit *archetype*-keyed exemplars. Extend the L3 join to group seed stems by
archetype (via `evidence_from_seed_questions`), rather than treating it as
directly reusable.

---

## Measurement protocol (this is half the task)

1. **Build a ~50-question test set** (≤ 50 so every result stays eyeball-readable)
   in `ml/data/sample_questions/`. Compose it deliberately, not randomly:
   - **(a) Broad spread** — cover many *distinct* concepts (target 20+ different
     concepts) so recall isn't measured on a narrow slice.
   - **(b) Ingredient-overlap clusters (the real stress test)** — include ≥ 2
     clusters of concepts that **share ingredients** via bridges / `comes_from`
     (e.g. `linear_equations` ↔ `systems_of_linear_equations` ↔ `functions_basics`
     share manipulation ingredients; pick bridge-connected neighbors from L1).
     This is the exact case where ingredient-basis matching confounds and
     archetype-basis matching should NOT. If the classifier keeps these separated,
     the archetype approach is doing its job; if it collapses them, it isn't.
2. Report **precision AND recall AND order agreement**, `--classifier concept`
   (baseline) vs. `--classifier archetype` (new) per C-D, per question and
   aggregate — the harness already emits all three. Do **not** report recall alone.
3. **Per-cluster separation check** — for each overlap cluster in (b), report
   whether questions from concept A still classify to A (not to its ingredient-
   sharing neighbor B). This is the pass/fail that validates the whole
   archetype-over-ingredient thesis; call it out explicitly in the results.
4. Keep the existing **with/without-combinations** comparison intact. The goal is
   to see combinations *start to matter* once classification is fixed — that's the
   signal this unblocked the combinations work.
5. Commit the before/after aggregate numbers + the per-cluster separation results
   in the PR description.

## Acceptance criteria

- Mean recall on the ~50-question harness materially above the 0.190 floor
  (target a first milestone of ≥ 0.40; iterate from there — this is a headroom
  problem, not a one-shot).
- Precision does **not** collapse as recall rises (report both; F1 up).
- **Ingredient-overlap clusters stay separated** — questions from ingredient-
  sharing concepts still classify to their own concept, not their neighbor. This
  is the core validation of the archetype-over-ingredient approach; a fix that
  raises recall but collapses overlapping concepts has NOT succeeded.
- The `secondary_concepts` gate `τ` is a swept, documented constant — not a magic
  number.
- Classification stays deterministic and auditable (Phase 1/2). No LLM on the
  classify hot path unless Phase 3 is explicitly greenlit.
- `python scripts/end2end.py` still green.

## Files in play

- `mindcraft_graph/engine/ingredient_runtime.py` — `classify_problem`,
  `select_target_ingredients` (secondary-concept gating).
- `mindcraft_graph/representation/classification_index.py` — archetype/fallback
  exemplar building, source hashing, cache serialization.
- `mindcraft_graph/models/ingredient.py` — internal classification result fields.
- `mindcraft_graph/engine/ingredient_pipeline.py` — classification-index and
  required-ingredient handoff.
- `ml/serve.py` / `ml/Dockerfile` — runtime load and baked classifier cache.
- `ml/generation/essence.py` — **reuse** `build_essence()` for example stems.
- `ml/scripts/test_concept_paths.py` — harness (scale inputs, keep metrics).
- `ml/data/sample_questions/` — add ~35 more tagged questions.
- `ml/tests/test_classification_index.py` — index, cache, gating, and handoff tests.

## Guardrails

- **Deterministic engine stays deterministic** (`CLAUDE.md` style rules). The fix
  is a better *representation*, not a learned model or an LLM in the loop.
- Don't touch the served `Question` shape or anything the frontend bank consumes —
  this is classification internals only.
- Classification-index changes must self-invalidate the baked cache, or prod
  serves stale vectors. Canonical `concept_embeddings.npz` remains untouched.

## Explicitly out of scope

- Combinations tuning — deferred until this lands and is re-measured.
- Story-themed / ingredient-targeted question **generation** — separate build
  file, separate decision (story theming already happens at serve time via
  `/story-module`; see `STORY_LAYER_RECONCILE.md`).

---

## Implementation results (2026-07-25)

The deterministic archetype classifier is implemented with a separate,
source-hashed cache. The measurement corpus contains 50 questions across 24
concepts, including 12 algebra/functions overlap questions and 6
rates/units/representation overlap questions.

| Classifier | Combinations | Precision | Recall | Order agreement |
|---|---:|---:|---:|---:|
| concept baseline | off | 0.182 | 0.229 | 0.093 |
| concept baseline | on | 0.182 | 0.229 | 0.080 |
| archetype | off | 0.393 | 0.440 | 0.200 |
| archetype | on | 0.388 | 0.433 | 0.240 |

- Concept-tag accuracy: **64% → 100%**.
- Algebra/functions cluster separation: **12/12**.
- Rates/units/representation cluster separation: **6/6**.
- Combinations changed from `1 helped / 1 hurt / 48 unchanged` to
  `5 helped / 5 hurt / 40 unchanged`; they are no longer inert, but remain a
  separate tuning lane.
- `τ` sweep: `0.00`, `0.05`, and `0.10` produced identical aggregate results on
  this corpus. Pin **`SECONDARY_CONCEPT_MARGIN = 0.00`** as the conservative edge
  of the observed plateau; `MAX_CONCEPTS = 3` remains the cap.

### Generalization audit

The main table measures the production index against the known Layer 3 bank, so
its seed exemplars are legitimately available at runtime. The harness also has
`--exclude-evaluation-seeds`, which removes each evaluated question instance
from the exemplar index. That stricter leave-one-instance-out audit did **not**
clear the milestone: precision `0.173`, recall `0.242`, order `0.080`, and concept
accuracy `42%` without combinations. Treat the `0.440` result as known-bank
classification performance, not evidence that arbitrary new/generated questions
generalize equally well. Improving held-out generalization remains required
before using this classifier as a verifier for generated questions.
