# Build file — reimplement the ACT dynamic diagnostic (real-exam-data-driven)

Cross-cutting: **Lane A = Engine (`ml/**`)**, **Lane B = Product (`app/**`)**.
Disjoint files inside each lane's own list below — land A before B needs its
output, but both can start immediately (B stubs against the current dead
`act_diagnostic.json` shape, which won't change).

## Context — what exists today (verified against code, 2026-07-08)

Two diagnostic flows exist. Only one is live.

**`/diagnostic` (`Diagnostic.tsx`) — dead.** Nothing routes to it. Its data
file `app/src/data/actDiagnostic.json` is a hand-diverged copy (v2) of the
ML-generated spec: someone manually emptied `probe_step.questions` (`"note":
"Probes unwired — confidence-only diagnostic for now."`) and hand-expanded
confidence concepts 8→20. `worlds/world2/mc-diagnostic.js` (the in-world
overlay) also targets this shape via a `?diag=` URL param and is separately
orphaned (tracked in CLAUDE.md `Known gotchas` — not in scope here).

**`/onboard` (`GradeOnboard.tsx`) — the actual live diagnostic.**
`Dashboard.tsx:351` redirects here whenever `diagnosticCompleted` is false.
Question selection is `pickDiagnosticQuestions()` in
`app/src/lib/diagnosticQuestions.ts`: concept scope comes from **hardcoded
per-grade arrays** (`G7`...`G11`, plus two goal-tag extras for `act_prep` /
`get_unstuck`), questions pulled from the general multi-source bank
(`questionBank.ts`: static + actMaster + eedi + generated). It already does
hide-correctness right (dims the choice, no correct/incorrect color) and
records outcomes via `/record-outcomes` — that machinery is fine and does NOT
need to change. What's missing: **zero ACT-specific intelligence** — concept
scope isn't ranked by real exam frequency, and it never touches the curated
ACT bank described below.

**The old "ACT-only dynamic system" (`ml/scripts/build_act_diagnostic.py`) —
real-data-driven but never wired to the frontend.** Parses Akshat's annotated
`ACT_Question_Bank.xlsx` (450 rows, "Question Intelligence" sheet) into:
- `ml/data/act/act_questions.json` — 327 clean questions, each with
  `skill_gap_if_wrong` / `misconception_risks` (human-annotated), choices
  normalized to A–E, `concept_id` crosswalked from Akshat's topic taxonomy.
- `ml/data/act/act_concept_map.json` — `main_concepts` **ranked by actual
  question count in the real ACT bank** (not a hand list), plus
  `act_high_priority_concepts` and coverage gaps.
- `ml/data/act/act_diagnostic.json` — confidence_step (top-8 concepts by real
  frequency) + probe_step (one quality-filtered best probe per concept via
  `_pick_probe`, which rejects broken/scraped rows via `_is_usable_probe`).

Confirmed via grep: **`ml/data/act/act_questions.json` and
`act_diagnostic.json` are imported nowhere in `app/src`.** This pipeline's
output has sat unused since it was generated (`Jun 27`). It also still
targets the dead `/learning-event` endpoint and the stale
`data/ontology_complete.json` (not the live standardized Layer-1 ontology —
see CLAUDE.md `Architecture`).

## Goal

Give ACT-track students in the live `/onboard` flow a diagnostic whose concept
scope and probe questions are **driven by real ACT exam data** (frequency-
ranked concepts, quality-filtered real questions with misconception metadata)
instead of the generic hardcoded grade list — without breaking the existing
hide-correctness / outcome-recording behavior that already works.

"ACT-track" = `examForGoals(goalTags) === 'ACT'` (i.e. `act_prep` goal tag) or
grade ≥ 11, matching the existing `curriculumTrackFor()` logic in
`diagnosticQuestions.ts`.

## Shared contract (the seam)

**C5-conformant ACT question record** — Lane A emits, Lane B's bank consumes.
Each converted item must be a valid `questionBank.Question`:
```
{
  id, conceptId (canonical Layer-1 slug), level: 1|2|3,
  question, choices: string[], correctIndex, explanation, hints,
  examTag: 'ACT', format?,
  misconception_id?,              // from skill_gap_if_wrong / misconception_risks
  distractor_taxonomy?: [{ choice_index, error_type, misconception_id? }]
}
```
This reuses machinery that **already exists and does not need new code**:
`resolveChoiceEvidence()` (`questionBank.ts:53`) already reads
`misconception_id` / `distractor_taxonomy` off any `Question`, and
`recordOutcomes()` (`mlApi.ts`) already forwards `misconception_id` /
`error_type` to `/record-outcomes`. Converting the ACT bank into this shape is
the entire integration — no backend endpoint changes required.

## Lane A — Engine (`ml/**`). Modernize the generator, emit C5 shape.

- **A1 — Re-point the ontology source.** `build_act_diagnostic.py` currently
  loads `data/ontology_complete.json` (stale 15/37-concept file per
  CLAUDE.md). Switch to the live standardized ontology via
  `loaders/complete_ontology_loader.py`
  (`ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json`).
  Use `act_relevance.tested` (29 concepts) for exam scoping and
  `act_prep_overlay.high_priority_concepts` (10 concepts, confirmed present)
  for the `act_high_priority` flag — replacing the old
  `overlay.get("high_priority_concepts")` call against the legacy file (same
  field name, new source).
- **A2 — Emit C5-shaped questions, not the custom `stem`/`choices: {A:...}`
  shape.** Add a converter step (in `build_act_diagnostic.py` or a new
  `ml/scripts/convert_act_questions_to_bank.py`) that maps `act_questions.json`
  records → the `Question` shape in the contract above:
  - `choices: {A: "...", ...}` → `choices: string[]` (already A–E ordered by
    `_normalize_choices`).
  - `correct_answer` (a letter or text) → `correctIndex` (resolve letter→index;
    if `correct_answer` is answer text instead of a letter, match against
    `choices` — audit `_is_usable_probe`'s assumption here, it currently
    doesn't distinguish).
  - `skill_gap_if_wrong` + `misconception_risks` → `misconception_id` (mint a
    stable slug, e.g. `mis_{concept_id}__{short_slug}`, consistent with the
    `mis_{concept_or_archetype}_{short_error}` ID format in CLAUDE.md's Layer
    5 conventions) + keep the human text as `explanation`/`hints` fallback.
  - Output: `ml/data/act/act_questions.bank.json` (new file, C5 shape,
    frontend-ready) — leave `act_questions.json` (raw/annotated) untouched as
    the source-of-truth intermediate.
- **A3 — Fix the `event_emission` documentation block** in the diagnostic spec
  output to reference `/seed-assessment` + `/record-outcomes` (per
  FORMAT_WEAKNESS_PLAN.md's diagnostic reconciliation), not the dead
  `/learning-event`. This block is documentation only (the frontend already
  ignores it and calls the right endpoints) but it's actively misleading to
  read — fix it so nobody re-derives the wrong integration from this file
  again.
- **A4 — Widen `TOP_CONCEPTS` / `PROBES_PER_CONCEPT`.** Currently 8 concepts /
  1 probe each = 5 actual probes (many concepts have no usable probe). Bump to
  cover meaningfully more of the 29 `act_relevance.tested` concepts and 2
  probes/concept where the bank supports it — check yield against the 327-
  question bank before committing to a number; report the new counts.
- **A5 — Rerun the pipeline**, commit refreshed `ml/data/act/act_questions.json`,
  `act_concept_map.json`, `act_diagnostic.json`, plus the new
  `act_questions.bank.json` from A2.

Files: `ml/scripts/build_act_diagnostic.py`, new
`ml/scripts/convert_act_questions_to_bank.py` (or folded into the above),
`ml/data/act/*.json`.

## Lane B — Product (`app/**`). Wire the ACT bank + real concept ranking into `/onboard`.

- **B1 — Load `act_questions.bank.json` into `questionBank.ts`** the same way
  `eediQuestions.json` / `actMasterQuestionBank.generated.json` are loaded
  (import + merge into the bank array). *(depends on A2/A5)*
- **B2 — ACT-ranked concept scope in `diagnosticQuestions.ts`.** Add an
  ACT-track branch to `conceptsForGradeAndGoals()` (or a new
  `conceptsForActTrack()`): when `examForGoals(goalTags) === 'ACT'` or
  `grade >= 11`, source concept order from the real-frequency ranking instead
  of the hardcoded `G7`...`G11` arrays. Simplest source: reuse
  `act_prep_overlay.high_priority_concepts` / `act_relevance.tested` already
  shipped in the live ontology (no need to duplicate `act_concept_map.json`'s
  ranking into the frontend — that data is regenerable ml-side, frontend
  shouldn't own a second copy). Confirm with Lane A which ranking source is
  authoritative before wiring (open question below).
- **B3 — Prefer the curated ACT probe per concept.** In `poolForConcept()` /
  `pickBestProbe()`, when scope is ACT-track, prefer a question with
  `examTag === 'ACT'` sourced from the new bank slice (B1) over the generic
  pool — mirrors the old `_pick_probe`'s "best single probe" behavior but
  reuses the existing `pickBestProbe()` visual-preference logic rather than
  reimplementing selection from scratch.
- **B4 — Leave hide-correctness and `/record-outcomes` wiring untouched** —
  `submitProbeAnswer()` / `finishDiagnostic()` in `GradeOnboard.tsx` already do
  this correctly (confirmed: `.choiceSubmitted` CSS only dims, no correct/
  incorrect color; `resolveChoiceEvidence()` + `recordOutcomes()` already
  forward misconception evidence). No changes needed there — just confirm the
  new ACT questions flow through cleanly (misconception_id gets picked up
  automatically once B1 lands).
- **B5 (cleanup, optional — confirm with team before deleting):** `/diagnostic`
  (`Diagnostic.tsx`), `app/src/data/actDiagnostic.json`, and the route in
  `App.tsx:189` are dead code with no live callers. Either delete or leave
  as-is; not required for this build, flagging so it isn't mistaken for a
  second live flow during review.

Files: `app/src/lib/questionBank.ts`, `app/src/lib/diagnosticQuestions.ts`,
`app/src/data/actQuestionsBank.json` (new, A2's output copied/synced —
mirrors how `eediQuestions.json` etc. already live under `app/src/data/`).

## Open questions (resolve before/during B2 — don't block A)

1. **Ranking source of truth**: does the frontend read `act_concept_map.json`
   (ml-generated, most accurate re: actual question density) or just the
   ontology's existing `act_prep_overlay.high_priority_concepts` /
   `act_relevance.tested` (already shipped, zero new sync)? Recommend the
   latter unless the xlsx-derived ranking meaningfully differs — avoids a new
   ml→app data-sync step for marginal gain.
2. **`correct_answer` matching** (A2): confirm whether `act_questions.json`'s
   `correct_answer` field is consistently a choice letter or sometimes raw
   answer text — affects the `correctIndex` resolution logic and may need a
   manual-review pass on ambiguous rows (the original script's
   `_is_usable_probe` filters malformed choices but not this).
3. Does this fully replace `G7`...`G11` for grade ≥ 11 (Lane B's default
   already treats 11 as ACT-adjacent per `curriculumTrackFor`), or run
   alongside for non-ACT-goal 11th graders? Recommend: ACT-track branch only
   fires when `examForGoals(goalTags) === 'ACT'` (explicit `act_prep` goal),
   not merely grade ≥ 11 — avoids surprising a grade-11 student who didn't
   ask for ACT prep with ACT-only concept scope.

## Verification

- `python3 ml/scripts/build_act_diagnostic.py --xlsx <path>` runs clean
  against the live ontology, reports concept/probe counts (A4/A5).
- Spot-check 5 converted questions in `act_questions.bank.json` render
  correctly in `/onboard` for an ACT-track grade-11 test account
  (`shreeyutk@gmail.com` per CLAUDE.md, or a fresh test user with
  `goals.tags: ['act_prep']`).
- Confirm `/record-outcomes` payloads for ACT probes carry `misconceptionId`
  where the source data had `skill_gap_if_wrong` (network tab or a temp log).
- Confirm no correctness is revealed in the probe UI (already true; regression
  check only).
