# Build File — Concept Placement via Bank k-NN (supersedes archetype classifier for the concept decision)

**Lane:** Engine (`ml/**`). **Owner:** Blake. **Implementer:** Cursor/Codex.
**Architect:** Opus (this file — no code).
**Continues:** `CLASSIFICATION_FIX_BUILD.md`. That build shipped the archetype
classifier; this build fixes the one thing it got wrong (held-out concept
placement) and keeps the one thing it got right (archetype → ingredient/path
extraction). Read that file first.

---

## The problem (measured, not guessed)

The archetype classifier's headline numbers were measured on **training data**.
The 50-question audit corpus is 100% Layer-3 seed instances (`50/50`
`question_instance_id`s are in L3), so every evaluated question had a
byte-identical copy of itself in the index as a `::seed` exemplar (cosine ≈ 1.0).
The honest, leak-free numbers:

| Classifier (leak-free) | Concept-tag accuracy | Ingredient recall |
|---|---:|---:|
| concept baseline (name+desc cosine) | 0.64 | 0.229 |
| archetype **held-out** (`--exclude-evaluation-seeds`) | **0.42** | 0.242 |

Held-out, the archetype classifier is **worse than the old concept baseline** at
getting the concept. It only looked better because `::seed` entries memorized the
eval questions. Root cause: `::shape` exemplars embed L2 *pattern prose*
(`concept_path_template + difficulty_drivers + …`), which is a different genre
from a raw question stem — a stem does not embed near a solve-path description.
59/84 archetypes have a single `::seed`, so stripping it leaves only the
genre-wrong `::shape`.

## The fix (measured to work)

Place the question to a **concept** by weighted k-NN over the **existing tagged
question banks** — thousands of real, concept-tagged, same-genre stems — instead
of against archetype prose. Measured on a genuinely disjoint train/test split of
the banks (`ml/scripts` scratch probe, 1,714 questions, 23 concepts):

| method | held-out top-1 concept | top-3 |
|---|---:|---:|
| weighted k-NN, k=5 | **0.802** | 0.917 |
| weighted k-NN, k=10 | 0.779 | 0.926 |
| majority-class baseline | 0.15 | — |

That is a decisive, honest, held-out win over both 0.42 and 0.64. The banks are
the empirical "essence" of each concept; you place a new question among its real
neighbors and read the concept off the crowd.

**Scope of the 0.80:** it is measured on the **23 bank-covered concepts** only,
within-distribution (Eedi is GCSE-style; concept tags are valid but real ACT
stems carry residual style-confounding / OOD risk). Aggregate accuracy over all
42 concepts will be lower — the ~18 non-bank concepts fall to baseline fallback
(C-6), and rare concepts (7–18 exemplars) score well below 0.80 while dense ones
(254) score above. Report per-concept, not just aggregate.

**Live consumer (concrete value today):** `classify_problem` feeds
`/recommend-ingredients` — the homework fallback that is **live now** (Anthropic
credits exhausted). `/recommend` uses the graph pathfinder, not text
classification. So this build's standalone payoff is a better homework-fallback
concept decision, independent of the still-unvalidated ingredient half.

### Why this leaves the extraction half untouched (important)

The archetype layer stays — it is still how ingredients/path get extracted
(`select_target_ingredients(required_ingredient_ids=…)`). What changes is **only
the concept decision**: bank k-NN decides the concept; the archetype match then
runs *within that concept* to hand over `required_ingredient_ids` +
`concept_path_template`. This is a **two-stage placement**:

```
raw stem
  Stage 1  PLACE→concept     weighted k-NN over bank exemplars (dense, 0.80)
  Stage 2  PLACE→archetype    match ONLY the winning concept's archetypes → extract
           EXTRACT            required_ingredient_ids + concept_path_template
```

Stage 2 is a 1-of-few decision (a concept has ~2–4 archetypes), so even the
sparse single-seed archetypes are usable once Stage 1 has narrowed the field.

---

## Implementation contracts (binding)

### C-1. Bank exemplars are a new entry KIND in the existing index
Extend `classification_index.py`, do **not** fork it. Add a `kind="bank"` entry:
`{ entry_id, concept_ids=(conceptId,), required_ingredient_ids=(), archetype_id="",
vector, kind="bank" }`. Bank entries carry **concept only** (the banks have no
ingredient/archetype tags — verified: Eedi/actMaster are `conceptId`+`format`
only). They are Stage-1 voters, not extraction sources.

### C-2. Two-stage resolution in `_classify_with_index`
Stage 1: weighted vote of **concept** over the top-k nearest entries (bank +
archetype + fallback), distance-weighted (`w += max(cos, 0)`), producing a
**ranked concept list**. Stage 2: restrict to entries whose `concept_ids` ⊆ the
Stage-1 winner(s), pick the best archetype among them, carry its
`required_ingredient_ids` + `archetype_id` as resolution metadata. If no archetype
exists for the winning concept, fall back to concept-wide feature selection (today's
`fallback` behavior). Expose `k` as config (`KNN_K`, default 5 — swept: 0.80@5 >
0.78@10 > 0.74@20).

### C-3. Multi-concept: ontology-gated, ingredient-soft-weighted (NOT flat top-k)
**Least-grounded contract in this build — ship conservative.** There is no
multi-label ground truth to tune against (same gap as the ingredient layer,
milder), and the ontology gate can *under-emit* legitimate secondaries that are
not declared bridges. Compute the ranked concept list **internally** (it feeds
Stage-2 restriction regardless), but keep secondary *emission* off-by-default /
dark until multi-label data exists. When on:
top-3 recall is 0.92 but emitting a flat top-3 concept set tanks precision (2 of 3
usually wrong). Instead:
- Emit a **secondary concept only if** it is a declared `bridge_concept_id` of the
  matched archetype **or** an L1 `level == cross_cutting` concept. This replaces
  the blind margin `τ` with an ontology constraint (bridges + cross-cutting are the
  concepts that legitimately co-occur).
- Each emitted concept contributes its ingredients **weighted by its Stage-1 k-NN
  mass × the ingredient's own match**; threshold the combined ingredient scores.
  Do not add a secondary concept's ingredients at full weight.
- Cap at `MAX_CONCEPTS` (default 3).
- **Validate the gate:** report how often the k-NN rank-2 concept is in fact a
  declared bridge / cross-cutting vs. an ingredient-sharing sibling (confusion).

### C-4. Canonical-ID normalization at index-build
Every bank `conceptId` must resolve to an L1 concept id via `BANK_ALIASES`
(mirror the frontend map). **Fail fast** on any unresolved id — never silently
split a concept across two labels. Validate the whole bank on build.

### C-5. Held-out split discipline (the whole point)
The eval set MUST be disjoint from the exemplar index. Provide
`--holdout-frac` / a fixed seed split in the harness so exemplars and eval never
overlap. Never again report a number where the eval question is also an index
entry. The banks are large enough (1,700+) to split cleanly; L3's 450 were not.
**Measurement-only:** the split exists in the harness. **Production bakes the
FULL bank** as exemplars (max density) — never hold out exemplars in prod.

### C-6. Coverage is partial by design; keep the fallbacks
Banks populate ~24 concepts. The other ~18 (incl. the 14 archetype-uncovered
calculus/advanced concepts) keep the existing `::shape` / `fallback::` entries.
Bank k-NN is additive density where the banks are dense; it does not replace the
fallback path for sparse concepts.

### C-7. Do NOT touch `concept_embeddings.npz`
Same constraint as `CLASSIFICATION_FIX_BUILD.md` C-C. The classification index is
separate and self-invalidating; the canonical concept-space `.npz` (PCA, student
embeddings, planning) stays untouched. Source-hash the bank files into the index
header so the baked cache self-invalidates when banks change.

### C-8. Extraction stays path-free and structural
The runtime does **not** consume a per-question `concept_path` (confirmed: the
runtime never reads it; it was only the harness's cosine-derived scoring
reference). Keep extraction structural: concept → archetype
`required_ingredient_ids` → prereq DAG order. No LLM and no solution-path parsing
on the serve hot path.

---

## Measurement protocol

1. Held-out bank split (C-5). Report **top-1 and top-3 concept accuracy**, per
   concept and aggregate, `--classifier concept|archetype|bank`. Target: top-1 ≥
   0.75 held-out (probe got 0.80); must beat 0.64 (concept baseline) and 0.42
   (archetype held-out) decisively.
2. Keep the 50-question overlap-cluster separation report (algebra-functions,
   rates-units) — but now on a held-out split, not the leaky corpus.
3. Report the C-3 gate validation (rank-2 = bridge/cross-cutting vs sibling
   confusion).
4. `python scripts/end2end.py` still green.

## Acceptance criteria

- Held-out top-1 concept ≥ 0.75 **on bank-covered concepts**, decisively above
  0.64 and 0.42; per-concept accuracy reported (rare-concept degradation
  surfaced, not hidden in the aggregate).
- Multi-concept gate is **ontology-driven** (bridge/cross-cutting), not a magic
  `τ`; secondary emission validated per C-3.
- Concept placement deterministic and auditable (weighted cosine only; no LLM on
  the classify hot path).
- Extraction path-free per C-8; `concept_embeddings.npz` untouched per C-7.
- `end2end.py` green.

## Files in play

- `mindcraft_graph/representation/classification_index.py` — add `kind="bank"`
  entries, bank loader + canonical-id normalization, source-hash the banks.
- `mindcraft_graph/engine/ingredient_runtime.py` — two-stage `_classify_with_index`
  (C-2), ontology-gated secondary emission (C-3).
- `mindcraft_graph/engine/ingredient_pipeline.py` — soft-weighted multi-concept
  ingredient contribution (C-3).
- `ml/serve.py` / `ml/Dockerfile` — bake bank exemplars into the classifier cache.
- `ml/scripts/test_concept_paths.py` — `--classifier bank`, `--holdout-frac`,
  report top-1/top-3 (C-5).
- `app/src/data/eediQuestions.json`, `actMasterQuestionBank.generated.json` +
  static bank — the exemplar source (READ-only; do not modify the bank schema).
- `ml/tests/test_classification_index.py` — bank entries, canonical-id fail-fast,
  two-stage resolution, gate.

## Guardrails

- Deterministic engine stays deterministic. This is a better representation
  (real exemplars), not a learned model or an LLM.
- Do not touch the served `Question` shape or the frontend bank schema — this is
  classification internals only. Bank JSONs are read as exemplars, not written.
- Classification-index changes self-invalidate the baked cache (source-hash the
  bank files) or prod serves stale vectors.

## Explicitly out of scope (separate builds — do not start here)

- **Ingredient ground truth / validation.** The ingredient layer has ~15 real
  labels (145/179 ingredients empty); the ingredient half of the classifier and
  combinations cannot be validated until that is filled. That is the
  **misconception→ingredient enrichment build** (next), NOT this one.
- **Combinations tuning** — unmeasurable until ingredient ground truth exists.
- **Generation / personalization** — downstream of the enrichment.

---

## Dependency note — what this unblocks and what it waits on

This build makes the **concept decision** trustworthy on unseen questions. It does
**not** make the **ingredient decision** trustworthy — that is data-blocked, not
algorithm-blocked (see the enrichment build). Sequence:

1. **This build** — concept placement (validated). Ship.
2. **Enrichment build** — misconception→ingredient mapping to manufacture
   ingredient ground truth. Probe result: embedding gives **coverage**
   (105/179 ingredients reachable from Eedi's 963 misconceptions) but **not clean
   assignment** (rank1-2 margin ≈ 0.05 — embeddings resolve concepts, not
   within-concept ingredients). So enrichment must be **embedding-proposes /
   LLM-or-human-confirms** (1-of-~5 within the concept), never auto-accepted.
3. Only then: ingredient-layer validation, verifier, generation, personalization.
