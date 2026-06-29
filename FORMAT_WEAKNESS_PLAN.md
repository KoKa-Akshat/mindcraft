# Work plan — unified weakness selection + format axis + question diagnostic

Two agents in parallel (**A = Claude Code / backend+ML**, **B = Cursor / frontend+data**).
Lanes own **disjoint files** so pushes don't collide. Both build against the
**shared contracts** below — those are the seams; agree them first, then go wide.

## Goal
1. **Worst-weakness selection** across *both* gap types (concept↔concept bridge
   gaps AND format↔concept gaps) — pick the single most severe, playable target.
2. **Format as an independent axis** — decouple format from practice level so
   weakness drilling can target a `(concept, format)` edge.
3. **Question-based diagnostic** — serve real questions but **hide correctness**;
   ultimately fed by **essence-generated, format-tagged** items covering all ACT
   topics (the keystone that also fixes the 19 uncovered ACT concepts).

## Keystone dependency
Steps 1–2 only *surface* format once questions are **format-tagged** and cover
all topics. Static-only pieces ship now; full format-driven selection waits on
**WS3 (essence generation)**. Build the comparator so it **degrades gracefully**
(format candidates lose until they're playable, then start winning automatically).

---

## Shared contracts (the seams — don't diverge)

**C1 — gap `severity` on `/recommend` `recommendations[]`** (Agent A produces, B consumes)
Every gap (`isBridgeGap`) gains `severity: number` in `[0,1]` (higher = worse):
- concept gap: `1 − bridge_confidence` (Tier-1 evidence) ; Tier-2 hypothesis scaled down (×0.5).
- format gap: `(1 − format_mastery)` gated on `concept_mastery ≥ 0.6` ; Tier-2 ×0.5.
Plain concept weakness severity (frontend-derived): `1 − mastery`.
`worstWeakness()` picks `max(severity)` among **playable** candidates.

**C2 — `FormatId` vocabulary** (shared, already exists): the 6 ids in ml
`config.FORMAT_IDS` MUST equal `questionBank.FormatId`
(`word_problem | diagram | number_line | symbolic_expression | coordinate_graph | table`).

**C3 — `getQuestions(conceptId, level, count, seen, examType, format?)`** (done).
Prefers `q.format === format`, falls back to the concept pool.

**C4 — diagnostic "hide correctness" mode** (Agent B): a session flag (e.g.
`diagnostic: true`) that records the outcome via `/record-outcomes` but the UI
**never reveals right/wrong**; advance silently.

**C5 — generated `Question` schema** (Agent A emits, B's bank consumes): generated
items conform to `questionBank.Question` exactly — `id, conceptId, level, question,
choices, correctIndex, explanation, hints, examTag?, format`. `conceptId` uses the
canonical Layer-1 ontology id; `format` tagged at generation.

---

## Lane A — Claude Code (backend + ML).  Owns: `ml/**`
- **A1 (WS1):** add `severity` (C1) to `_detect_bridge_gaps` + `_detect_format_gaps`
  in `ml/mindcraft_graph/api/recommend.py`; surface it in the `/recommend` JSON.
  Keep pathfinder format-blind. *(now, static-safe)*
- **A2 (WS3, keystone):** essence-generation pipeline in `ml/` — past-paper →
  embed/essence → generate questions conforming to **C5**, format-tagged, covering
  all 29 ACT concepts (esp. the 19 with no static items). Route through an
  available LLM (Groq/Llama like the question webhook, or Anthropic when funded).
  Output: a generated-questions JSON the frontend bank can load. *(needs credits/pipeline)*
- **A3:** end2end coverage — severity ordering test; serve==harness for the new field.

## Lane B — Cursor (frontend + question data).  Owns: `app/**`
- **B1 (WS1):** `worstWeakness()` in `app/src/lib/recommendNextConcept.ts` — score
  topWeaknesses + concept gaps + format gaps by **C1 severity**, pick max **playable**
  (`hasPlayableQuestions`). Replaces the current `gapType === 'concept'`-only override.
  Degrades gracefully. *(now — reads severity once A1 ships; until then, treat missing severity as `1 − mastery`)*
- **B2 (WS2):** tag `app/src/lib/questionBank.ts` questions with `format` (heuristic +
  manual), aiming for format variety per `(concept, level)`. Then pass `format` into
  the `getQuestions` call in `Practice.tsx` for format-gap missions, and enable the
  Reinforce/PawHub CTA to launch `(concept, format)`. *(now, data work)*
- **B3 (C4):** question-based diagnostic that hides correctness — Practice/Diagnostic
  serves real items (covered concepts now; all concepts once A2 lands) and records
  outcomes silently. *(now for covered concepts)*
- **B4:** load A2's generated-questions JSON into the bank source. *(after A2)*

---

## Dependency graph
```
A1 (severity) ──► B1 (worstWeakness)         [parallel; B1 stubs severity until A1]
B2 (format tags) ─► format gaps become playable ─► worstWeakness surfaces format
A2 (essence gen, keystone) ─► B4 (load) ─► full coverage + B3 all-topic diagnostic
B3 (hide-correctness) runs now on covered concepts, scales with A2
```
Parallel-now: **A1 ∥ B1 ∥ B2 ∥ B3**. Gated: B-format-surfacing needs B2; full diagnostic needs A2.

## Integration checks
- `/recommend` returns `severity` on every gap; `worstWeakness()` orders A's three
  fixtures correctly (concept-weak vs concept-bridge vs format) — shared test vector.
- A tagged format question flows: gap → `worstWeakness` picks it → `getQuestions(…, format)`
  serves a format-matched item.
- Diagnostic session records outcomes but the UI shows no correctness.

## Coordination rules (avoid the collisions we've had)
- Lanes are **disjoint** (`ml/**` vs `app/**`). If you must cross, ping first.
- **Push to `main`; never `firebase deploy` from a laptop** — CI auto-deploys
  (`FIREBASE_SERVICE_ACCOUNT`). `git pull`/merge before pushing.
- Land **C1–C5 contract stubs first** (signatures + the `severity` field) so both
  lanes compile against the seam before filling in logic.
