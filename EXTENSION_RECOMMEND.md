# Extension Recommend — Ingredient Tier on `/recommend`

**Filename to search:** `EXTENSION_RECOMMEND.md`  
**Audience:** Blake (Engine), Cursor/Fable 5 (Product wiring), co-founder (evidence fusion).  
**Read with:** `INGREDIENT_EVIDENCE_CONTRACT.md` (vocabulary + evidence fields), `STORY_INTELLIGENCE_SPEC_V2.md` §3 (tier-3 spec), `GAP_MAP_VISION.md` (mission + flywheel).

This document is the **implementation brief for extending the existing recommendation spine** — not building a new ingredient engine. The ingredient runtime, combinations, and bridge logic already run on the homework/solver path. The gap is **extraction and routing**: dashboard weak spot still speaks concept/format only.

---

## 1. Core insight

> **Ingredient engine works for Problem Solver; dashboard still speaks concept. Ship tier 3 by emitting misconception gaps on `/recommend` and teaching `worstWeakness()` to pick an `ingredient_id` — same spine, new extraction layer.**

| What | Status |
|------|--------|
| `ingredient_runtime.py`, `apply_combinations()`, card DAG | ✅ Live on `POST /recommend-ingredients` |
| Bridge gaps (`bridge_id` = `from_ing->to_ing`) | ✅ Live on `POST /recommend` — UI still launches **concept** practice |
| Choice evidence → `attempt_observations` | ✅ Shipped (Practice + GradeOnboard) |
| `misconceptionGaps[]` on `/recommend` | ❌ Not built |
| `worstWeakness()` tier 3 | ❌ Still concept / format / bridge only |
| PawHub copy (“y-intercept in tables”) | ❌ Not built |

**Effort (honest):** ~1 session Engine + ~half session Product for routing. Map coloring, combination mining, and step-rule fusion are **parallel**, not blockers for tier 3.

---

## 2. What already uses ingredients (today)

| Path | Uses ingredients? | Student sees it? |
|------|-------------------|------------------|
| **`POST /recommend-ingredients`** | ✅ Classify problem → target ingredients → combinations → cards/DAG | Problem Solver / homework fallback only |
| **`POST /recommend`** bridge gaps | ✅ `ingredient_state.bridge_confidence` | Map/ReinforceCard — routed as **concept** weak spot |
| **`POST /submit-answer`** | ✅ Updates `ingredient_states.ingredient_mastery` | Homework cards only |
| **`GET /knowledge-graph`** | ✅ Static ingredient metadata per concept | Map shows concept nodes — not per-ingredient mastery color |
| **PawHub weak spot** | ❌ | `worstWeakness()` → `conceptId` + optional `formatId` only |

Combinations help **multi-step solver paths**. They do **not** replace “which single ingredient is this student’s worst trap.”

---

## 3. Bridge gap vs misconception gap (do not conflate)

| Gap type | Question it answers | Live? | UI today |
|----------|---------------------|-------|----------|
| **Bridge gap** | “Knows both sides, can’t connect them” | ✅ | Launches concept practice |
| **Format gap** | “Can do it in symbols, not in a table” | ✅ | Launches format-scoped practice |
| **Misconception gap** | “Keeps picking the subtraction trap on unit-rate tables” | ❌ | Needs choice evidence + question `ingredient_id` |

Bridge gaps are **cross-concept ingredient enablement**. Misconception gaps are **within-concept trap patterns** from `distractor_taxonomy` + personal hit rate.

---

## 4. Target architecture (thin refactor)

```
TODAY:
  attempt_observations (choice + misconception)  ──╮
  ingredient_states (homework/submit-answer)       ──┼──► NOT joined on /recommend
  /recommend (concept + bridge + format gaps)      ──╯
       ↓
  worstWeakness()  →  conceptId  →  Practice session

NEEDED:
  /recommend  +  misconceptionGaps[]
       ↓
  worstWeakness() tier 3  →  conceptId + ingredientId + misconceptionId
       ↓
  Practice prefers Story Cells / bank questions tagged to that ingredient
```

---

## 5. Tier model (`worstWeakness()`)

File: `app/src/lib/recommendNextConcept.ts`. Tiers 1–2 stay **byte-for-byte unchanged**. Tier 3 is additive.

| Tier | `source` | Severity | Fires when |
|------|----------|----------|------------|
| 1 — concept | `'profile'` / `'concept_gap'` | `1 - conceptMastery` / `gapSeverity()` | Always (today) |
| 2 — format | `'format_gap'` | `gapSeverity()` | `/recommend` emits format gap |
| 3 — misconception | `'misconception_gap'` | Server-computed (below) | `/recommend` returns non-empty `misconceptionGaps[]` |

**Backwards compatibility:** If `misconceptionGaps` is undefined or `[]`, tier 3 contributes zero candidates → identical output to today. No client flag needed.

### 5.1 Server: `misconceptionGaps[]` on `/recommend`

Owner: Blake — `ml/serve.py`, `mindcraft_graph/planning/recommend.py`.

For each concept in student scope, join:

- Student `attempt_observations` (personal hit rate per `misconceptionId`)
- `ml/data/distractor_priors/{concept_id}.json` (population `observed_hit_rate` — from `update_distractor_priors.py`, optional at launch)

**Emit only when ALL hold:**

- `populationHitRate` exists with `n_observations >= 30` **OR** student has `>= 2` tagged attempts on that concept (personal-only cold start)
- Computed `severity >= 0.25`

**Severity:**

```
personalHitRate   = (# student attempts where misconceptionId matched)
                    / (# student attempts on questions carrying that distractor)
populationHitRate = distractor.observed_hit_rate   // priors file; optional early

severity = clamp01(0.6 * personalHitRate + 0.4 * populationHitRate)
```

Personal dominates (0.6) so one unlucky click doesn’t outrank a genuine concept gap. Range `[0,1]` matches C1 `gapSeverity()` contract.

**Payload per entry:**

```jsonc
{
  "conceptId": "fractions_decimals",
  "ingredientId": "fractions_decimals__place_value_ladder",
  "misconceptionId": "mis_fractions_decimals__denominator_as_value",
  "distractorChoiceIndex": 1,
  "personalHitRate": 0.67,
  "populationHitRate": 0.44,
  "nObservations": 112,
  "severity": 0.58
}
```

`ingredientId` joins from Layer 1 via question `ingredient_id` or misconception → ingredient family mapping.

### 5.2 Client: `worstWeakness()` tier-3 loop

```ts
for (const g of profileRec?.misconceptionGaps ?? []) {
  if (!hasPlayableQuestions(g.conceptId)) continue
  if (excludedConcepts.has(g.conceptId)) continue
  candidates.push({
    conceptId: g.conceptId,
    severity: g.severity,
    source: 'misconception_gap',
    misconceptionId: g.misconceptionId,
    ingredientId: g.ingredientId ?? undefined,
    distractorChoiceIndex: g.distractorChoiceIndex,
  })
}
```

**Extended types (null-safe):**

```ts
export type WeaknessCandidate = {
  conceptId: string
  formatId?: FormatId
  severity: number
  source: 'profile' | 'concept_gap' | 'format_gap' | 'misconception_gap'
  misconceptionId?: string
  ingredientId?: string
  distractorChoiceIndex?: number
}
```

All consumers (PawHub, Practice launch state) MUST treat new fields as optional.

### 5.3 Practice routing when tier 3 wins

`Practice.tsx` weakness missions — question source priority:

1. Story Cell matching `conceptId` + `ingredient_id` (if `source === 'misconception_gap'`)
2. Bank questions with matching `ingredient_id` + `distractor_taxonomy` (already wired via `getQuestions(..., preferStoryCell)`)
3. Fall back to concept pool (today’s behavior)

PawHub copy example: *“Unit rate in tables — you keep picking the difference trap”* (ingredient label + trap, not just concept name).

---

## 6. Two evidence streams → stronger tier 3 (future, not blocker)

Outcome stream is shipped. Process stream (ink → `step_rules.py` → `/record-work-evidence`) is co-founder work. **Fusion** makes tier 3 severity sharper:

```
severity = f(
  populationHitRate,      // distractor_priors
  personalHitRate,        // attempt_observations
  stepNegativeRate        // same ingredient from ink
)
```

| Pattern | Interpretation |
|---------|----------------|
| Wrong MCQ trap + matching failed step rule | **Confirmed** gap — strong negative |
| Wrong trap but correct steps until step k | **Partial** — positive on steps 1..k-1 |
| Correct MCQ but invalid work | **Ambiguous** — low weight (Layer 4 policy) |
| Trap on ingredient A, work fires ingredient B | **Divergent** — bridge/format gap |
| No ink | **Outcome only** — today’s path |

See `INGREDIENT_EVIDENCE_CONTRACT.md` §7 for `attempt_fusions` schema and alignment enum.

---

## 7. Combination enrichment (parallel Engine work)

15 Layer 1 combinations are AI priors (`_empirical_todo` empty). Bank-backed enrichment does **not** block tier 3 but improves `/recommend-ingredients` and multi-step weak spots.

**Script (to build):** `ml/scripts/enrich_combinations_from_bank.py`

1. Embed ~1,500 bank questions + 179 ingredient texts → `question_ingredient_tags.json`
2. Mine co-occurring ingredient sets → backfill `frequency_weight`, `example_problem`
3. Propose novel combos as `proposed__cb_*` — human review only

**One-liner:** *Combinations are the recipe card; the question bank is the menu. Pattern-match ingredients onto each dish, count which recipes actually appear, backfill the 15 AI priors with real frequency — then student ink + MCQ choice calibrate them live.*

---

## 8. Prerequisites and blockers

| Prerequisite | Status | Notes |
|--------------|--------|-------|
| `resolveChoiceEvidence()` + `attempt_observations` | ✅ | Must be deployed for personal hit rates |
| Story Cells with `ingredient_id` + `distractor_taxonomy` | 🟡 6/12 pilot | Tier 3 needs tagged questions to rank |
| `update_distractor_priors.py` | ❌ | Population cold-start; optional for first student with 2+ attempts |
| `step_rules.py` + fusion | ❌ | Sharpens severity; not required for v1 tier 3 |

---

## 9. Build order (recommended)

| Step | Owner | Effort | Deliverable |
|------|-------|--------|-------------|
| 1 | Blake | ~1 session | `misconceptionGaps[]` on `/recommend` JSON |
| 2 | Product | ~half session | `worstWeakness()` tier 3 + `NextConcept` fields |
| 3 | Product | ~half session | PawHub label + Practice ingredient-prefer routing |
| 4 | Fable 5 | ongoing | 12-cell pilot + backfill `ingredient_id` on slot-1 cells |
| 5 | Blake | later | `update_distractor_priors.py` after ~500 obs/concept |
| 6 | Blake + co-founder | parallel | `step_rules.py`, fusion, `record-work-evidence` |
| 7 | Blake | parallel | `enrich_combinations_from_bank.py` dry-run |

---

## 10. What this is NOT

- **Not** rebuilding `ingredient_runtime.py` or `apply_combinations()`
- **Not** replacing concept mastery graph — ingredients sit **under** concepts
- **Not** auto-overwriting `distractor_taxonomy` in the bank — priors live in sidecar JSON
- **Not** requiring full Map per-ingredient coloring to ship tier 3

---

## 11. Related docs

| File | Owns |
|------|------|
| `INGREDIENT_EVIDENCE_CONTRACT.md` | Ingredients, distractor_taxonomy, fusion, Firestore contracts |
| `STORY_INTELLIGENCE_SPEC_V2.md` §3 | Full tier-3 pseudo-code + Practice priority |
| `GAP_MAP_VISION.md` | Mission, three gap layers, flywheel |
| `PERSONALIZATION_WORK_EVIDENCE_PLAN.md` | Ink → step rules → `/record-work-evidence` |

---

*Last updated: 2026-07-08. Update when `misconceptionGaps[]` ships or severity formula changes.*
