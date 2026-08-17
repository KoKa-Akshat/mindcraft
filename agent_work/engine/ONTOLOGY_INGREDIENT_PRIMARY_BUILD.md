# BUILD — Make ingredients primary, concepts a derived view

**Status:** staged plan, Stage 1 ready to implement. **Written 2026-08-16.**

**Goal (stated by Blake):** Level 3 books that evolve with the student, pinpoint
shortcomings, a predictor that works, and better mastery updates. Every stage
below is justified against that, not against tidiness.

**Lane: Engine.** Stages 1–3 touch `ml/**` only. Stage 4 changes what
`/recommend` and `/knowledge-graph` compute — but **not their response shape**,
so `app/**` and `ios-prototype/**` need no change at any stage. That is the
central design constraint of this plan.

---

## 1. The problem, stated once

The ontology is a **flat list of 42 concepts with no containment relation**.
Verified: every concept is `node_type: "concept"`; `level`
(foundational/core/advanced/cross_cutting) is a difficulty tier, not a hierarchy;
there is no `parent`, `part_of`, or `children` field anywhere.

But the domain *is* hierarchical — `factoring_polynomials` is part of
`algebraic_manipulation`. With nowhere to say so, every downstream join has to
pick one flat bucket, and the cost compounds:

1. flat ontology, no containment
2. → 163 Eedi SubjectNames get crushed onto 26 concepts by a hand-written
   `SUBJECT_MAP` ([`ingest_eedi.py:37`](../../ml/scripts/ingest_eedi.py#L37)) —
   `number_properties` absorbs 20 subjects, `fractions_decimals` 14
3. → each misconception inherits that bucket as its `concept_ids`
   ([`ingest_eedi.py:668`](../../ml/scripts/ingest_eedi.py#L668)), often at the
   wrong granularity
4. → because slugs embed the concept (`mis_{concept}__{name}`), **205 of 1,437
   Eedi misconceptions (14.3%) split into multiple concept-scoped identities**,
   one across 11 concepts
5. → the enrichment pipeline is confined to that concept's ingredients — **86.6%
   of misconceptions were matched against ≤6 candidates, median 5**
6. → with no abstention allowed, a bad candidate pool guarantees a wrong
   assignment. 25% of the ontology's own anchors are unreachable this way.

**Ingredients do not have this problem.** There are **179 ingredients against
Eedi's 163 subjects** — the same granularity. The concept layer is the only
place a lossy collapse was ever forced.

### Why this blocks the stated goal

- *Pinpoint shortcomings*: diagnosis resolves to an ingredient. Half the
  ingredient links are `llm`-provenance at 0.545 agreement precisely because the
  candidate pool was wrong, not because the matcher was bad — within its
  constraint the embedding pass scored `same_concept_rate: 1.0`.
- *A predictor that works*: the current predictor has no per-item signal at all
  (`b` is keyed per **concept**, `replay.py:95`), and `format_weight` failed
  because format mastery is a global node. Ingredient membership is the missing
  per-item feature.
- *Better mastery updates*: concept mastery is currently primary and ingredient
  mastery is second-hand (enters at `exposure_weight` 0.15). That is backwards
  once ingredients are the reliable unit.

---

## 2. What makes this cheap: concepts stay in the contract

**Concepts are not deleted. They become a derived projection over ingredients.**

The machinery already exists.
[`aggregate_to_concept_mastery`](../../ml/mindcraft_graph/engine/ingredient_runtime.py#L820)
already computes a concept's mastery from its ingredients, weighted by
connectivity — and its docstring already states the single-source-of-truth
discipline this plan depends on.

Measured blast radius:

| Surface | Refs | Changes? |
|---|---|---|
| `conceptId` in `app/src/**` | 956 in 83 files | **none** |
| `concept_id` in `ml/mindcraft_graph/**` | 258 in 26 files | few |
| `mastery_by_concept` | 62 | Stage 4 only, derivation not shape |
| `Ingredient.concept_id: str` | **1 field** | → `concept_ids: list[str]` |
| `get_concept_ingredients()` | 4 call sites | index build only |
| Layers 2–5 (`ingredient_id` refs) | — | **none** — ids are frozen (§3) |

The core schema change is **one field and one index**. The expensive part is
data annotation, not code.

---

## 3. Frozen: ingredient IDs are opaque

`{concept_id}__{slug}` stops being a containment claim and becomes a historical
name. **Do not re-mint ingredient ids.** They are join keys in the Layer 2–5
canonical ID contract, `misconception_ingredient_map.json`, the question bank,
and `eedi_misconceptions.json`; re-minting breaks all of them for zero benefit.

The prefix is already unreliable — **18 of 179 ingredient ids do not match their
concept's root**. Document it as opaque in `CLAUDE.md`'s ID contract section and
move on.

---

## 4. Stages

### Stage 1 — `concept_ids: list[str]` (ready now, zero behaviour change)

`ml/mindcraft_graph/models/ingredient.py:22`: `concept_id: str` →
`concept_ids: list[str]`. Build `IngredientGraph.by_concept`
(`ingredient_graph.py:~35`) by iterating membership instead of assigning once.
Keep a `concept_id` property returning `concept_ids[0]` so existing readers
compile.

Loader emits a **single-element list** for every ingredient, so this stage is a
pure refactor: `end2end.py` stays 85/85 and no recommendation changes. **Ship it
alone**, verify nothing moved, then proceed. Do not bundle Stage 1 with Stage 2.

### Stage 2 — populate multi-membership (the real work)

For each of the 179 ingredients, decide which concepts it belongs to.

**Do not assume the LLM is unfit for this.** The 0.545 figure comes from a
*different task* — misconception → ingredient, against a bespoke vocabulary,
five candidates, no abstention. Stage 2 asks *"is `factoring_polynomials` part of
`algebraic_manipulation`?"*, which is closer to general domain knowledge. Carrying
the score across those two tasks is not justified.

The one caveat worth holding: B5's **same-concept-eligible** column already
controls for the constraint — it restricts to cases where the right answer *was*
inside the searchable pool, and the LLM scored 0.545 there against a human's
0.928. So structure does not explain the whole gap. But n=22, and it is a
different task. **The evidence cannot settle this. Measure it instead.**

**Method — gated, in this order:**
1. Derive candidate memberships from evidence: `SUBJECT_MAP` shows which Eedi
   subjects already collapse together; ingredients reached by misconceptions from
   >1 subject are multi-concept candidates. Cheap, proposes rather than decides.
2. **Pilot**: have the LLM assign membership for ~40 ingredients against the
   *cleaned* anchor set (Stage 3 cleans them; pull that step forward). Score it.
3. **DECISION — set the gate before running the pilot, not after.** Recommend
   ≥0.85 agreement → the model does all 179 with human spot-check; below → the
   model proposes and humans decide. Write the threshold down first; this repo
   has already been burned by numbers chosen after the fact.

Either way this produces the LLM-vs-human number on the *current* structure,
which is worth having before Stage 3 regardless of which path it selects.

Record a **provenance** per membership, same discipline as the map.

### Stage 3 — remap misconception → ingredient

Rerun `enrich_ingredient_misconception_map.py` with three changes:

1. **Candidate pool** = ingredients of the misconception's concept **plus its
   depth-1 prerequisite concepts**. Measured cost: median pool **5 → 9**
   (mean 11.4, max 25 of 179). Depth 2 nearly triples the pool for **zero**
   additional anchor recovery — depth 1 is the setting.
2. **Abstention is legal.** Returning "no ingredient" must be an allowed
   outcome. Today a bad pool guarantees a wrong answer; this is the single
   biggest quality lever in the stage.
3. **Merge split identities first.** The 205 misconceptions living under
   multiple concept slugs must become one identity with several concept
   associations before "which ingredient does this indicate" is well-posed.

**Clean the anchors before scoring.** The 95 `canonical_misconception_family`
entries are simultaneously the widening evidence and the scoring yardstick, and
of the 22 blocked ones roughly half look wrong on inspection. Cleaning them
after the remap makes the remap unmeasurable.

**Re-measure the provenance baseline on a larger eligible sample than 22**
before and after, or the 0.545 → ? comparison means nothing.

### Stage 4 — invert mastery primacy

Ingredient mastery becomes primary; `mastery_by_concept` becomes a derived view
via `aggregate_to_concept_mastery`. **Response shapes do not change** —
`/recommend`, `/knowledge-graph`, and the frontend keep seeing concepts.

Retire the `exposure_weight` 0.15 discount on ingredient evidence, which existed
because ingredient links were second-hand. That discount is only justified while
Stage 3's quality is unimproved — **re-measure before removing it**, and keep it
if the remap did not move the number.

This is the stage that serves "better mastery updates" and gives the predictor a
real per-item feature. It is also the only stage that can regress live student
mastery, so it ships last and behind a comparison against the current model on
replayed history.

---

## 5. Acceptance criteria

**Stage 1:** `end2end.py` 85/85; `cd ml && pytest` and repo-root `pytest ml/tests`
both pass; **`/recommend` output byte-identical** for a fixed student fixture
before and after. Any diff means it was not a pure refactor.

**Stage 2:** every ingredient has ≥1 concept; every concept has ≥1 ingredient;
every membership carries a provenance; the count of multi-concept ingredients is
reported, not assumed.

**Stage 3:** report **abstention rate** alongside coverage — coverage rising
while abstention is zero means the old failure mode survived. Anchor agreement
re-measured on the cleaned anchor set, split by provenance, never pooled.

**Stage 4:** replay existing student history under both models and compare
Brier + calibration. **Ship only if the derived model is not worse.** Concept
mastery has many consumers (pathfinder trim, exam ranking, learn-next, decay,
displacement, UI) and they all want a stable aggregate.

**The baseline is fixed and pre-registered — 2026-08-16, 2-parameter run,
n=148 learner observations (3 deployment-smoke excluded):**

| metric | value |
|---|---|
| held-out constant | **0.2548** |
| held-out predictor (concept mastery, 2-param) | **0.2552** |
| in-sample | 0.2430 |
| generalization gap | 0.0162 |

**Read this tie correctly — it is NOT evidence for this build's thesis.** In the
2-parameter model the ability term is `concept_weight × concept_mastery` and the
difficulty term is `difficulty_by_concept[cid]` (`replay.py:95` — keyed **per
concept**, not per item). With `level_scale` and `format_weight` pinned to zero,
**no per-item input remains**: every question in a concept receives an identical
prediction. A model with no within-concept resolution tying a constant is the
mundane expected outcome, not a finding about concept granularity.

**Consequence — this is a hard prerequisite, not a follow-up.** Stage 4 cannot
be evaluated on this harness as it stands: ingredient-primary and concept-primary
mastery would both predict identically within a concept, so the comparison could
not detect a difference of any size. **Empirical per-item difficulty must land
before Stage 4 is scored.** Until then 0.2548 is a placeholder baseline, not a
usable bar.

Also note **n=148 with ~54% of rows from one student**. Volume is the other
binding constraint, and the historical duplicate-evidence rows still in Firestore
(28.4% of `attempt_observations`) inflate counts and flatter calibration — clean
them before trusting any comparison.

---

## 6. Explicitly out of scope

- Deleting the concept layer. Concepts stay as a derived view and a presentation
  grouping. Nothing in the goal requires removing them, and 956 frontend
  references say the cost of doing so is unjustified.
- Re-minting ingredient IDs (§3).
- Adding a concept containment hierarchy. Multi-membership on ingredients
  expresses what containment was needed for, without a second graph to maintain.
- Rewriting `SUBJECT_MAP`. After Stage 2 it stops being load-bearing — the
  granularity mismatch it was papering over is gone.
- The generation pipeline, the classifier, and the bank index.

---

## 7. Sequencing note

Stage 1 is safe and independent — it can ship while Stage 2's annotation is in
progress. Stages 3 and 4 are strictly ordered after 2. **The
`FIRESTORE_SILENT_FAILURE_BUILD` and the 2-parameter predictor experiment are
independent of all four stages** and should not wait on them; the predictor
result in particular is worth having *before* Stage 4, since it establishes the
baseline Stage 4 has to beat.
