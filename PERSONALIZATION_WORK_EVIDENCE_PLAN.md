# Build plan: dashboard personalization + bookmarks + work-evidence loop + format/concept disentanglement

Three parts. Part 1 is buildable now (Product). Part 2 is the flagship
future workstream — it turns student ink into first-class mastery
evidence. Part 3 is Engine research direction for the generation pipeline.

---

## Part 1 — Dashboard personalization + question bookmarks (Lane: **Product**, buildable now)

Follow DASHBOARD_NOTEBOOK_SPEC.md (paper system) and BRAND_BOOK.md. All
personalization persists on the student's own `users/{uid}` doc (plain
client writes — non-privileged fields, allowed by rules).

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

## Part 2 — FUTURE WORK: ink → named steps → session notes → strength vector

The full loop, building on INK_WORK_MODEL_PLAN (strokes/workLines/
`/check-work` are the substrate — Phases 1-3 shipped):

### 2a — Tag written work to its question
Every scratch capture gets `questionId` (+ `conceptId`, `source:
'practice'|'chapter'|'session'`). ConceptChapterPage currently keeps
per-question ink only in component state — persist it (Firestore
`student_work` entries keyed by student + question) so work is queryable
by question later. SessionWork already persists; add the question linkage.

### 2b — Rule-naming step highlights (Engine + Product)
Extend `/check-work` from verdicts to **named transformations**: for each
consecutive OK line pair, classify the step deterministically by diffing
the sympy equations — `subtracted 4 from both sides`, `divided both sides
by 2`, `distributed`, `factored`, `combined like terms`, `squared both
sides`… (a rule taxonomy ~15 entries covers most algebra; map each rule id
to ontology ingredient ids). Response gains
`verdictPerLine[i].rule: { id, label, ingredientIds }`.
Frontend: the existing line-overlay (bbox highlights) gets a hover/tap
label naming the rule — highlights that TEACH, not just flag.

### 2c — Session notes as a question-work ledger
Session notes view becomes: list of questions the student worked (from 2a
tags) → selecting one opens the SAME layout as practice solving, but
read-only with the ink + rule-named highlights from 2b. Tutor sees exactly
what the student did and which rules they used. (This replaces/augments
the bullets-from-transcript view for practice-derived entries.)

### 2d — Feed the strength vector (the payoff)
Today mastery evidence is answer-level (right/wrong + effort). Named,
CAS-verified steps are **ingredient-level evidence with near-zero noise**:
- Each verified rule application = a positive learning event on that
  rule's `ingredientIds` (via existing `/submit-answer`-style aggregation
  or a new `source: 'verified_step'` event with high confidence weight).
- A broken step (first wrong line) = targeted negative evidence on the
  attempted rule's ingredients — this is exactly the “confirmed weakness”
  the asymmetric strength scoring (engine/features.py) wants: high effort
  + failure, now WITH the specific mechanism.
- Design constraint: follow Layer-4 `evidence_update_policy` — don't
  over-update from one problem; steps within one problem are correlated,
  cap their combined weight.
- This also sharpens bridge-gap detection: a student who executes rules
  fine inside concept A but never successfully applies A-rules inside
  B-context problems is a bridge failure with direct evidence.

Sequencing: 2a is small and should ride with Part 1 (it's just tagging +
persistence — every session without it loses evidence we can't recover).
2b-2d gate on wanting the engine deployed (currently HF migration).

---

## Part 3 — FUTURE WORK (Engine research): disentangle format from concept in generation

Goal (Blake's orthogonal-axes idea): the system should treat WHAT a
problem tests (concept/ingredients) and HOW it's dressed (format/
representation: word_problem, symbolic, diagram, coordinate_graph,
number_line, table) as independent axes — both for **identifying**
existing problems and **generating** new ones. That grid is what powers
format-gap vs concept-gap separation (C1/C2 contracts) and the bridge-gap
mechanism.

### 3a — Identification: (concept, format) classifier
- Input: raw problem text → output canonical `conceptId` + `FormatId`
  (+ confidence). Grounding data already exists: ~1,700 questions tagged
  with both axes (the bank IS a labeled dataset), plus Layer-2 archetypes'
  `concept_path_template`s.
- Approach order: (1) embedding nearest-neighbors against the tagged bank
  (deterministic, no training, reuses representation/embeddings.py);
  (2) only if precision disappoints, a small supervised head. Evaluate on
  a held-out slice; report per-axis accuracy separately — the whole point
  is the axes must not contaminate each other.
- Immediate use: auto-tag past papers / pasted problems (Problem Solver
  input!) with (concept, format) → routes into the right practice cell.

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
1. Part 1 (+ 2a tagging) — one Product agent session now.
2. Part 3a identification — Engine, cheap, high leverage (auto-tagging).
3. Part 2b-2d — after the HF migration stabilizes the engine deploy.
4. Part 3b — after the generation key-accuracy blocker is fixed.
