# Gap Map Vision — How MindCraft Finds and Closes Gaps

**One place for mission, gap logic, data flow, and growth path.**  
Deep brand voice → `BRAND_BOOK.md`. World story → `WORLD_VISION.md`. Agent contracts → `AGENT_RULEBOOK.md`.  
**Ingredients, distractor_taxonomy, outcome+process fusion, combinations** → `INGREDIENT_EVIDENCE_CONTRACT.md` (co-founder / Blake primer).  
**Tier-3 `/recommend` + `worstWeakness()` extension** → `EXTENSION_RECOMMEND.md`.

---

## 1. Mission (one sentence)

Turn every student who gave up on math into someone who has felt what it is like to be **good** at it — inside a story where solving things **matters**.

**Brand promise to the student:** You were never bad at math. You were waiting for a better story. We find the exact place the story lost you — without a verdict — and walk you back.

---

## 2. What a “gap” is (three layers)

MindCraft tracks weakness at increasing resolution. All layers use the **same student evidence**; each layer answers a different question.

| Layer | Question | Unit | Live today? |
|-------|----------|------|-------------|
| **Concept** | “Does she know fractions?” | 42 ontology concepts | ✅ Yes — mastery graph |
| **Format (vessel)** | “Can she do fractions in a diagram, not just symbols?” | 6 format ids | ✅ Yes — format nodes |
| **Ingredient / misconception** | “Which mental model broke — numerator/denom swap, wrong formula, sign error?” | 179 ingredients, misconception ids | 🟡 Stored; recommendations still concept-level |

**Weak spot on the dashboard today** = worst **playable** gap across concept + format (`worstWeakness()`).  
**Tomorrow** = same pipeline, but ingredient/misconception evidence can win when taxonomy exists.

We do **not** replace the concept graph. Ingredients sit **under** concepts, the way Blake’s ontology already nests them.

---

## 3. The map (what the student sees)

| Surface | Student name | What it is |
|---------|--------------|------------|
| Dashboard PawHub | Practice / Learn | `/recommend` → weak concept + next new topic |
| Knowledge Map | Map | Full 42-node graph, mastery color, path |
| Jesse’s Kitchen diagnostic | Your route | ~10 probes + grade/goals → seeded graph |
| Concept chapter | Notes | Story world + question bank for one concept |

The **map is honest**: fog = no evidence, color = mastery, weak pad = highest-severity gap with questions to play.

---

## 4. Ontology (the shared vocabulary)

**Layer 1** (`ml/data/5_level_ontology/…with_combinations.json`) is canonical:

- **42 concepts** — slug ids (`linear_equations`, `fractions_decimals`, …)
- **179 ingredients** — atomic mental models per concept (`fractions_decimals__…`)
- **Misconception ids** — `mis_{concept}__{slug}` on ingredients and Eedi bank
- **Bridges** — where students know both sides but can’t connect them

Questions, Story Cells, and student events all **join on these ids**. We **append** to the ontology after human review — never silently redefine a canonical id.

---

## 5. Questions (three jobs)

| Asset type | Job | Volume | Misconception signal |
|------------|-----|--------|----------------------|
| **Bank MCQs** (Eedi, OpenStax, ACT) | Coverage + practice volume | ~1,500+ | Eedi: question-level; enrich pass adds per-choice taxonomy |
| **Story Cells** | Rich diagnostic moments in the concept world | Scaling to 4–6 per concept / ingredient | Full `distractor_taxonomy[]` per choice |

**Ship gate:** `merge_story_cells_for_app.py` excludes template-fallback cells (identical tank stem). Only LLM-generated cells go to `app/src/data/storyCells.json` until a real batch passes quality review.
| **Generated** (paused) | Fill format/concept holes | Pilot only | Verified before ship |

Same math, different packaging. Story Cells are **not** duplicates of OpenStax — they are **vetted ingredient tangents** for diagnosis and world-building.

---

## 6. How student answers move the system

### Every MCQ attempt (Practice + diagnostic probes)

```
Student picks choice B
  → Frontend: questionId, selectedChoiceIndex, resolveChoiceEvidence()
  → POST /record-outcomes
  → Concept mastery: aggregated pass rate (unchanged math)
  → attempt_observations: one row per question
       { questionId, selectedChoiceIndex, misconceptionId?, errorType?, formatId, correct }
```

**Hide-correctness** (diagnostic): student never sees right/wrong; graph still updates.

### Onboarding seed (grade + probes + confidence)

```
Grade + goals → concept scope (diagnosticQuestions.ts)
  → gradeConfidence: prior-grade concepts kinda, new-grade hard
  → ~10 probes (2 Story Cells when available + bank at grade level)
  → Probes adjust confidence map
  → POST /seed-assessment (hard/kinda/easy → synthetic assessment events)
  → POST /record-outcomes (probe evidence + choice detail)
  → Firestore: grade, goals, curriculumTrack, diagnosticCompleted
```

**Grade and goals text** are stored for future **story skin** (Horizon 3). ML does not read free-text goals yet.

### Ingredient cards (homework solver path)

```
POST /submit-answer → ingredient mastery → aggregate_to_concept_mastery
```

Practice MCQs do not use this path today; they feed concept + observations.

---

## 7. Priors and posteriors (the math, plain words)

This **is** knowledge-graph math — not a separate AI magic layer.

| Mechanism | What it is |
|-----------|------------|
| **Concept mastery** | Deterministic fold of session events (practice, assessment, tutor summary) |
| **Edge weights** | Beta–Binomial posteriors on prerequisite/related/application links |
| **Temporal decay** | Evidence fades toward prior, never below it |
| **Population priors** | Layer 1 `population_failure_prior` / ingredient `failure_prior` — cold start |
| **Gap severity** | `/recommend` compares concept, bridge, and format gaps with comparable `severity` |

**Choice-level evidence** (new) feeds **observation logs** first. Next step: aggregate across students → confirm or mint misconceptions → tighten ingredient priors the same Bayesian way edges already update.

Nothing in the original engine was removed — we added **richer observations** and content assets.

---

## 8. Grade, track, and diagnostic selection

### Grade → concept scope (curated lists, not a model per grade)

Accurate lists in `app/src/lib/diagnosticQuestions.ts`:

| Grade | Concepts (cumulative) |
|-------|------------------------|
| **G7** | fractions, ratios, order of ops, number properties, stats, area, lines/angles, units, basic probability |
| **G8** | G7 + linear equations, exponent rules, **right triangle geometry**, triangle congruence |
| **G9** | G8 + linear inequalities, systems, functions basics, geometric transformations |
| **G10** | G9 + quadratics, factoring, radicals, exponentials, sequences |
| **G11** | G10 + circles, **trigonometry basics**, coordinate geometry |

*(G8 does not include SOHCAHTOA trig — that enters at G11.)*

### curriculumTrack → recommendation scope

| Track | When | ML exam scope |
|-------|------|---------------|
| `middle_school` | Grade ≤ 8 | Foundational + core concepts (~29) |
| `high_school` | Grade 9–10 | **Same pool as middle_school today** — PawHub copy differs |
| `act_prep` | Grade 11+ or ACT goal tag | ACT-tested concepts (~29) |

**Honest limitation:** middle_school and high_school share one ML pool until we split high-school-only concepts in the engine. Frontend grade scope for **diagnostic probes** is already finer-grained than the ML track split.

### Diagnostic difficulty (Product)

- **Gr ≤ 8:** Level 1 probes only  
- **Gr 9+:** Levels 1–2 (never L3 on onboarding)  
- **Hybrid:** up to 2 Story Cells + bank spread across concepts (maximize **breadth**, one probe per concept when possible)  
- **Not yet:** full information-optimal selection (active learning over priors) — future Engine pass

---

## 9. The flywheel (population → personal)

```
Many students pick wrong choice B on Q xyz
  → attempt_observations accumulate
  → aggregate_misconception_evidence.py (Codex Task B v2) — report only
  → Human/agent review → append ontology + mint Story Cell for ingredient tangent
  → Next student gets sharper weak spot + richer story moment
  → Personalization skin reads grade + goals (future)
```

**Auto-write to ontology:** no. **Append after review:** yes. Protects canonical ids and brand quality.

---

## 10. What we optimize for in diagnostics

1. **Fun + safe** — Jesse’s kitchen, paper journal, no red X on onboarding  
2. **Challenging but fair** — grade-level difficulty, not ACT hardness for grade 8  
3. **Informative** — one concept per probe when possible; Story Cells where vetted; choice index always logged  
4. **Honest map** — seed + probes → dashboard weak spot you can actually play  

---

## 11. Roadmap (gap intelligence)

| Phase | Deliverable | Owner |
|-------|-------------|-------|
| **Now** | Choice evidence on Practice + diagnostic; hybrid Story Cells | Product / Cursor |
| **Next** | `enrich_questions.py` at scale; aggregate misconception report | Codex / Engine |
| **Then** | Ingredient-level Story Cells (4–6/concept); `worstWeakness` ingredient mode | Codex Task A + Engine |
| **Later** | Goals/grade → story skin; active diagnostic item selection | Claude spec + Product |

---

## 12. Copy cheatsheet (student-facing)

- Sections: **Notes**, **Solver**, **Map** — not “Knowledge Graph” or “GPS”  
- Gaps are **places on the map**, not failures  
- Diagnostics **trace the route**, they don’t grade you  
- Tutors get the **map already drawn** — Jordan sees ingredient-level detail when we ship it  

---

*Last updated: 2026-07-08. Update this file when gap logic or evidence contracts change.*
