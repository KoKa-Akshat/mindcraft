# Ingredient & Evidence Contract

**Filename to search:** `INGREDIENT_EVIDENCE_CONTRACT.md`  
**Audience:** Blake (Engine), co-founder (step rules / work evidence), Fable 5 (Story Cells), Cursor (Product wiring).  
**Read with:** `GAP_MAP_VISION.md` (mission + flywheel), `EXTENSION_RECOMMEND.md` (tier-3 `/recommend` refactor), `PERSONALIZATION_WORK_EVIDENCE_PLAN.md` (ink → steps), `STORY_INTELLIGENCE_SPEC.md` §5 (distractor priors).

This document is the **shared vocabulary** for how questions, ingredients, misconceptions, combinations, and student evidence fit together. Do not ship new evidence fields or ontology writes without aligning here first.

---

## 1. Why this exists

MindCraft diagnoses math at three resolutions:

| Layer | Unit | Question |
|-------|------|----------|
| **Concept** | 42 ontology slugs | “Does she know linear equations?” |
| **Format (vessel)** | 6 `FormatId`s | “Can she do it in a table, not just symbols?” |
| **Ingredient / misconception** | 179 ingredients, `mis_*` slugs | “Which mental model broke — slope vs intercept, subtract vs divide?” |

**Concept mastery is live.** Format gaps are live in `/recommend`. **Ingredient/misconception is the workstream** — stored in ontology + question tags, fed by choice evidence and (soon) handwritten step evidence.

Without a single contract, teams talk past each other: “distractor” means a wrong MCQ choice to Product, a taxonomy entry to Engine, and a psych construct to pedagogy. This file fixes that.

---

## 2. What is an ingredient?

An **ingredient** is an **atomic mental model** inside one concept — the smallest teachable unit the engine can target, prune, or remediate.

**Canonical source:** Layer 1 ontology  
`ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json`  
Nested under each concept’s `ingredients[]` (179 total across 42 concepts).

**ID format:** `{concept_id}__{slug}`  
Example: `linear_equations__y_intercept_meaning`, `fractions_decimals__fraction_decimal_conversion`

### Per-ingredient fields (what we assume)

| Field | Meaning |
|-------|---------|
| `label` | Human name (“Y-intercept is the value when x equals zero”) |
| `description` | What the student must understand |
| `failure_mode` | How students break when this ingredient is weak |
| `failure_prior` | Cold-start population weakness (0–1), seeded — **should become evidence-backed** |
| `comes_from` | Prerequisite ingredient id or `"new"` |
| `learning_vector` | geometric / algebraic / procedural / conceptual weights |
| `card_templates` | geometric, algebraic, procedural scaffold text (homework cards) |
| `canonical_misconception_family` | Primary `mis_*` slug for this ingredient |
| `diagnostic_tags` | Other linked `mis_*` slugs |
| `observable_evidence.positive/negative/ambiguous` | What counts as proof — **ambiguous = correct answer without visible work; do not over-update** |

### Assumptions (do not violate)

1. **One concept per ingredient id** — the prefix is the concept owner.
2. **Ingredients are not questions** — they are the *models a question exercises*. A question may touch 1–4 ingredients (combinations).
3. **Bridges** connect ingredients *across* concepts (16 bridge groups). **Combinations** are hyperedges of ingredients that *co-fire on one problem* without a prereq edge (15 today).
4. **Append after review** — never silently redefine an ingredient id or `mis_*` slug in production JSON.
5. **Mastery updates are asymmetric** (engine/features.py): positive outcomes reward efficiency; negative outcomes reward conviction of weakness. Ingredient evidence must respect Layer 4 `evidence_update_policy` (correlated steps in one problem = one outcome weight cap).

---

## 3. What is a misconception?

A **misconception** is a **named, repeatable error pattern** — stable enough to track in Firestore and compare across students.

**Canonical slugs:** `mis_{concept_or_ingredient}__{short_error}`  
**Registry:** `ml/data/eedi_misconceptions.json` (1,749 Eedi-derived + ontology `diagnostic_tags`)

Examples:
- `mis_linear_equations__believes_y_intercept_given_difference`
- `mis_ratios_proportions__thinks_difference_one_part_ratio`

**Relationship to ingredient:** Many-to-one toward an ingredient family. One ingredient has one `canonical_misconception_family` plus optional `diagnostic_tags`. Story Cells anchor diagnostics to **one primary** misconception per cell.

---

## 4. Why “distractor_taxonomy”?

In MCQ design, a **distractor** is a **wrong answer choice written to attract a specific mistake**.  
**Taxonomy** = we classify each distractor by *why* a student would pick it, not just that it’s wrong.

So `distractor_taxonomy` is **not** “all wrong answers.” It is the **diagnostic map from choice index → thinking pattern**:

```ts
distractor_taxonomy?: {
  choice_index: number      // 0–3, never the correctIndex
  error_type: string        // sign_error | arithmetic | wrong_formula | unit_confusion | …
  student_thinking?: string // Plain-language model of the mistake
  misconception_id?: string // mis_* slug when this trap is the PRIMARY diagnostic target
}[]
```

**Why per choice, not per question?**  
Because the **same question** can catch **different** misconceptions depending on which wrong option the student picks. The engine’s moat is *which trap they walked into*, not binary wrong/right.

**Primary distractor:** The choice whose `misconception_id` matches the cell’s or question’s target ingredient misconception. Persona simulation requires the “misconception student” to hit this choice.

**Non-primary distractors:** `misconception_id: null` — still useful (`error_type`, `student_thinking`) but weaker evidence for tier-3 gaps.

### How outcome evidence uses it

```ts
resolveChoiceEvidence(question, selectedIndex)
  → correct: { selectedChoiceIndex }
  → wrong:   { selectedChoiceIndex, misconceptionId?, errorType? }
      // looks up distractor_taxonomy[choice_index], else falls back to question.misconception_id
```

Stored in Firestore `attempt_observations` — **never folded into concept mastery**; used for replay, priors, and (future) `misconceptionGaps[]`.

---

## 5. Question fields — what holds what

### 5.1 Bank `Question` (`app/src/lib/questionBank.ts`)

Every playable MCQ merges four sources (static, ACT master, Eedi, generated, OpenStax, Story Cells). **Minimum contract:**

| Field | Required | Role |
|-------|----------|------|
| `id` | ✅ | Join key for observations |
| `conceptId` | ✅ | Concept-layer mastery |
| `level` | ✅ | 1 / 2 / 3 difficulty |
| `question` | ✅ | Stem (math must be answerable from stem alone — see narrative rules) |
| `choices` | ✅ | Length 4 |
| `correctIndex` | ✅ | Ground truth for mastery |
| `explanation` | ✅ | Post-submit feedback |
| `hints` | ✅ | Up to 3 scaffolds |
| `format` | Optional | Vessel axis (`word_problem`, `table`, …) |
| `examTag` | Optional | `ACT`, `GCSE`, etc. |
| `ingredient_id` | Optional | **Primary ingredient this question targets** (Story Cells, enriched bank) |
| `misconception_id` | Optional | Question-level misconception (Eedi, Story Cells) |
| `misconception_label` | Optional | Human-readable |
| `distractor_taxonomy` | Optional | **Per-wrong-choice diagnostic map** |
| `storyContext` | Optional | Scene setter (≤120 chars target for new cells) |

**Coverage today:** Story Cells + enrich pass on Eedi → growing taxonomy. Most OpenStax/static items: concept + format only until enrichment runs.

### 5.2 Story Cell (extended batch schema)

Story Cells are **diagnostic instruments**, not generic bank items. Extra fields in `batch_ingredient_fable5.json`:

| Field | Role |
|-------|------|
| `ingredient_id` | Layer 1 anchor — **required** on new Fable cells |
| `misconception_id` / `misconception_label` | Primary trap |
| `distractor_taxonomy[]` | Full 3-entry map (+ primary on choice_index) |
| `gate_status` / `pedagogy_score` / `gate_passed` | Human/self-gate before merge |
| `persona_simulation` | fast_guesser + misconception_student_hit_primary |
| `world`, `primitive`, `narrative_need`, `student_action` | Story spine |
| `correct_reasoning`, `transfer_question` | Pedagogy |
| `presentation.minimal` | (planned) ND / low-chrome copy |

Merge gate: `ml/scripts/merge_story_cells_for_app.py` → `app/src/data/storyCells.json`.

### 5.3 Layer 3 question instances (future join)

`ml/data/5_level_ontology/03_question_instance_bank_*.json` — some instances carry `links.ingredient_ids[]` (multi-ingredient gold labels). Use these to **validate** bank embedding tags, not as the live student bank.

---

## 6. Combinations — “recipe cards”

A **combination** (`cb_*` id) is a **set of ingredients that must co-fire** on one problem, with an `apply_order`, often **spanning multiple concepts**, invisible to the prereq graph alone.

Example: `cb_multistep_both_sides_distribute` — distribute → like terms → balance → inverse ops.

**Runtime:** `apply_combinations()` in `ingredient_runtime.py` expands active ingredients when overlap ≥ `min_overlap` (0.5 on `/recommend-ingredients`).

**Gap:** 15 combinations are `provenance: "ai_authored_prior"`. Fields `_empirical_todo: [frequency_weight, co_failure_prior]` are **empty**.

**Enrichment plan (Engine):** `ml/scripts/enrich_combinations_from_bank.py` (to build)

1. Embed bank questions + ingredient text → `question_ingredient_tags.json`
2. Mine co-occurring ingredient sets → backfill frequency + example stems
3. Propose novel combos as `proposed__cb_*` — human review only

**Per-concept “combination class”** = all combinations where `conceptId ∈ spans_concepts`.

---

## 7. Two evidence streams + fusion (live diagnosis)

### Stream A — Outcome (shipped)

**What:** Which MCQ trap they picked.  
**Path:** `resolveChoiceEvidence()` → `/record-outcomes` → `attempt_observations`  
**Fields:** `questionId`, `selectedChoiceIndex`, `misconceptionId`, `errorType`, `conceptId`, `formatId`, `correct`

### Stream B — Process (in progress — Blake)

**What:** Which procedural rules they used on paper.  
**Path:** Scratch ink → `workLines` → `POST /check-work` → **`step_rules.py`** (to build) → rule id + `ingredientIds[]` per line  
**Then:** `POST /record-work-evidence` (plan §2d) → ingredient mastery updates

| Rule id (examples) | Maps to ingredients |
|--------------------|---------------------|
| `subtracted_from_both_sides` | `basic_equations__do_same_to_both_sides` |
| `divided_both_sides` | `basic_equations__inverse_operations` |
| `distributed` | `polynomials__distributive_property` |
| … | See `PERSONALIZATION_WORK_EVIDENCE_PLAN.md` §2b |

### Fusion — one attempt bundle

Join on `(studentId, questionId, attemptTimestamp)`:

```jsonc
{
  "outcome": {
    "selectedChoiceIndex": 0,
    "misconceptionId": "mis_ratios_proportions__thinks_difference_one_part_ratio",
    "errorType": "arithmetic"
  },
  "process": [
    { "rule_id": "subtracted_instead_of_divided", "verdict": "wrong", "ingredientIds": ["ratios_proportions__unit_rate"] }
  ],
  "question": {
    "conceptId": "ratios_proportions",
    "ingredient_id": "ratios_proportions__unit_rate",
    "format": "table"
  },
  "alignment": "confirmed"  // confirmed | partial | divergent | ambiguous | outcome_only
}
```

### Alignment rules (deterministic — no LLM)

| Pattern | `alignment` | Signal |
|---------|-------------|--------|
| Wrong choice + primary `misconception_id` + work shows matching failed rule | `confirmed` | Strong negative on ingredient |
| Wrong choice but correct steps until break at step k | `partial` | Positive on steps 1..k-1; negative on broken step only |
| Correct choice but invalid / missing work | `ambiguous` | Low weight; Layer 4 ambiguous policy |
| Wrong MCQ trap on ingredient A, work fires ingredient B rules | `divergent` | Bridge or format gap |
| No parsed work lines | `outcome_only` | Today’s default |

**Storage (to implement):** extend `attempt_observations` or add `attempt_fusions` — see §9.

### `ingredient_path_expectations.json` (to author)

Links **question archetype / ingredient** → **expected step rules** and **primary trap rules** for fusion. Fable 5 owns trap side; Blake owns step side.

---

## 8. Population flywheel (questions improve over time)

```
Student attempts
  → attempt_observations (outcome)
  → attempt_fusions (outcome + process, when ink exists)
  → aggregate_misconception_evidence.py (report)
  → update_distractor_priors.py (TO BUILD) → ml/data/distractor_priors/{concept}.json
       observed_hit_rate per (questionId, choice_index, misconception_id)
  → enrich_combinations_from_bank.py (TO BUILD) → combination frequency_weight
  → Human review → append ontology / fix taxonomy / mint Story Cell
  → /recommend misconceptionGaps[] (TO BUILD) → worstWeakness() tier 3
```

**Do not** overwrite `distractor_taxonomy` in the bank from automation. Priors live in sidecar JSON; bank stems stay stable.

---

## 9. Firestore & API contracts

### `attempt_observations` (live)

Per-question row; **not** aggregated into mastery.

| Field | Type | Notes |
|-------|------|-------|
| `studentId` | string | |
| `questionId` | string? | |
| `conceptId` | string | |
| `formatId` | string? | |
| `level` | int | |
| `correct` | float | 0 / 1 |
| `selectedChoiceIndex` | int? | Outcome stream |
| `misconceptionId` | string? | From taxonomy |
| `errorType` | string? | From taxonomy |
| `timestamp` | datetime | |

### `attempt_fusions` (spec — not built)

Add when `/check-work` + step_rules return verdicts on submit:

| Field | Type |
|-------|------|
| All observation fields above | |
| `processSteps` | `[{ rule_id, verdict, ingredientIds[] }]` |
| `alignment` | enum |
| `firstBrokenLine` | int? |

### Endpoints

| Endpoint | Status | Purpose |
|----------|--------|---------|
| `POST /record-outcomes` | ✅ | Concept mastery + observations |
| `POST /check-work` | ✅ | Line-by-line equivalence |
| `POST /record-work-evidence` | ✅ | Ingredient mastery from steps (live on HF Space 2026-07-08) |
| `POST /recommend` + `misconceptionGaps[]` | ❌ | Tier-3 weak spot |

---

## 10. Build status checklist

| Piece | Owner | Status |
|-------|-------|--------|
| Layer 1 ingredients + 15 combinations | Blake | ✅ |
| `Question` + `distractor_taxonomy` type | Product | ✅ |
| `resolveChoiceEvidence` + GradeOnboard + Practice | Product | ✅ Shipped (deploy pending) |
| `attempt_observations` write path | Engine | ✅ |
| Story Cells with `ingredient_id` + taxonomy | Fable 5 | 🟡 6/12 pilot |
| `enrich_questions.py` (cold-start taxonomy) | Engine | ✅ Script exists |
| `aggregate_misconception_evidence.py` | Codex | ✅ Report only |
| `step_rules.py` (engine side) | Blake | ✅ Live on HF Space (rule chips UI still ❌ Product) |
| `POST /record-work-evidence` | Blake | ✅ Live on HF Space (correlated-step cap included) |
| `attempt_fusion` + alignment | Blake + Cursor | ❌ |
| `update_distractor_priors.py` | Blake | ❌ Spec §5 |
| `enrich_combinations_from_bank.py` | Blake | ❌ This doc §6 |
| `misconceptionGaps[]` on `/recommend` | Blake | ❌ Build file: `agent_work/cross-cutting/TIER3_MISCONCEPTION_GAPS_PLAN.md` (Task E1) |
| `ingredient_path_expectations.json` | Blake + Fable 5 | ❌ |

---

## 11. Co-founder work order (recommended)

1. ~~**`step_rules.py`**~~ ✅ DONE — shipped + deployed 2026-07-08; `/check-work` returns `verdictPerLine[].rule`.
2. ~~**`POST /record-work-evidence`**~~ ✅ DONE — shipped + deployed 2026-07-08.
3. **`attempt_fusion` writer** ← **UNBLOCKED, next up** (Task F1 in `agent_work/cross-cutting/TIER3_MISCONCEPTION_GAPS_PLAN.md`) — on Practice/GradeOnboard submit when ink + choice both exist; compute `alignment`.
4. **`enrich_combinations_from_bank.py`** — dry-run report; Blake reviews before ontology touch.
5. **`update_distractor_priors.py`** — after ~500 observations per concept.
6. **`ingredient_path_expectations.json`** — seed from Story Cell pilot (3 concepts × 4 cells).

---

## 12. Glossary (quick)

| Term | One line |
|------|----------|
| **Ingredient** | Atomic mental model inside a concept |
| **Misconception** | Named repeatable error (`mis_*`) |
| **Distractor** | A wrong MCQ choice |
| **distractor_taxonomy** | Map: choice index → error type + misconception + student thinking |
| **Combination** | Multi-ingredient recipe that co-fires on one problem |
| **Bridge** | Cross-concept ingredient enablement |
| **Format / vessel** | How the math is dressed (table, diagram, …) |
| **Outcome evidence** | What they picked |
| **Process evidence** | What they wrote |
| **Fusion** | Join outcome + process → alignment label |
| **observed_hit_rate** | Population frequency of a distractor being chosen |

---

*Last updated: 2026-07-08. Update when evidence fields, step_rules, or enrichment scripts land. Point new agents here before touching `serve.py`, `questionBank.ts`, or Layer 1 JSON.*
