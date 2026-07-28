# Build File — Ingredient Ground Truth via Misconception Enrichment

**Lane:** Engine (`ml/**`, `ml/data/**`). **Owner:** Blake. **Implementer:** Cursor/Codex.
**Architect:** Opus (this file — no code).
**Continues:** `CONCEPT_PLACEMENT_BUILD.md`. That build makes the **concept**
decision trustworthy. This build manufactures the **ingredient** ground truth
that concept build (and combinations, and generation, and personalization) is
blocked on. Read it first.

---

## The problem (measured)

The ingredient layer has almost no ground truth:

```
L3 instances with an ingredient label:  15 / 450
ingredients with >=1 labeled example:   34 / 179   (145 have ZERO)
examples/ingredient:                    median 1, max 3
```

Consequences, all confirmed this session:
- The ingredient half of the classifier **cannot be validated** (nothing to check
  against). The 0.39 "ingredient precision" in the audit is scored against a
  **cosine-guessed** reference (concept_path steps → nearest ingredient), not
  human labels — two heuristics compared, not a correctness measure.
- **Combinations are unmeasurable** — they reorder/co-fire ingredients; "5 helped
  / 5 hurt" is measured against that same fake reference.
- **Personalization at ingredient granularity is impossible** — no dense
  question→ingredient map to drive "give the student a problem hitting weak
  ingredient X."

This is a **data** gap, not an algorithm gap.

## The lead (measured)

Eedi's misconception axis is dense and canonical, and it bridges to ingredients:

```
Eedi:         1,508/1,508 questions carry misconception_id (963 distinct),
              all in canonical mis_{concept}__{slug} form, all concept-aligned
Ingredients:  95/179 carry canonical_misconception_family — SAME namespace
Probe:        963 misconceptions reach 105/179 ingredients (coverage ✔)
              BUT rank1-2 margin ≈ 0.05 (embedding cannot auto-assign) ✘
```

So the enrichment is **coverage-rich, auto-assignment-poor.** Embedding narrows
but does not decide — consistent with the session-wide finding that embedding
cosine resolves concepts, not within-concept ingredients. The fix is therefore
**embedding-proposes / LLM-or-human-confirms**, never auto-accept.

---

## The fix — three-stage enrichment pipeline (rerunnable script)

Produce a `misconception_id → ingredient_id` map, then propagate it to per-question
ingredient labels on the misconception-tagged bank questions.

```
Stage A  SCOPE      concept-id join → the concept's ~5 ingredients   (179 → 5)
Stage B  PROPOSE    embed misconception, rank the ~5 candidates       (deterministic)
Stage C  CONFIRM    LLM picks 1-of-5 or "none"; low-confidence → human queue
         → misconception_id → ingredient_id  (+ confidence + provenance)
         → propagate: Eedi question (has misconception) → ingredient label
```

Result: **15 → up to ~1,283 per-question ingredient labels**; **~105/179
ingredients gain labeled examples.** That is the substrate everything downstream
needs.

---

## Implementation contracts (binding)

### C-1. Scope by concept-id first (the 179→5 narrowing)
Resolve each Eedi `conceptId` to an L1 concept via `BANK_ALIASES` (fail-fast on
unresolved — never map across concepts). Candidate ingredients = that concept's
nested ingredients only. Cross-concept misconception→ingredient assignment is
forbidden.

### C-2. Embedding scopes and shortcuts; it does NOT decide (measured)
**Measured, do not re-litigate:** same-genre matching (misconception ↔ de-slugged
`canonical_misconception_family`) gives margin median **0.07** vs the cross-genre
**0.05** — a real but tiny lift. Only ~26–39% of misconceptions clear a usable
margin (>0.15 / >0.10). **The embedding ranking within a concept's 5 ingredients
is near-useless regardless of genre.** Therefore:
- The **concept-id join (C-1) does the narrowing** (179→5). That is the load-bearing
  step, and it is a join, not an embedding.
- Embedding provides only a **ranked candidate list + an auto-accept shortcut** for
  the high-margin ~25%. Use same-genre text for the ranking (marginally better).
- Everything else is the LLM's job (C-4). Do not expect embedding to carry this.

### C-3. Proposal emits candidates + calibrated confidence
Stage B outputs the top-3 within-concept candidates with `top1_sim` and
`rank1_2_margin`. Define an auto-accept bar ONLY where both are high (e.g.
`top1_sim ≥ T_s AND margin ≥ T_m`, swept and documented — not magic). Everything
else goes to Stage C.

### C-4. LLM is the WORKHORSE (measured), offline, deterministic
Because embedding only auto-accepts ~25% (C-2), the LLM decides the **majority**
(~600–700 of 963) — build it as the primary path, not an edge handler. Groq
(`LLM_PROVIDER=groq` already set), **temperature 0**, structured output: given the
misconception label + the concept's ~5 ingredient descriptions, return the chosen
`ingredient_id` or `"none"`. A 1-of-5 decision — cheap and reliable at temp 0;
963 offline calls total. Batch/offline only; **never on the serve hot path.** LLM
"none" (genuinely no fitting ingredient) → **human-review queue**, never silently
dropped or auto-assigned. Because the LLM carries the bulk, C-6 human spot-check of
the **LLM-confirmed** set is the primary quality gate, not an afterthought.

### C-5. Output goes to `ml/data/`, NOT the frontend bank
Write two artifacts under `ml/data/`:
1. `misconception_ingredient_map.json` — `{ misconception_id → ingredient_id,
   confidence, provenance ∈ {embedding|llm|human}, alternates[] }`.
2. `eedi_ingredient_labels.json` — per `question_id → ingredient_id[]` derived via
   (1). Sidecar, keyed by existing Eedi ids.
**Do not mutate `app/src/data/eediQuestions.json` or the frontend `Question`
schema** (Lane-B seam). Consuming these labels in the app is a separate Lane-B
change — flag it, don't build it.

### C-6. Validation surfaces (this is half the task — there IS partial truth)
Ground the mapping against every scrap of real truth available. **Named gold test
set (use AFTER the Eedi run — do NOT use as few-shot; that would burn the anchor):**
- **15 human `links.ingredient_ids`** (Akshat-authored) + **30 archetype-join labels**
  (question → `question_archetype_ids` → archetype `required_ingredient_ids`),
  together touching **67 ingredients, of which 54 overlap the Eedi-reachable set** →
  the testable overlap. On those 54, the enrichment's labels must agree with the gold.
  The 15 human are highest quality — reserve them purely for testing.
- **Reproduce the 15 L3 ingredient labels** — the enrichment must recover them
  (tiny but real hold-out).
- **Anchor self-consistency** — the 95 `canonical_misconception_family` entries are
  hand-authored misconception→ingredient links; the pipeline must map each family's
  own misconception back to its own ingredient. Report hit rate.
- **Human spot-check** a stratified sample (≥ 50 mappings across concepts);
  report accuracy on the auto-accepted set separately from the LLM-confirmed set.
- **Coverage**: ingredients with ≥1 and ≥3 confirmed labels.

### C-7. No circularity
These labels become ground truth for the classifier's ingredient half and for
combinations (separate passes). **Never use the enrichment labels to also tune the
mapping that produced them, and never validate the classifier on labels the
classifier's own embedding proposed** without the LLM/human confirm in between.
Provenance on every label makes this auditable.

---

## Acceptance criteria

- **≥ 80 ingredients** carry ≥ 3 confirmed labels (from 34 today), coverage
  reported per concept.
- **Human spot-check accuracy ≥ 85%** on the confirmed set; auto-accept bar tuned
  so its accuracy is ≥ the confirmed set's.
- **Reproduces ≥ 12/15** L3 labels and **≥ 90%** anchor self-consistency (a family
  maps to its own ingredient).
- Proposal deterministic; LLM only as a 1-of-5 confirm bookend; nothing below the
  confidence bar auto-accepted.
- Same-genre (anchored) margin lift over the 0.05 cross-genre baseline reported;
  if absent, everything routes through Stage C.

## Files in play

- `ml/scripts/enrich_ingredient_labels.py` — the rerunnable pipeline (Stages A–C).
- `ml/data/misconception_ingredient_map.json`, `ml/data/eedi_ingredient_labels.json`
  — outputs (new).
- `ml/data/5_level_ontology/01_*` (READ) — ingredient candidates +
  `canonical_misconception_family` anchors.
- `app/src/data/eediQuestions.json` (READ-ONLY) — misconception source.
- `ml/mindcraft_graph/representation/embeddings.py` (REUSE) — same model.
- `ml/tests/test_ingredient_enrichment.py` — scoping fail-fast, anchor
  consistency, L3 reproduction, confidence gating.

## Guardrails

- Deterministic proposal; LLM confined to the offline confirm bookend.
- Never mutate the frontend bank or `Question` schema (Lane-B seam). Labels live
  in `ml/data/`.
- Provenance on every label (embedding/llm/human) — enforces C-7 and makes the
  ground truth auditable.

## Explicitly out of scope (downstream, separate builds)

- **Validating the classifier's ingredient half / tuning combinations** against
  these labels — the *next* pass, and it must be separate to avoid circularity.
- **Generation** of new questions for uncovered concepts (the 5 zero-coverage
  concepts have no misconceptions to enrich) — the essence/generation build.
- **Ingredient-granularity personalization** — needs this substrate first.
- **ACT-only follow-up pass (deferred, after the Eedi run):** map the L3 ACT bank's
  free-text `subtopics` / `skill_gap_if_wrong` → canonical ingredient (same
  embed-scope / LLM-confirm technique, richer input) for the **13 ACT-only
  ingredients** Eedi structurally can't reach (`complex_numbers`, `matrices`,
  `logarithmic_functions`, `conic_sections`, `polynomials`, …). Complementary
  coverage, not redundant. Note L3's intelligence is mostly AI-generated → treat as
  proposals, confirm before trusting.

### C-8. Canonical concept ids are a prerequisite
Joining L3 (gold test set + ACT-only source) to L1/Eedi requires canonical concept
ids. L3 carries 7 non-canonical legacy ids — resolve them via the alias map from
`CONCEPT_ID_CANONICALIZATION_BUILD.md` **before** any L3 join, or the gold-set
validation silently misses. Do not hand-map inline; use the shared registry.

---

## Where this sits in the arc

1. `CONCEPT_PLACEMENT_BUILD.md` — concept decision trustworthy (validated). ✔ spec'd
2. **This build** — manufacture ingredient ground truth from misconceptions. ← now
3. Ingredient-half validation + combinations (separate, non-circular pass).
4. Generation for uncovered concepts (essence corpus = the enriched cloud).
5. Ingredient-granularity personalization from the strength vector.

This is the domino between "concept classification works" and the entire
ingredient/generation/personalization vision.
