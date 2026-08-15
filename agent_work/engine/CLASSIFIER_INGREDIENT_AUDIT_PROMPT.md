# AUDIT PROMPT — classifier + ingredient enrichment, and the road to fully-annotated generation

**This is a prompt, not a build spec.** Nothing here says "implement X." The
deliverable is a written audit that ends in a recommendation we can turn into
specs. Do not change production behavior while auditing; scratch scripts are
fine, and say so where you used them.

**Lane: Engine.** Everything in scope is under `ml/`. Do not touch `app/**`.

---

## The strategic question

We have spent significant effort on three separate things:

1. **Concept placement** — a bank k-NN classifier (0.80 held-out top-1 concept)
2. **Ingredient enrichment** — 655 misconceptions mapped to ingredients
3. **Question generation** — built, then paused at a ~30% bad-key rate

They have never been assessed as one system. Meanwhile four separate gaps have
turned out to share a single root:

| Gap | Where it bites |
|---|---|
| **0 of 1,713** live bank questions carry ingredient tags | blocks ingredient-level prediction (Stage 2 of `ITEM_PREDICTOR_BUILD.md`) and W3 book emphasis |
| **82 of 179** ingredients have no labeled example | ingredient mastery is unmeasurable there |
| **2 of 3** distractors per question carry no misconception | ~2/3 of wrong answers yield no misconception evidence |
| **5 concepts** have zero questions (combinatorics, matrices, complex_numbers, rational_expressions, logarithmic_functions) | invisible to practice entirely |

**The hypothesis to test:** all four close at once if we can *generate* questions
that are born fully annotated — carrying `conceptId`, required `ingredient_ids`,
a known difficulty, a `format`, and **every distractor tagged to a real
misconception**. Generation would stop being a coverage patch and become the way
we produce the annotated corpus the engine has always needed.

Your job is to determine whether that hypothesis is sound, and what it would
actually take.

---

## What exists (verified 2026-08-15 — re-verify, don't trust this list)

**Classifier**
- `ml/mindcraft_graph/representation/classification_index.py` — builds bank
  voters + archetype exemplars. `REPRESENTATION_VERSION = "bank-knn-classifier-v2"`.
- `ml/mindcraft_graph/problem_classifier.py`, `ml/scripts/build_bank_index.py`,
  `ml/scripts/eval_problem_classifier.py`
- `ml/data/bank_index.npz` + `bank_index_meta.json` — **cannot regenerate inside
  the HF Space** (built from `app/src/data` + `questionBank.ts`); ships via the
  Hub API in `ml/scripts/deploy_hf.sh`. Do not break that.
- Prior finding to re-check, not assume: archetype `::shape` exemplars scored
  **0.42** held-out vs **0.64** concept baseline vs **0.80** for bank k-NN. The
  earlier good archetype numbers were leakage — the eval corpus was 100% Layer-3
  seeds with byte-identical `::seed` copies in the index.

**Ingredient enrichment**
- `ml/data/misconception_ingredient_map.json` — `_meta` + `map` (655 entries).
  Provenance: **344 llm, 282 human, 29 embedding**. Reaches **97 distinct
  ingredients**.
- `ml/scripts/enrich_ingredient_labels.py`,
  `ml/scripts/enrich_ingredient_misconception_map.py`,
  `ml/scripts/enrich_ontology_misconceptions.py`,
  `ml/scripts/enrich_question_signals.py`, `ml/scripts/promote_questions.py`
- `ml/data/eedi_misconceptions.json` (1,749 minted), `eedi_ingredient_labels.json`
- Ontology priors are **complete**: `population_failure_prior.overall` on 42/42
  concepts, `failure_prior` on 179/179 ingredients.

**Generation (paused)**
- `ml/generation/{essence,generate,verify,coverage,run,llm_client}.py`
- `ml/data/generated_questions.json` + `generated_questions.verify_report.json` —
  104 kept / 45 dropped, **~30% bad key rate**, never synced into the live bank.

**Governing constraint (read before proposing anything):**
`CLASSIFICATION_FIX_BUILD.md` §C-C fences `make_concept_text` /
`concept_embeddings.npz` off from incidental change — concept embedding text is
failure-mode prose, and changing it re-bakes the 4 PCA axes, their labels, map
coordinates, student embeddings, displacement, and explore ranking. Production
routes around it via `classifier_mode="bank"`, which never reads concept text.
If your recommendation requires touching it, say so loudly and scope the re-bake.

---

## Questions to answer

**A. Classifier — is 0.80 real, and is it enough?**
1. Reproduce the held-out number. Is the eval still leak-free, or has the bank
   index drifted to include eval items?
2. Where does it fail? Break errors down by concept, level, format, and source
   bank. Is failure concentrated in the 5 zero-coverage concepts, or spread?
3. It resolves **concepts**, not ingredients. Confirm or refute the standing
   claim that embedding cosine (all-MiniLM-L6-v2) separates concepts (~0.80,
   margins ~0.5) but **not** within-concept ingredients (margins ~0.05–0.07). If
   still true, no embedding-only method will ever tag ingredients, and that
   constrains every option below.

**B. Enrichment — what did we actually buy?**
4. Of the 655 mapped misconceptions, how many are reachable from questions
   students actually see? Join against the live bank. A map entry for a
   misconception no question can trigger is inert.
5. Spot-check quality **by provenance separately** — `llm` (344) vs `human` (282)
   vs `embedding` (29). Report each; a pooled accuracy hides the one that matters.
6. The 82 unreached ingredients: confirm the standing claim that they cluster in
   matrices / complex numbers / logarithmic functions / integrals — i.e.
   advanced ACT-only material, *not* where a high schooler's foundational holes
   are. If true, argue explicitly whether they are worth closing at all.
7. `serve.py` increments `misconception_counts` **per observation** but dedupes
   the ingredient fire **per `(misconception, ingredient)` per request**. Is that
   asymmetry intentional? It is currently the only repeat-weighting in the
   system and it was not designed as such.

**C. Generation — why 30%, and is the annotation dream real?**
8. Diagnose the 45 drops in `generated_questions.verify_report.json`. Categorize
   the failure modes. Is 30% an arithmetic problem (the standing hypothesis), a
   prompt problem, a model problem, or a verifier problem?
9. **The core question:** can generation emit items already carrying
   `required_ingredient_ids` and a **per-distractor** misconception — not one
   real tag plus two nulls, which is what the Eedi ingestion left us with? If the
   generator picks a target ingredient and misconception *first* and writes the
   item around it, annotation is an input rather than a post-hoc inference. Is
   that sound, or does it bias items toward the misconception in a way that
   corrupts the evidence?
10. What would a verifier need to check for a fully-annotated item — key
    correctness, yes, but also "does this distractor actually embody the
    misconception it claims"? Is that verifiable automatically, or does it need
    human review per item?

**D. The road forward**
11. Given A–C, what is the cheapest path to closing the ingredient-tag gap for
    **existing** bank questions — classifier inference, LLM tagging, human, or
    "don't; only tag newly generated items"?
12. Sequence the work. Be explicit about what is data-blocked vs
    algorithm-blocked vs merely unbuilt.

---

## Deliverable

A single markdown file, `agent_work/engine/CLASSIFIER_INGREDIENT_AUDIT.md`:

1. **Verdict up front** — is the fully-annotated-generation hypothesis sound?
   Yes / no / conditional, in three sentences, before any evidence.
2. **Findings per section (A–D)** with the numbers you measured, and the command
   or script to reproduce each. Distinguish measured from inferred every time.
3. **What I could not determine**, and what it would take.
4. **Recommended sequence**, each item labeled data-blocked /
   algorithm-blocked / unbuilt, and lane-tagged.
5. **Corrections** — anything in "What exists" above that you found to be wrong.
   That section is a starting point, not ground truth; several claims in this
   repo's docs have already been overturned by checking them.

Ground every claim in a number you produced. Where a prior document asserts
something you could not reproduce, say so explicitly rather than repeating it —
two headline claims in `ENGINE_BOOK_ACCURACY_REVIEW.md` were retracted this way,
both because inference from code shape was mistaken for verification.
