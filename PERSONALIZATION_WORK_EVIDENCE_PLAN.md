# Build plan: dashboard personalization + bookmarks + work-evidence loop + format/concept disentanglement

Three parts. Part 1 is buildable now (Product). Part 2 is the flagship
future workstream — it turns student ink into first-class mastery
evidence. Part 3 is Engine research direction for the generation pipeline.

---

## Part 1 — Dashboard personalization + question bookmarks (Lane: **Product**) — SHIPPED (a39148e5)

Follow DASHBOARD_NOTEBOOK_SPEC.md (paper system) and BRAND_BOOK.md. All
personalization persists on the student's own `users/{uid}` doc (plain
client writes — non-privileged fields, allowed by rules).

> **Scope note (2026-07-08):** this Part is the VISUAL journal skin only
> (stickers, paper tone, hand font). Two sibling systems exist and are
> deliberately orthogonal — narrative **voice** skins
> (STORY_INTELLIGENCE_SPEC_V2 §4: grade+goals → tone) and **world** skins
> (STORY_INTELLIGENCE_SPEC §3: interestTags → setting). Don't merge their
> storage or UI; if the journal-style drawer ever grows a voice picker,
> that's a V2-spec change, not this file's.

### 1a — Stickers
A small curated sticker set (SVG — journal flavor: stars, paw, compass,
flags, plants; ~12 to start) the student can place on their dashboard book
cover/pages.
- Sticker drawer (small “decorate” affordance, e.g. in the book cover
  corner) → tap a sticker → tap a spot on the cover → placed.
  Drag-to-reposition, tap-and-hold to remove. Keep it playful but quiet —
  Field Journal, not sticker-bomb; cap ~10 placed.
- Persist: `users/{uid}.dashboardStickers: [{ stickerId, x, y, rotation }]`
  (x/y as fractions of the cover, so it survives resizes).
- [x] Stickers survive reload and render on both cover states.

### 1b — Theme: font + background color
Curated choices only (free-form color pickers will fight the paper system):
- **Paper tone**: 4-5 presets (classic cream, warm beige, cool grey-blue,
  sage, blush) — swap the CSS custom properties the book already uses.
- **Hand/font**: 2-3 options for the handwritten accents (current script
  font, a neater print, a monospace-journal look). Body text stays as spec.
- UI: a small “journal style” popover (same drawer as stickers is fine).
- Persist: `users/{uid}.dashboardTheme: { paper, font }`; apply via CSS
  vars on the book root; default = current look.
- [x] Theme applies across dashboard book pages + panels, persists, and
      never breaks contrast (test the darkest paper preset with ink text).

### 1c — Bookmark practice questions
- Bookmark toggle (small ribbon icon — the book already has a red bookmark
  motif) on the question card in Practice AND on chapter-page question
  pages. Persist `users/{uid}.bookmarkedQuestions: string[]` (question ids;
  cap ~200).
- A “saved questions” surface: paper book panel (same style as Task 3
  panels in STUDY_SURFACE_TUTOR_PING_PLAN.md) listing bookmarked questions
  → tap opens that question in the practice layout.
- `questionBank.getQuestionById(id)` helper if none exists — bookmarks
  must resolve across all four bank sources.
- [x] Bookmark from Practice + chapter page; list shows both; unbookmark
      works from the list.

---

## Part 2 — ACTIVE (unblocked 2026-07-07): ink → named steps → session notes → strength vector

Engine is live on the HF Space (`https://joinmindcraft-mindcraft-ml.hf.space`);
engine changes deploy via `ml/scripts/deploy_hf.sh`. 2a shipped with Part 1.
Build order: 2b (Engine) ∥ 2c (Product) → 2d (Engine, needs 2b).

### 2a — Tag written work to its question
Every scratch capture gets `questionId` (+ `conceptId`, `source:
'practice'|'chapter'|'session'`). ConceptChapterPage currently keeps
per-question ink only in component state — persist it (Firestore
`student_work` entries keyed by student + question) so work is queryable
by question later. SessionWork already persists; add the question linkage.

### 2b — Rule-naming step highlights (Lane: **Engine**, `ml/**`; small Product follow-up)

New module `ml/mindcraft_graph/step_rules.py` + wiring into
`work_check.check_work_lines`. For each consecutive pair of parsed lines
that `equivalent_steps` already verified, classify the transformation
**deterministically** by diffing the sympy objects — detection recipes:

| rule id | detection (prev → cur, both `sp.Eq`) |
|---|---|
| `added_to_both_sides` / `subtracted_from_both_sides` | `d = simplify(cur.lhs - prev.lhs)` equals `simplify(cur.rhs - prev.rhs)` and `d != 0` (sign picks add vs subtract; label includes `d`) |
| `multiplied_both_sides` / `divided_both_sides` | `simplify(cur.lhs / prev.lhs) == simplify(cur.rhs / prev.rhs) == k`, k a nonzero constant |
| `moved_term` | lhs gained what rhs lost (or vice versa): `simplify((cur.lhs - prev.lhs) + (cur.rhs - prev.rhs)) == 0` with both deltas nonzero |
| `distributed` | `cur.lhs == expand(prev.lhs)` (or rhs), structurally different |
| `factored` | `cur.lhs == factor(prev.lhs)` (or rhs), structurally different |
| `combined_like_terms` | semantically equal side, `count_ops` strictly decreased, and neither expand nor factor matches |
| `squared_both_sides` / `took_sqrt_both_sides` | `cur.lhs == prev.lhs**2` etc. |
| `rewrote_equivalent` | fallback — verified equivalent but none of the above matched. EVERY ok step gets a rule; never return null for a verified step. |

Order matters: test specific rules before generic (`moved_term` before
`rewrote_equivalent`; add/subtract before moved_term). Expression-only
lines (no `=`) use the same expand/factor/combine subset.

**Ingredient mapping** — static dict in `step_rules.py`, seeded with REAL
nested ingredient ids (verify each against Layer 1 before adding; do not
invent ids):
- add/subtract/multiply/divide/moved_term →
  `basic_equations__do_same_to_both_sides`,
  `basic_equations__inverse_operations`
- isolate-style final steps → `basic_equations__isolate_variable`
- distributed / factored / combined_like_terms → the matching
  `algebraic_manipulation__*` / `polynomial_operations__*` /
  `factoring_polynomials__*` ingredients (agent: grep the ontology's
  nested ingredient ids and pick exact matches; leave `[]` where none
  exists).

API: `verdictPerLine[i]` gains `rule: { id, label, ingredientIds }` (only
on verdict `ok`/`wrong` lines; `wrong` lines get the rule the diff
BEST-matches as the attempted rule, or `rewrote_equivalent` variant
`unknown_transformation`). Keep response back-compatible.

Tests (`ml/tests/test_step_rules.py`): one fixture per rule id + a
3-line derivation asserting the full pipeline labels every step.

**Product follow-up** (after deploy): line-overlay highlights get a
tap/hover chip showing `rule.label` — teaching highlights. Amber for the
broken step (existing), quiet ink-tone chips for verified steps.

- [ ] Every rule id has a passing fixture; end2end still green.
- [ ] Deployed to the Space (`deploy_hf.sh`); `/check-work` on
      `2x+4=10 → 2x=6 → x=3` names `subtracted_from_both_sides` then
      `divided_both_sides`.

### 2c — Session notes as a question-work ledger (Lane: **Product**, `app/**`)

Extend the (paper-styled) notes panel with a **“my work”** section beside
the tutor-session notes:
- Query: `student_work` where `studentId == uid` orderBy `updatedAt` desc
  (composite index already deployed with 2a), grouped by `questionId`,
  newest attempt per question; cap the list at ~50.
- Each row: question stem (via `getQuestionById` — 1c's helper), concept
  chip, date. Selecting a row opens a read-only replay view using the SAME
  question layout as practice: question + choices (student's answer marked
  if recorded), the ink (render `scratchImage`; strokes are the fallback),
  and the workLines overlay with 2b's rule labels on each line.
- Read-only — no re-answering; a “practice this again” link routes into a
  real session for that concept.
- Tutor access is OUT OF SCOPE v1 (the `student_work` rules only allow
  owner + parent reads today — widening to tutors is a rules change that
  rides with the tutor-view workstream).
- [ ] Worked questions appear after practice; replay shows ink + labeled
      steps; empty state is paper-styled per BRAND_BOOK.

### 2d — Feed the strength vector (Lane: **Engine**, `ml/**`; needs 2b)

New endpoint `POST /record-work-evidence` (auth like every data endpoint):
```json
{ "student_id": "...", "question_id": "...", "concept_id": "...",
  "steps": [ { "rule_id": "...", "verdict": "ok" | "wrong" } ] }
```
Semantics (the contract — implementer must not deviate):
- **When called**: frontend fires it ONCE per (question, attempt), at
  answer-submit / session-save — never mid-writing. Client de-dupes; the
  endpoint also ignores an identical (student, question) submission within
  10 minutes (idempotency guard).
- **Weighting (Layer-4 `evidence_update_policy`: steps within one problem
  are correlated)**: the problem's total step evidence is capped at the
  weight of ONE normal practice outcome. Per-step weight
  `= 0.5 / max(1, n_steps)` on each of the rule's `ingredientIds`,
  positive for `ok`.
- **Negative evidence**: only the FIRST `wrong` step contributes, full
  0.5 weight on its attempted rule's ingredients — a broken step is the
  high-conviction “confirmed weakness” signal (engine/features.py
  asymmetry), but later lines poisoned by the first error must not pile
  on.
- Steps whose rule has empty `ingredientIds` aggregate to the
  `concept_id` only (existing concept-level event path,
  `source: 'verified_step'`).
- Reuses the `/submit-answer` → `aggregate_to_concept_mastery` machinery —
  this is a new evidence SOURCE, not a new mastery model.
- Frontend wiring: after `/check-work` settles on submit, map verdicts →
  steps payload and fire-and-forget (failures logged, never block UX).
- [ ] Unit test: 3-step correct problem moves ingredient mastery less than
      two separate 1-step problems (cap works).
- [ ] Unit test: wrong-at-step-2 problem records exactly one negative
      event (step 3 ignored).
- [ ] Live: solved problem in Practice shifts the student's weak-spot
      ranking on the dashboard after refresh.

Bridge-gap note (kept from the brainstorm): once this lands, a student who
applies concept-A rules successfully only inside A-context problems but
never in B-context problems gives bridge-gap detection direct evidence —
no schema change needed, the events already carry question `concept_id`.

---

## Part 3 — FUTURE WORK (Engine research): disentangle format from concept in generation

Goal (Blake's orthogonal-axes idea): the system should treat WHAT a
problem tests (concept/ingredients) and HOW it's dressed (format/
representation: word_problem, symbolic, diagram, coordinate_graph,
number_line, table) as independent axes — both for **identifying**
existing problems and **generating** new ones. That grid is what powers
format-gap vs concept-gap separation (C1/C2 contracts) and the bridge-gap
mechanism.

### 3a — Identification: (concept, format) classifier (Lane: **Engine**, `ml/**` — ACTIVE, independent of Part 2)

Deterministic kNN over the already-labeled bank. No training.

1. **Bank export** — `ml/scripts/build_bank_index.py`: assemble the
   labeled dataset from the app data files: read
   `app/src/data/eediQuestions.json`, `actMasterQuestionBank.generated.json`,
   `generatedQuestions.json` directly (they're JSON), and parse the inline
   static bank out of `questionBank.ts` the way
   `audit_act_ontology_question_bank.py::_parse_question_bank` already does
   (reuse/extract that parser — extend it to capture `question`, `format`,
   `conceptId` per item, not just counts). Strip `\(...\)` delimiters from
   question text before embedding. Output:
   `ml/data/bank_index.npz` (MiniLM embeddings via
   `representation/embeddings.py`) + `bank_index_meta.json`
   (`[{id, conceptId, format, examTag}]`).
2. **Classifier** — `ml/mindcraft_graph/problem_classifier.py`:
   `classify(text) -> { concept_id, format, concept_confidence,
   format_confidence, neighbors }` = embed → cosine top-k (k=10) →
   majority vote PER AXIS, confidence = vote share. The axes vote
   independently — that's the disentanglement claim being tested.
3. **Eval** — `ml/scripts/eval_problem_classifier.py`: stratified 80/20
   split (by conceptId), leave-one-out on the 20%, report per-axis
   accuracy + top-3 concept accuracy + a concept-axis confusion summary
   and a format-axis one. Write `ml/data/problem_classifier_eval.json`.
   Useful-bar (not a hard gate — this is measurement): concept top-1
   ≥ ~70%, top-3 ≥ ~85%; format ≥ ~85%. If format accuracy is high while
   concept accuracy is high AND their errors are uncorrelated, the
   orthogonal-axes hypothesis holds on real data — report the error
   correlation explicitly.
4. **Endpoint** — `POST /classify-problem { text }` on serve.py (auth as
   usual) returning the classify() payload. First consumer: Problem
   Solver auto-tagging (Product follow-up, separate task: show “looks
   like {concept} / {format}” chip on pasted problems).
- [ ] Index builds from all 4 sources (count logged ≥ 1,700).
- [ ] Eval JSON committed with the numbers + error-correlation stat.
- [ ] `/classify-problem` live on the Space; classifying one Eedi holdout
      question returns its true labels.

### 3b — Generation conditioned on the grid
- Generation prompt takes (concept, format) as independent knobs:
  same-concept-different-format for format-gap remediation; same-format-
  different-concept for bridge drills. The essence extraction
  (ml/generation) already isolates concept essence — add a format
  transformation stage: “re-dress this essence as a {format} problem.”
- Verify pass must check BOTH: answer key correct AND format actually
  changed (classifier from 3a is the checker — generation and
  identification close the loop on each other).
- Gate: the known ~30% bad-key rate must be fixed first (existing
  blocker in FORMAT_WEAKNESS_PLAN) — don't scale a generator that's wrong
  a third of the time, no matter how well it varies format.

### 3c — Where this meets the strength vector
With (concept, format) on every question AND step-level evidence from
Part 2, the student state factorizes: performance = concept mastery ×
format fluency × bridge strength. That's the measurement model the
Layer-4 `representation_profile` schema was designed for — this
workstream is what finally populates it with real data.

---

## Suggested order
1. ~~Part 1 (+ 2a tagging)~~ — DONE (commit a39148e5).
2. NOW: 2b + 3a (Codex, Engine — disjoint modules) ∥ 2c (Cursor, Product).
3. Then 2d (Engine, needs 2b) + the 2b/3a Product follow-ups (rule chips, classify chip).
4. Part 3b stays gated on the generation bad-key fix (FORMAT_WEAKNESS_PLAN).
