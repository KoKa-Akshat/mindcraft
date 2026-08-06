# Work plan — unified weakness selection + format axis + question diagnostic

Two agents in parallel (**A = Codex / backend+ML**, **B = Cursor / frontend+data**).
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

## Diagnostic reconciliation — ONE diagnostic, ONE update mechanism (decided)
Three diagnostic-shaped flows existed; they **converge on Blake's engine** (the
working deterministic update path). Akshat's kitchen-world `/learning-event` flow
shipped the **frontend + question data only** — no engine update, no Firestore
writer was ever built. So **do NOT build `/learning-event`.** Instead retarget the
kitchen-world UI onto the existing, proven sinks:

| Kitchen-world step (`Diagnostic.tsx`) | Was (orphan) | Retarget to (canonical) |
|---|---|---|
| confidence ratings (`confidence_report`, outcome=null) | `/learning-event` ❌ | **`/seed-assessment`** (per-concept confidence seed — exactly its job) |
| probe answers (`answer_submitted`, outcome 1/0) | `/learning-event` ❌ | **`/record-outcomes`** (real question outcomes APPEND to graph) |
| completion (`diagnostic_complete`) | writes `diagnosticCompletedAt` only | write the **canonical `diagnosticCompleted: true`** (keep timestamp as metadata) so PawHub gating + any n8n trigger agree (fixes Shreeyut finding #2) |

Rules:
- **Retire `sendLearningEvent`** — replace its 3 call sites in `Diagnostic.tsx`
  with the existing mlApi calls to `/seed-assessment` + `/record-outcomes`.
- The probe step IS the B3/C4 question diagnostic — run it **hide-correctness**
  (C4): record probe outcomes via `/record-outcomes`, never reveal right/wrong.
- Probe questions must carry the **C5 `format` tag** and canonical Layer-1
  `conceptId` so format outcomes feed `worstWeakness` like any other evidence.
  Reuse Akshat's `act_questions.json` / `build_act_diagnostic.py` as substrate;
  better-question generation (A2 `--verify`) backfills coverage.
- This is **Lane-crossing** (touches `app/Diagnostic.tsx` + relies on `ml/` sinks
  already shipped) — Lane B owns the frontend retarget; no new `ml/` endpoint needed.

## WS4 — misconception-informed diagnosis surfacing (added 2026-08-05, not in original plan)

Found while auditing question quality, not proposed from scratch: this pipeline
**already exists and is live**, further along than anyone had tracked here.
Confirmed by reading the actual code, not assumed:

- `Question.distractor_taxonomy[].misconception_id` (per-choice tagging) —
  currently **Eedi/GCSE-sourced questions only** (`questionBank.ts:37-46`).
- `OutcomeItem.misconception_id` sent to `/record-outcomes` fires a **negative
  ingredient event on every ingredient linked to that misconception** ("Stream
  A", `serve.py:867-901`) — not just a concept-level ding.
- `ml/data/misconception_ingredient_map.json` — 493 of 1,749 minted
  misconceptions (28%) mapped to an ingredient, embedding + LLM provenance,
  confidence-scored. Produced by `enrich_ingredient_misconception_map.py`.
- `/recommend` → `misconceptionGaps[]` ("tier-3 distractor evidence").
- `TutorBriefingPanel.tsx` already turns a gap into narrative copy:
  `trapName()` names the misconception, `trapHitLine()` renders e.g. "fired on
  60% of recent attempts (5 answers seen) — population baseline 22%". This is
  the personal-vs-population framing the diagnostic-vs-insight discussion
  landed on — it's built, it just renders for tutors, not students.

Two real gaps, both cheap relative to what's already standing:

**Gap 1 — coverage.** `distractor_taxonomy` tagging doesn't exist outside
Eedi/GCSE content, so the ACT-relevant static/actMaster bank — most of what a
US student actually sees — feeds nothing into this pipeline. Separately, only
28% of misconceptions have an ingredient mapping.
- Owning lane: **Product** (`app/src/data/**`) to add `distractor_taxonomy` to
  non-Eedi questions; **Engine** (`ml/scripts/enrich_ingredient_misconception_map.py`)
  to extend map coverage past 493.
- Seed batch ready to merge: `area_volume_five_seed.json` (repo root) — 5
  hand-authored, schema-exact `Question` objects, `distractor_taxonomy` on
  every distractor, sourced from `eedi_misconceptions.json`'s real
  `area_volume` taxonomy (one exception flagged inline as non-sourced).

**Gap 2 — surfacing.** `misconceptionGaps` + the trap narrative exists and
reads well, but only `TutorBriefingPanel.tsx` consumes it. No student surface
does.
- **C6 (new contract) — misconception-gap surfacing is a dedicated surface,
  NOT folded into C1's `worstWeakness()` ranking.** `trapHitLine`'s
  personal-rate-vs-population-baseline framing is a different kind of
  statement than a severity float competing for one ranked slot; collapsing it
  into `worstWeakness()` would flatten the exact texture that makes it read as
  insight rather than a score. Recommend extracting `TutorBriefingPanel`'s
  `trapName`/`trapHitLine`/row-building logic into a shared lib both the tutor
  panel and a new student-facing component call, so copy doesn't drift between
  audiences.
- Placement on the student side (PawHub main pad vs. a dedicated "what's
  tripping you up" card) is an open call for whoever picks this up — no
  backend work needed, `/recommend` already returns `misconceptionGaps`.
- Owning lane: **Product** (`app/**`).

Status: ❌ not started. Gap 1 (data) and Gap 2 (frontend reuse) touch disjoint
files and can run in parallel; neither has a prerequisite on the other.

---

## Coordination rules (avoid the collisions we've had)
- Lanes are **disjoint** (`ml/**` vs `app/**`). If you must cross, ping first.
- **Push to `main`; never `firebase deploy` from a laptop** — CI auto-deploys
  (`FIREBASE_SERVICE_ACCOUNT`). `git pull`/merge before pushing.
- Land **C1–C5 contract stubs first** (signatures + the `severity` field) so both
  lanes compile against the seam before filling in logic.
