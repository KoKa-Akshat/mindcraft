# FOLK_TALE_SKIN_MATCHING — Fable 5 Product Design

**Lane:** Product design (this doc) + Engine collector (`agent_work/engine/FOLK_TALE_COLLECTOR_PLAN.md`)
**Author:** Fable 5
**Status:** Design approved → implementation split across two agents

---

## The click (why this exists)

Maya does not need another worksheet in a costume. She needs a problem that **belongs** in the scene — where the math is the only way the protagonist gets out. Skinning fails when the story and the question feel glued together. This plan makes them feel **born together**.

**Two layers stay separate:**

| Layer | File | Role |
|-------|------|------|
| **42 concept stories** | `conceptStories.json` | What each concept *is* — historical spine, never overwritten |
| **Folk tale bank** | `folk_tale_bank.json` | Thousands of worlds — diversity, culture, fun |
| **Matcher** | `storyMatch.ts` | Picks best world per question |
| **Groq skin** | `story-module` | Rewrites stem inside matched world; math frozen |

---

## End-to-end flow

```
Student context (goals, tutor focus, grade)
        ↓
Question from bank (conceptId, format, stem keywords, misconception)
        ↓
storyMatch.ts — score every approved folk tale
        ↓
Winner tale (or concept story fallback)
        ↓
Groq batch — weave math INTO protagonist's stakes
        ↓
storyDisplay.ts — figures/tables (deterministic)
        ↓
Student sees: scene + math + visuals that fit
```

---

## Matching algorithm (deterministic spine)

**No LLM for selection.** Groq only skins after we pick the world.

### Step 1 — Extract question signals

From each `Question`:

```typescript
{
  conceptId,           // canonical ontology slug
  formatId,            // word_problem | diagram | symbolic_expression | ...
  keywords: string[],  // stem tokens (stopwords stripped, LaTeX → placeholders)
  mathSignals: string[], // slope, ratio, area, probability, sequence, ...
  hasTable, hasDiagram, hasPolygon,
  misconceptionId?,
}
```

`extractQuestionSignals(q)` in `storyMatch.ts`.

### Step 2 — Score each folk tale

For tale `T` and question `Q`:

| Signal | Weight | Logic |
|--------|--------|-------|
| **Concept affinity** | 0.35 | `concept_affinity_scores[Q.conceptId]` or 0 if missing |
| **Keyword overlap** | 0.25 | Jaccard(Q.keywords, T.keywords + T.themes) |
| **Math theme fit** | 0.20 | Q.mathSignals ∩ T.math_theme_tags |
| **Format scene fit** | 0.10 | table→ledger tale, diagram→spatial tale, etc. |
| **Student goals** | 0.05 | goal tag ∩ tale.themes or region preference |
| **Tutor focus** | 0.05 | ×1.5 if Q.conceptId ∈ tutorFocusConcepts |

```
score(T, Q) = weighted sum, clamped [0, 1]
```

Keep **top 1** tale if `score ≥ 0.38`. Else fall back to `selectStoryForConcept(conceptId)`.

### Step 3 — Rich skin payload

Winner tale sends to Groq:

```typescript
{
  conceptStory: tale.synopsis + tale.katha_voice_sample,
  protagonist: tale.characters[0].name,
  setting: tale.setting,
  matchReason: "proportion tale + ratio keywords", // debug only
  studentGoals, tutorFocus, // from user doc
}
```

Groq prompt rule (already in v5 webhook): *math woven into scene action, not scene + unrelated ask.*

### Step 4 — Fallback chain (always works)

```
1. Folk tale match (score ≥ 0.38)
2. Story cell (if question is cell_*)
3. 42 concept story for conceptId
4. question.storyContext / storyIntro
5. storyDisplay.ts deterministic reskin
6. Plain stem
```

---

## Borrowing existing components

| Existing | Reuse in matcher |
|----------|------------------|
| `goals.tags` + `goals.text` | Tone + theme boost in scoring |
| `tutorFocusConcepts` | ×1.5 concept affinity when concept matches |
| `questionContextFrames.json` | Fallback protagonist if tale thin |
| `storyDisplay.ts` | Figures after Groq stem |
| `storyBridge.ts` | Between-question bridges (no extra Groq) |
| `ensureStorySkins()` | Follow-ups get matched + skinned |
| `adaptiveDiagnostic.ts` | Probe order; matcher runs per question |

---

## What Groq does vs does not do

| Groq DOES | Groq DOES NOT |
|-----------|----------------|
| Rewrite stem in matched world | Pick which tale to use |
| Socratic + steps from explanation | Change numbers or choices |
| Misconception callout in story voice | Generate new math problems |
| One batch per session slice | Call per answer |

---

## Collector agent (Engine — separate implementer)

**Target catalog:** ~4,000 stubs from public-domain anthologies + ATU index
**Vetted bank:** Groq enriches synopsis, characters, tags
**Math-skin top:** ~800–1,200 tales with `math_skin_score ≥ 0.45`

See `agent_work/engine/FOLK_TALE_COLLECTOR_PLAN.md`.

---

## Implementation steps

### Phase 1 — Now
- [x] Fable 5 design (this doc)
- [ ] Engine agent: `build_folk_catalog.py` + `folk_tale_collector.py` + seed bank
- [ ] Product: `storyMatch.ts` + wire `enrichQuestionsWithStories()`
- [ ] Seed `math_skin_top.json` (~30 diverse tales for smoke test)

### Phase 2 — Skin quality
- [ ] Embeddings on tale synopsis + question stem (optional upgrade over Jaccard)
- [ ] `storyWorldId` on user doc (student picks culture/world)
- [ ] Dashboard shows matched tale name in margin ("West African drummer world")

### Phase 3 — Scale
- [ ] Weekly cron: collector `--batch 100`
- [ ] RAG index in `ml/data/folk_tales/embeddings.npz`
- [ ] A/B: folk tale skin vs concept-only skin on completion rate

---

## Acceptance (Maya test)

1. Diagnostic question about **ratios** can skin as **Kente weaver** or **West African drummer**, not always Stevin.
2. Wrong-answer follow-up gets **new match + skin** within 3s.
3. Tutor focus on `linear_equations` → matcher boosts algebra tales for those probes.
4. Goals "ACT prep" → tone in Groq prompt, not different math.
5. Offline / Groq down → fallback chain still shows coherent scene via `storyDisplay`.

---

## File map

| File | Owner |
|------|-------|
| `agent_work/product/FOLK_TALE_SKIN_MATCHING_PLAN.md` | Fable 5 (this) |
| `agent_work/engine/FOLK_TALE_COLLECTOR_PLAN.md` | Engine agent |
| `app/src/lib/storyMatch.ts` | Product |
| `app/src/lib/storySelection.ts` | Product (calls matcher) |
| `ml/data/folk_tales/math_skin_top.json` | Engine (generated) |
| `ml/scripts/folk_tale_collector.py` | Engine |
