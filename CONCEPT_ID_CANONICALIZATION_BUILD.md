# Build File — Canonical Concept IDs (single source of truth = L1)

**Lane:** Engine (`ml/data/**`, `ml/**`). **Owner:** Blake. **Implementer:** Cursor/Codex.
**Architect:** Opus (this file — no code).
**Why now:** both `CONCEPT_PLACEMENT_BUILD.md` (bank join) and
`INGREDIENT_ENRICHMENT_BUILD.md` (L3 gold-set + ACT-only source) join across layers
by `concept_id`. L3 carries non-canonical legacy ids → joins silently miss. Fix the
namespace once, centrally, so every build inherits it.

---

## The canonical set

**Layer 1** (`01_…_with_combinations.json`, the ingredient layer) is THE source of
truth — its 42 `concepts[].id` slugs are canonical. Measured state:
- L2 archetype `primary_concept_ids`: **already canonical** (0 mismatches).
- L1 `aliases`: **empty** (0 declared) — so there is no registry yet.
- L3 `primary_concept_ids`: **7 of 30 non-canonical** (verbose legacy slugs).
- Frontend `BANK_ALIASES` (`app/src/lib/questionBank.ts`): resolves Eedi/app bank
  ids → L1; exists but is Product-lane and not mirrored ML-side.

## The 7 legacy → canonical mappings (authoritative)

```
algebraic_structure_symbolic_manipulation        -> algebraic_manipulation
basic_one_variable_equations                     -> basic_equations
basics_of_functions                              -> functions_basics
geometry_circles                                 -> circles_geometry
number_properties_factors_divisibility           -> number_properties
representation_translation_mathematical_modeling -> representation_translation
units_measurement_dimensional_reasoning          -> measurement_units
```

Every target exists in L1's 42-concept set — validate that at build time.

## The fix (two moves)

### C-1. Populate L1 `aliases` — make the ingredient layer the alias registry
Add each legacy id to the `aliases` list of its canonical L1 concept. L1 then holds
BOTH the canonical set and every known alias — one authoritative registry. Include
the Product-side `BANK_ALIASES` entries too, so L1 supersedes the scattered maps.
Do this non-destructively (append to `aliases`, never rename an L1 `id`).

### C-2. Normalize L3 in place to canonical, via a rerunnable script
Rewrite L3's 7 legacy `primary_concept_ids` (and any other layer field keyed by
concept id) to canonical, using the C-1 registry — **via a checked-in rerunnable
script reading the registry**, not by hand. The alias map is the audit trail. After
the rewrite, re-run the mismatch check → 0 non-canonical ids across L1/L2/L3.

### C-3. One shared resolver
Expose a single `canonical_concept_id(raw) -> str` that reads the L1 registry
(canonical + aliases), used by the classification index, the enrichment L3 joins,
and any bank ingestion. **Fail fast** on an id that is neither canonical nor a known
alias — never pass an unresolved id downstream. Ingredient ids
(`{concept}__{slug}`) inherit canonicalization from their concept prefix; validate
they resolve too.

## Validation / acceptance

- 0 non-canonical `primary_concept_ids`/`bridge_concept_ids` across L1/L2/L3 after
  the run (automated check).
- Every L1 `aliases` entry resolves to exactly one canonical id; no alias collides
  with another concept's canonical id.
- `canonical_concept_id()` round-trips all 7 legacy ids + all `BANK_ALIASES` keys.
- Downstream unaffected: `end2end.py` green (L1 `id`s unchanged; only `aliases`
  grew and L3 keys normalized).

## Files in play

- `ml/data/5_level_ontology/01_*with_combinations*.json` — add `aliases` (C-1).
- `ml/data/5_level_ontology/03_*seed*v1_6.json` — normalized concept ids (C-2 output).
- `ml/scripts/canonicalize_concept_ids.py` — rerunnable normalizer + mismatch check (new).
- `ml/mindcraft_graph/models/concept.py` (or a small util) — `canonical_concept_id()` (C-3).
- `app/src/lib/questionBank.ts` `BANK_ALIASES` — folded into the L1 registry (READ;
  Product-lane coordination if it changes).

## Guardrails

- **Never rename an L1 `id`** — it's the canonical key half the engine joins on.
  Only append `aliases` and normalize the *other* layers to match.
- Normalization is a rerunnable script + checked-in registry, never hand edits.
- Fail fast on unresolved ids; do not silently drop a concept.

## Out of scope

- Splitting the standardized ontology into `concepts.json` + `ingredients.json`
  (the deeper refactor noted in CLAUDE.md's ML backlog) — separate decision.
- Renaming ingredient slugs — only concept-id namespace is in scope here.
