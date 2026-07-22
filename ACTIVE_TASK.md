# Active Task — MindCraft
> Updated at the end of every session by every agent. The FIRST thing any agent reads.
> Keep entries short. Delete completed items after 2 sessions.

---

## CURRENT SPRINT — 2026-07-21

### Canvas ACT notebook (this session)
Replaced two-page book scroll with **one big canvas desk**: pretty cover →
short intro → horizontal contents + wizard mascot; Map = emoji constellation;
Work = PDF homework or paste-solver; weekly practice paper scaffold
(`weeklyPracticePaper.ts`) mixes weakness + learn. Story art plates for
fractions/quadratics/probability. Manjushree still local / uncommitted.

**2026-07-21 follow-up pass (concept-accurate art + Practice concept-lock):**

- **Done:** built a real, rerunnable concept-art pipeline
  (`app/scripts/generateConceptArt.mjs`, Higgsfield `seedream_v5_lite`).
  `storyArt.ts` now auto-discovers anything dropped in
  `app/src/assets/canvas/generated/story-{conceptId}.jpg` via
  `import.meta.glob` — **no code edit needed to register new concept art**,
  future runs are truly rerunnable. Spent the account's only 1 remaining
  Higgsfield credit on `fractions_decimals` (Simon Stevin / Antwerp 1585
  ledger scene) — exactly the "pizza ≠ Stevin ledger" example Akshat flagged.
  **1 of 27 ACT-tested concepts now has real concept-accurate art; the other
  26 are still on the old shared/theme-fallback photos, blocked purely on
  Higgsfield credits** (run `node app/scripts/generateConceptArt.mjs --list`
  to see priority order by `actFrequency`, then
  `node app/scripts/generateConceptArt.mjs --top N` once credits are topped
  up — each concept costs 1 credit at `seedream_v5_lite` quality `high`).
  Manifest of every generation (prompt, cost, source URL, protagonist) is at
  `app/scripts/conceptArtManifest.json`, append-only, never double-spends on
  an already-generated concept.
- **Done: Practice concept-lock decision (item 2 in the brief) — resolved as
  (a), concept-lock wins.** `storyMatch.ts#matchSkinForQuestion` now checks
  `selectStoryForConcept` (the SAME locked protagonist/setting
  `ConceptChapterPage.tsx` uses) **before** folk-tale matching, only falling
  back to a folk tale for the handful of concepts with no locked story.
  Reasoning: art is concept-keyed, not tale-keyed, so a folk-tale skin (e.g.
  Kwame) under concept-locked art (e.g. a Simon Stevin photo) was a real
  world/art mismatch; and Practice's own local/offline fallback
  (`framedLocalStem` in `Practice.tsx`) already rendered the concept-locked
  story immediately, so folk-tale-first meant the protagonist could visibly
  swap mid-session once Groq's story-module response landed. Traded away:
  folk-tale variety for the ~40 concepts that already have a locked story
  identity (folk tales still fire for spark/`FirstSpark.tsx`, untouched, and
  for any concept with no `conceptStories.json` entry). Verified via the
  chapter's own embedded question panels (same `storyArtFor()` +
  `selectStoryForConcept()` code path Practice.tsx uses) —
  see screenshot below.
- **Verification (all real, this session, after reverting every temp
  screenshot aid):** `npx tsc --noEmit` clean. `npx vitest run` → **85
  passed, 1 skipped (86 total)** — identical to the pre-change baseline, zero
  regressions. `npm run build` green (`story-fractions_decimals-*.jpg` now in
  the bundle at 149.30 kB, same ballpark as the existing story plates; the
  pre-existing 5.3 MB main-chunk size warning is unchanged, not introduced by
  this pass). Screenshots (cover → intro → desk Home/Map/Work/Notes →
  fractions_decimals chapter with the new art → chapter's embedded practice
  question panel with the same art) at
  `agent_work/canvas-notebook/screenshots/` — captured via a temporary,
  env-gated (`VITE_SCREENSHOT_MODE`) auth shim in `App.tsx` + `Dashboard.tsx`
  (no test Firebase account was available), **fully reverted** before this
  entry was written; `grep SCREENSHOT app/src/App.tsx app/src/pages/Dashboard.tsx`
  returns nothing.
- **Open / next steps:**
  1. Top up Higgsfield credits, then run
     `node app/scripts/generateConceptArt.mjs --top 26` (or fewer, budget
     permitting) to cover the rest of the 27 ACT-tested concepts, highest
     `actFrequency` first (`linear_equations` 0.18, `algebraic_manipulation`
     0.16, `basic_equations` 0.14, `functions_basics` 0.13… see
     `node app/scripts/generateConceptArt.mjs --list` for the full order).
  2. Could not screenshot the standalone `/practice` route with a real,
     data-driven question loaded — it requires router `state` from an actual
     PawHub/dashboard launch (weakness/learn recommendation data), which
     needs a real authenticated session; the auth shim only faked the React
     user context, not a real Firebase ID token, so Firestore reads
     (recommendations, diagnostic status) all 403'd. Verified the same code
     path is wired in by reading `Practice.tsx` (`storyArtFor`,
     `selectStoryForConcept`, `matchSkinForQuestion`) instead — a real login
     is the only way to close this out visually.
  3. `mc-diagnostic.js` overlay retarget (pre-existing open item, untouched
     this pass — see "Known gotchas" in `CLAUDE.md`).

**2026-07-21 second follow-up pass (Fable 5 — marketing trim, dashboard
polish, 26 hand-authored SVG plates, alt-text bug fix):** four pieces of
direction from Akshat, all done.

- **1. Marketing copy trim.** Read `BRAND_BOOK.md` sections 8 + 11 first, then
  read all 5 files named in the brief. `review-questions.html` (20,625 lines)
  and `architecture.html` (1,474 lines) turned out to be internal dev tools
  (a QA question-bank dump and an engineering system-architecture diagram),
  not marketing prose — left untouched, no user-facing copy to trim there.
  `index.html` was already fairly tight from a prior redesign pass (short
  fragment-style copy); trimmed 3 remaining 2-sentence paragraphs (system
  section, pricing section, tryapp section) down to one clean sentence each,
  no claims/numbers touched. `article.html` had the real wordiness: two blog
  posts with repetitive, passive-voice prose (e.g. the mission post's opening
  line was said almost verbatim in both the excerpt AND the first body
  paragraph). Rewrote both posts' body copy — verbs first, cut repeated
  ideas, cut passive constructions ("all of the information discussed will
  be documented and organized" → "everything discussed gets documented").
  `blog.html`'s duplicate excerpt synced to match. **Also removed every em
  dash found in all 3 files** (both in copy and in code comments, for full
  compliance) — `article.html` had 6, `index.html` had 2 (pre-existing, in
  CSS/JS comments). Diff: touched lines went from 508 words to 342 words
  (33% shorter) in `article.html`; `git diff --stat` shows
  `article.html 26 changed, index.html 10 changed, blog.html 2 changed`. No
  facts/stats/claims altered anywhere — confirmed via `git diff`, every
  change is either a cut or a rephrase of existing content.
- **2. Dashboard polish pass.** Structural layout untouched (cover → intro →
  desk → chapters stays exactly as the prior pass shipped it), pure visual
  craft. Root cause found for a real bug, not just aesthetics: the Notes
  panel (`DashboardNotesPanel` via `DashboardPanels.module.css`) depends on
  CSS custom properties (`--rule`, `--ink-katha`, `--paper-raised`, `--font-
  katha`, etc.) that only exist inside the OLD `BookShell` (`.shell` in
  `components/book/Book.module.css`) — which no longer wraps the Notes view
  in the new canvas-desk layout, so those `var()` calls were silently
  resolving to nothing. Screenshots confirmed the effect: the search input
  had no visible border and "No notes yet." was nearly invisible. Fixed by
  defining the same variable names on `.canvasStage` (Dashboard.module.css),
  tuned to the canvas desk's own palette rather than the book's. Beyond that
  fix: introduced a shared design-token scale (`--desk-radius-sm/md/lg`,
  `--desk-shadow-soft/raised/stage/sticker(-hover)`, `--desk-border-sticker`,
  `--desk-ease(-bounce)`) on both `.canvasDesk` (Dashboard.module.css) and
  `.chapterDesk` (ConceptChapterPage.module.css) — same names, same values —
  so the dashboard desk and the chapter canvas draw from one vocabulary
  instead of two independently-tuned ones (this was the concrete form of the
  "several UIs stapled together" complaint: chip/button corner radii and
  shadow depths differed between files with no shared reference). Applied to
  `ActEmojiMap.module.css` and `WorkStudio.module.css` too (defensive
  fallback values included so nothing breaks if a component ever renders
  outside `.canvasDesk`). Added hover/active micro-interactions
  (translateY + shadow growth on chips/pills/buttons, consistent
  ~160ms cubic-bezier bounce) that were entirely missing before — buttons had
  no hover feedback at all. Real before/after screenshots (not just
  asserted) at `agent_work/canvas-notebook/screenshots/before_*.png` vs
  `after_*.png` (Home, Map, Work, Notes — Notes is the clearest diff, text
  went from unreadable to legible).
- **3. 26 hand-authored SVG concept illustrations** (`app/scripts/
  generateConceptArtSvg.mjs`, sibling to the Higgsfield pipeline, NOT an
  image-generation model — genuinely hand-composed SVG markup). Covers all
  26 of the 27 ACT-tested concepts still on fallback art (`fractions_decimals`
  already had the real Simon Stevin photo from the prior pass; left that file
  alone). Zero skipped. **Style decision** (documented in the script's own
  header comment too): sampled the actual rendered colors out of
  `story-fractions_decimals.jpg` (warm cream walls, Stevin's navy coat,
  golden wheat-bowl light) and built the palette from that instead of
  guessing — warm parchment background, warm ink-brown linework (not flat
  black), navy `#1d3a8a` as the one signature accent per figure (this is
  ALSO literally MindCraft's own brand "Depth" color, `BRAND_BOOK.md`
  section 9 — a deliberate double-bridge, not a coincidence), warm gold for
  props. Reasoning for why this doesn't clash with the one photoreal plate:
  a real notebook where one page got a full watercolor treatment and the
  rest are pen-and-wash sketches reads as normal, not inconsistent — same
  palette family, different rendering weight. Every scene = one shared
  "cloaked scholar" figure archetype (recolored/reposed per protagonist,
  mirroring how `generateConceptArt.mjs` reuses one fixed `STYLE_FORMULA`
  string across every photoreal generation) + hand-drawn setting props for
  that concept's locked `questionContextFrames.json` protagonist/setting +
  ONE bespoke hand-drawn math metaphor per concept invented specifically for
  that concept (rope-stretched 3-4-5 triangle for right-triangle geometry,
  a balance scale for basic equations, the doubling-grains chessboard for
  exponent rules, Hippasus going overboard for radical expressions, the
  Alhambra tessellation for geometric transformations, etc. — genuine
  per-concept craft, not a template swap). Wired into `storyArt.ts` via a
  second `import.meta.glob` for `story-*.svg` alongside the existing `.jpg`
  glob, feeding the same `GENERATED` lookup map — `storyArtFor()` stays the
  single function every caller uses, no other code changed. Bundle cost:
  all 26 SVGs total 272KB uncompressed (most under the 4KB Vite inline
  threshold and get base64-embedded directly in the JS, the rest emit as
  tiny separate files, 40KB total in `dist/assets/`) — versus 149KB for the
  ONE existing photoreal JPG plate. Verified in real chapter context (not
  just the raw SVG file): screenshots of 5 chapters
  (`right_triangle_geometry`, `quadratic_equations`, `circles_geometry`,
  `basic_probability`, `linear_equations`) at
  `agent_work/canvas-notebook/screenshots/chapter_*.png`, all showing the
  new art in the actual polaroid-framed chapter layout next to the real
  story text. **Noticed but out of scope to fix:** `quadratic_equations`'s
  chapter header correctly says "Muhammad al-Khwarizmi" (matches the new
  art) but the body paragraph below it opens with an unrelated Galileo
  anecdote — a pre-existing `conceptStories.json` content mismatch between
  the locked protagonist and the story's own opening sentence, same root
  cause noted for `measurement_units` in this file already. Not something
  this pass touched (Product-lane art wiring, not Engine-lane story data);
  flagging for whoever owns `conceptStories.json` next.
- **4. Alt-text-as-literal-text bug, fixed with a real diagram renderer, not
  just reformatted text.** Root cause: `MathText.tsx`'s `replaceMarkdownImages()`
  already converted Eedi's `![alt]()` images into `(Diagram: alt text)`, and
  `HighlightedStem.tsx` already gave the stem's version a bordered callout
  box — but both just showed the raw alt-text sentence verbatim inside it,
  and answer CHOICES (rendered via plain `MathText`, no callout at all) had
  it worse: no box, no framing, just a run-on sentence mid-button. Also
  found: `components/QuestionFigure.tsx` (a real geometry/graph SVG
  renderer, including a `numberline` shape) exists in the codebase but is
  **not imported anywhere** — completely unwired dead code, a bigger finding
  than the reported bug itself. Rather than force-fit alt-text parsing into
  that stem-only, non-alt-text-aware system, built a purpose-built pipeline:
  `lib/altDiagram.ts` (`parseAltDiagram()` — recognizes two real Eedi alt-text
  families: "N dashes, dash K marked with value V, arrow pointing at dash J"
  number lines, and "circle at value V, arrow pointing left/right" inequality
  rays; `humanizeAltCaption()` — light cleanup fallback for anything else,
  never invents content) + `components/AltDiagramCallout.tsx` (draws a real
  SVG diagram for a recognized pattern, otherwise renders the cleaned text
  in a clearly-labeled "Picture: ..." callout instead of a bare sentence).
  Wired into BOTH `HighlightedStem.tsx` (stem) and `MathText.tsx` (choices,
  hints, anywhere else `(Diagram: ...)` can appear) so the fix covers
  wherever this pattern shows up, not just the one reported spot. Verified
  against the EXACT reported bug text (`eedi_696`, `fractions_decimals`,
  "Line with 5 dashes... First dash marked with a 1 fourth dash marked with
  a 2. Blue arrow pointing upwards towards the third dash.") via a temporary
  dev-only route rendered through the real running app (not a mock) — now
  draws 5 tick marks, "1" under tick 1, "2" under tick 4, a navy arrow over
  tick 3 — screenshot at `agent_work/canvas-notebook/screenshots/
  altdiagram_fix_verification.png`, temp route fully removed after.
  **Honest scope count** (`eediQuestions.json`, 1,508 records): 439 questions
  have a `(Diagram:`/`![...]()` pattern in the STEM (many already handled
  reasonably by the existing stem callout box; the ones matching the two
  patterns above now get a real diagram, the rest get the improved fallback
  caption); separately, **62 questions have it in at least one ANSWER
  CHOICE** (242 individual choice strings total) — those were the worst case
  (zero framing at all before this fix) and are now fixed the same way.
  Not hand-fixed one-by-one — the rendering path is fixed for all of them at
  once, per the brief.

**Verification (all real, this session):** `npx tsc --noEmit` clean.
`npx vitest run` → **85 passed, 1 skipped (86 total)**, unchanged from
baseline. `npm run build` green — main JS chunk `5,399.84 kB` (was `5.3 MB`
per the prior entry, the ~100KB delta is the 21 base64-inlined SVGs, expected
and small). `grep manjushree app/src/App.tsx` still shows the lazy import +
both routes. Screenshot inventory (all real, captured via a temporary
env-gated `VITE_SCREENSHOT_MODE` auth shim in `App.tsx`/`Dashboard.tsx`,
identical technique to the prior pass, fully reverted — `grep SCREENSHOT
app/src/App.tsx app/src/pages/Dashboard.tsx` returns nothing) at
`agent_work/canvas-notebook/screenshots/`: `before_*`/`after_*` (dashboard
Home/Map/Work/Notes, both states), `chapter_*` (5 chapters with new SVG
art), `altdiagram_fix_verification.png`. Did not touch
`app/src/manjushree/**` or `agent_work/manjushree-zone/**`.

### Magical doodle notebook dashboard makeover (prior)
**Done:** lavender desk + spiral-ring gutter + margin star mascot (`Book.module.css` /
`BookShell`); sticker MCQ hover swell + soft-wrong wiggle (no red buzz) + stamp/confetti
reward (`DoodleReward`, Practice matte + Concept chapter); Map/GPS simplified — primary
CTA opens `/concept/:id` notebook lesson (same BookShell as dashboard); explore tiles
stickerized; learn CTA opens chapter not raw practice.
**Do not include Manjushree** in this commit — still awaiting playthrough sign-off below.

### Manjushree hidden action-math zone

**Read first:** `agent_work/manjushree-zone/HANDOFF_FOR_CLAUDE.md`, then
`MANJUSHREE_ZONE_REPORT.md` and `MANJUSHREE_ASSET_MANIFEST.md`'s 2026-07-21 2D-pivot
section (at the top of that file). Spec: `ORIGINAL_SPEC.md`. Full pivot reasoning + all
new lessons from this pass: `LESSONS.md` (durable lessons 19-27 + the pivot explainer at
the top).

**Status: rebuilt from Three.js 3D to a 2D layered-illustration scene (agent
`ab4994a97e2c6dc7f`), independently re-verified, NOT yet committed. The only remaining
gate is Akshat's own playthrough/sign-off — do not commit or push until that happens.**

**What changed in this pass**: the entire 3D presentation layer (`engine/ZoneEngine.ts`,
`world.ts`, `overlay.ts`, `postfx.ts`, the old `ManjushreeZone.tsx`'s Three.js mounting)
was archived (not deleted) to `app/src/manjushree/_archive-3d/` — see that directory's own
`README.md` for how to restore it if ever needed. `math/quadratics.ts` (untouched),
`math/content.ts` and `state.ts` (both adapted, not rewritten), and `telemetry.ts`
(untouched) were kept — they had zero rendering imports, so the entire visual swap cost
them almost nothing. `math/mapping.ts` was rewritten (same "one shared function" principle,
now targeting SVG percent-space instead of Three.js world units). The zone is now a plain
DOM/CSS layered scene matching the house style of `spark/spark.js` and
`components/book/**`, with one dedicated SVG component (`ParabolaOverlay.tsx`) for the one
thing that deserves genuine math-driven drawing: the parabola curve itself.

**Gameplay simplified** per the owner's own description: arrival (establishing
illustration) → villager dialogue (a real short exchange, not a text dump) → travel
transition → Wisdom Sight reveal → roots ("sword power", first charge) → axis-of-symmetry
+ vertex height as two rune-stone sub-steps inside ONE "cleave power" encounter (dropped
axis as its own separately-gated phase, per the brief — the math/misconception checks
underneath are unchanged) → hold-to-strike → a 5-6s cut cinematic (crack-line SVG reveal +
two CSS `clip-path` image halves separating + an unclipped turquoise water layer
underneath) → result / learning summary (same content/structure as before, restyled).

**Three real Higgsfield-generated 2D illustrations** (all in `app/src/manjushree/assets2d/`,
full prompts/costs in the asset manifest): the valley/hill background (reused across
arrival, hill, and cinematic beats via CSS framing/clip-path, no second image needed), the
villager sprite, and the sword/charge icon. 4 of 5 available credits spent, 1 left
unspent as reserve.

**Re-verified after the full rebuild (by Claude, not just trusting agent output):**
`tsc --noEmit` clean, `vitest run` **85 passed + 1 pre-existing skip (86 total)** — up
from 82 total before this pass (3 new mapping tests + 3 new vertex-height-candidate tests,
zero regressions), `npm run build` green — the Manjushree chunk is now **~44KB JS / ~17KB
CSS** (was ~622KB with the Three.js engine). A full scripted Playwright playthrough
(`/manjushree-dev?q=mjz_q01`) drove the entire loop end to end (both a wrong-answer trap
path and a correct path at every gated step) and captured 24 screenshots into
`agent_work/manjushree-zone/screenshots/2d_pivot_2026-07-21/` — reviewed all of them
personally and found + fixed 4 real bugs this way (not just eyeballed): a duplicated
villager sprite behind the dialogue panel, a duplicated travel-line toast, the parabola
curve plunging off-screen outside the roots (needed the same `Math.max(0, ...)` clamp the
old 3D ridge mesh used), and the cinematic "water flowing through the gap" being invisible
(the water layer was clipped to the same shape as what was moving over it, so it could
never show in a NEW gap — fixed by making it a static full-bleed layer underneath instead).
Also fixed a stroke-dasharray/`pathLength` SVG animation technique that rendered as broken
fragments under non-uniform `preserveAspectRatio="none"` scaling (both the curve reveal and
the crack-line reveal used it) by switching to a plain opacity fade, and a strike-charge
progress ring that was invisible against its own button's active-state color.

**Next (in order):**
1. **Akshat plays it himself.** `cd app && npx vite --host 0.0.0.0 --port 5199 --strictPort`
   then open `http://localhost:5199/manjushree-dev` (no auth needed) or
   `?q=mjz_q01` to pin the legend quadratic. Signed-in path: Dashboard → the hidden portal
   button → `/manjushree`.
2. If he's happy: commit (Product lane files: `app/src/manjushree/**`, `app/src/App.tsx`,
   `agent_work/manjushree-zone/**`) and push to `main` — CI auto-deploys. Note: the
   Dashboard.tsx/Dashboard.module.css portal snippet already landed in commit `69bbf4c4`
   (a concurrent dashboard-redesign session on this same checkout swept it up while
   committing its own unrelated work) — verify it's still there (`grep manjushreeGlow
   app/src/pages/Dashboard.tsx`) rather than assuming it needs re-adding. **App.tsx got
   fully overwritten by that same concurrent session at least once this pass and had to
   be re-applied** — before shipping, re-confirm `grep manjushree app/src/App.tsx` still
   shows the lazy import + both routes, in case it happened again after this session ended.
3. If not: describe exactly what's still wrong and start a new focused pass — the 2D
   scene/math/state underneath is solid and tested, only iterate on what's actually broken.
4. Optional, not blocking: Firestore `events` create rule (telemetry currently soft-fails
   on writes with no matching rule — unchanged gap from before this pass, see
   `MANJUSHREE_ZONE_REPORT.md`).
5. Read `agent_work/manjushree-zone/NEXT_RUN.md`'s "bigger vision" section before starting
   any follow-up work here — this chapter is explicitly a proof-of-concept for a much
   larger per-question story-world pattern Akshat wants eventually, and he was explicit
   about NOT forking attention across multiple chapters/questions until this one has "a
   decent run."

**Everything else in this repo is already committed and pushed to `main`** as of commit
`d8fbcbe3` — this Manjushree work is the only uncommitted thing in the working tree.

**Why this matters beyond this one chapter**: Akshat revealed the actual long-term goal —
every question, on its own page, should eventually become an embedded 2D story-world with
space to write, paying off on completion with a narrative tied to the concept solved
("you saved a city"). Manjushree Zone is the deliberate first proof-of-concept for that
reusable pattern; other questions/concepts follow only after this one has "a decent run"
(his explicit sequencing — don't fork attention across many at once). Full writeup:
`agent_work/manjushree-zone/NEXT_RUN.md` (new section at the bottom, "The bigger vision
this is a proof-of-concept for").

---

## Previous sprint — 2026-07-08

### Cursor — Product lane (`app/**` ONLY)
**Spec:** `agent_work/product/STORY_INTRO_RENDER_SPEC.md`

Add the `storyIntro` rich narrative scene block. Three files to touch:
1. `app/src/lib/questionBank.ts` — add `storyIntro?: string` to `Question` interface
2. QuestionPage CSS module — add `.storyIntroBlock` class (spec has the exact CSS)
3. The component that renders `storyContext` — prepend the storyIntro block above it
   (`grep -rn "storyContext" app/src/` to find it)
4. Add real storyIntro to 5+ story cells following tone rules in the spec

Verify: `npm run build` passes. Commit, push to main.

✅ Done (Fable 5 + Cursor) — `storyIntro?: string` added to `Question`; storyContext only actually
renders in `GradeOnboard.tsx` (spec's assumed `book/QuestionPage.tsx` doesn't exist), so the
italic `.storyIntroBlock` was added to `GradeOnboard.module.css` and rendered above the
existing `storyContext` line there; 6 storyCells.json cells (fractions_decimals ×2,
linear_equations ×2, ratios_proportions ×2) got real storyIntro content. **Cursor follow-up:**
same blocks wired into `Practice.tsx` session UI (journal paper theme via `.matteShell` /
`.paperScan` overrides). `npm run build` green.

**Do NOT touch:** `ml/**`, `homework/**`, `webhook/**`, `index.html`

---

### Codex — Engine lane (`ml/**` ONLY)
**Primary spec:** `agent_work/engine/STORY_CELL_SCALE_PLAN.md` (read Sections B + D)

**Task 1 first:** Write `ml/mindcraft_graph/world_feedback.py` (spec Section D)
- Exports: `WORLD_FEEDBACK_SYSTEM_PROMPT`, `build_world_feedback_user_prompt(...)`, `generate_world_feedback(...)`, `cache_key(...)`
- After writing, update `ml/scripts/world_feedback_generator.py` to import from this module
  (replace the duplicated inline versions)

✅ Done (Claude Code, 2026-07-08) — `ml/mindcraft_graph/world_feedback.py` created (also exports
`load_cache`/`save_cache`/`build_ontology_index`); `world_feedback_generator.py` refactored to
import from it, dry-run output unchanged (`total=138 filled=121 cached=0 no_misconception=17 errors=0`).

**Task 2 after Task 1:** Write `ml/scripts/generate_story_cells.py` (spec Section B)
- DNA cells in → math verified → Katha-narrated → Gate A scored → output JSON
- Uses `ml/generation/llm_client.py` for all LLM calls
- Math integrity auto-verify: re-solve, discard on disagreement
- Dry-run must pass: `python3 ml/scripts/generate_story_cells.py --dry-run`

✅ Done (Claude Code, 2026-07-08) — 4-step pipeline (math spine → independent re-solve verify →
Katha narrative → 7-dim pedagogy score/gate) built; per-distractor `world_feedback` generated via
the shared module from Task 1. `--dry-run`, `--limit`, `--concept`, `--dna-file`, `--no-llm` all
wired; live run needs `LLM_PROVIDER=groq` (no GROQ key in this sandbox, so only dry-run + a
graceful-failure smoke test were exercised here — verified error handling drops cleanly with no
crash when the LLM is unreachable). **Cursor fix:** inlined `extract_json_object` so `--dry-run`
works without importing `pipeline/base.py` (which pulls `requests`).

Commit after each task. Push to main.

**Do NOT touch:** `app/**`, `serve.py`, deployed endpoints

---

---

## In progress RIGHT NOW

| Task | Agent | Files touched | Status |
|------|-------|--------------|--------|
| Marketing nav + stats + about fix | Claude Code | `index.html` | ✅ Done |
| Jarvis on-screen journal guide | Cursor | `app/src/lib/journalGuide.ts`, `app/src/hooks/useJournalGuide.ts`, `app/src/components/JarvisGuide.tsx`, `app/src/components/JarvisGuide.module.css`, `app/src/components/HighlightedStem.tsx`, `app/src/components/HighlightedStem.module.css`, `app/src/components/ScratchTranscriptionPane.module.css`, `app/src/pages/ConceptChapterPage.tsx`, `app/src/pages/ConceptChapterPage.module.css`, `app/src/pages/GradeOnboard.tsx`, `app/src/pages/GradeOnboard.module.css` | ✅ Done |
| UX fixes (7 items) | Claude Code | see below | ✅ Done |
| Ingredient story cells + evidence reports | Codex | `ml/scripts/pipeline/story_cell_studio.py`, `ml/scripts/enrich_questions.py`, `ml/scripts/aggregate_misconception_evidence.py`, `ml/data/story_cells/batch_ingredient_v1.json`, `ml/data/story_cells/dry_run_ingredient_v1.json`, `ml/data/enriched/eediQuestions.json`, `ml/data/enriched/openstaxMCQ.json`, `ml/data/enrich_report.json`, `ml/data/misconception_evidence_report.json`, `ml/data/.story_cell_cache.json` | ✅ Done |
| Story Intelligence spec v2 — agent-loop human gates, diagnostic IG selection, worstWeakness tier 3, voice skins | Claude (architecture) | `STORY_INTELLIGENCE_SPEC_V2.md` (new), `CLAUDE_HANDOFF.md` (lane rows + done markers), `ACTIVE_TASK.md` | ✅ Done — design only, no code touched; implementation lanes assigned in spec §5 |
| Founder portrait expansion polish | Codex | `index.html`, `ACTIVE_TASK.md` | ✅ Done |
| Diagnostic placeholder cleanup + landing profiles | Codex | `app/src/data/storyCells.json`, `app/src/lib/questionBank.ts`, `app/src/components/QuestionFigure.tsx`, `app/src/pages/GradeOnboard.module.css`, `index.html`, `img/ab-founder.jpeg`, `img/mindcraftmascot.jpg`, `ACTIVE_TASK.md` | ✅ Done |
| Landing mascot/map/founder flip polish | Codex | `index.html`, `ACTIVE_TASK.md` | ✅ Done |
| Diagnostic ACT probe step | Codex | `app/src/pages/Diagnostic.tsx`, `app/src/data/actDiagnostic.json`, `app/src/pages/Diagnostic.module.css`, `ACTIVE_TASK.md` | ✅ Done |

**Codex diagnostic probe summary (2026-07-08):** ✅ Done — added the `probe` step between goals and confidence with four real ACT cluster anchors rendered through `MathText`.
Files changed: `Diagnostic.tsx`, `actDiagnostic.json`, `Diagnostic.module.css`, `ACTIVE_TASK.md`.
Verification: `npm run build` passed from `~/Developer/mindcraft/app`.

**Codex landing polish summary (2026-07-08):** ✅ Done — mascot is cropped instead of squished, CTA copy is punchier, map labels are shorter, and founder cards flip as full rectangles.
Files changed: `index.html`, `ACTIVE_TASK.md`.
Verification: `npm run build` passed from `~/Developer/mindcraft/app`.

**Codex diagnostic/landing summary (2026-07-08):** ✅ Done — removed stale tank placeholder cells from app data, added frontend safety filter, and stopped generic area/volume tags from drawing random XY grids.
Files changed: `storyCells.json`, `questionBank.ts`, `QuestionFigure.tsx`, `GradeOnboard.module.css`, `index.html`, `img/ab-founder.jpeg`, `img/mindcraftmascot.jpg`, `ACTIVE_TASK.md`.
Verification: storyCells now 12 curated / 0 tank / 0 template; no-install syntax/source checks passed; TypeScript not run because fresh clone has no `app/node_modules`.

**Codex founder UI summary (2026-07-08):** ✅ Done — founder stories now open as stable desktop overlays instead of resizing the two-column grid.
Files changed: `index.html`, `ACTIVE_TASK.md`.
Verification: read back CSS/JS changes; no git commands run.

**Codex ML summary (2026-07-08):** ✅ Done — story studio `--per-concept`, aggregate + enrich scripts, 99 ingredient cells structurally valid.
⚠️ **Quality gate:** deterministic fallback = same tank stem ×99 — **do not ship to app** until LLM batch completes. Use `python3 ml/scripts/merge_story_cells_for_app.py` (ships 3 LLM cells only).

**UX fix summary (2026-07-08):**
- ✅ Fix 1 — Jarvis right-side only: removed `<JarvisGuide side="question">` from `ConceptChapterPage.tsx` and `GradeOnboard.tsx`; added `user-select: none; cursor: default` to `HighlightedStem.module.css`.
- ✅ Fix 2 — ScratchPad expression evaluator + mini graph: `ScratchPad.tsx` new recursive-descent `safeEval`, `parseFnLine`, `MiniGraph` SVG component; overlay positioned by workLine bbox. Parents (`ConceptChapterPage.tsx`, `GradeOnboard.tsx`) pass `evalLines` prop.
- ✅ Fix 3 — ScratchPad eraser + session logs: eraser × button with 200ms fade + confirm-before-clear; Logs dropdown (last 5) keyed by `questionId` in `localStorage`; new CSS in `ScratchPad.module.css`.
- ✅ Fix 4 — Page flip animation: `PageFlipTransition.tsx` rotateY 7° → 90° with `backfaceVisibility: hidden`, `willChange`, `transformPerspective: 1800`.
- ✅ Fix 5 — GradeOnboard grade auto-advance + voice: grade buttons immediately advance step; caption text removed; goals step replaces chips with text input + `MediaRecorder` voice button (60s, pulsing); `GradeOnboard.module.css` updated.
- ✅ Fix 6 — World fullscreen lock: `mc-world-chrome.js` adds `fullscreenchange` listener + `userExitedIntentionally` flag set only on ESC; re-requests fullscreen on unexpected exit.
- ✅ Fix 7 — Booking button: added `{ to: '/book', label: 'Book a Session' }` to `Sidebar.tsx` NAV; removed duplicate text link from `DashboardNotesPanel.tsx` empty state.
| MCQ triple-verify pipeline | ✅ Done (Fable 5) | `ml/scripts/pipeline/mcq_generator.py`, `story_wrapper.py`, `sources/openstax.py`, `ingest.py`, `PIPELINE_MCQ_SPEC.md` | Committed `43e3d62d`, pushed |
| Practice session journal paper reskin | ✅ Done (Fable 5) | `app/src/pages/Practice.module.css` | Committed `0b698e2a`, pushed |
| iPad login + world diagnostic flow | Codex | `app/src/pages/Login.tsx`, `app/src/pages/Login.module.css`, `worlds/world2/index.html`, `worlds/world2/mc-world-chrome.js`, `worlds/world2/mc-diagnostic.css` | ✅ Done |
| Google login fullscreen bug | Cursor | `app/src/pages/Login.tsx` | ✅ Done — redirect auth on iPad; no fullscreen on login; fullscreen stays on Enter World |
| OpenStax MCQ 50-item test batch | Cursor | `/tmp/openstax_mcq_test_v3.json`, `ml/data/.mcq_test_v3_log.txt` | ✅ Done — **52% yield** (26/50) after concept balance + HTML alt recovery; full batch running |
| Story Cell Studio LLM batch (3) | Cursor | `ml/data/story_cells/batch_llm_002.json`, `story_cell_studio.py` | ✅ Done — real LLM cells (Steady Drift, Waterfowl Pond, Thales shadow) |
| OpenStax MCQ full batch (5 concepts) | Cursor | `ml/data/openstaxMCQ.json`, `ml/data/.openstax_mcq_full_log.txt` | ✅ Done — **221 questions** (29.3% of 753); wire in Product lane |
| Founder section copy + photos | Codex | `index.html`, `img/akshat-koirala.jpg` | ✅ Done |
| Landing visual polish + mascot | Codex | `index.html`, `img/fibonacci-bear.svg` | ✅ Done |

✅ Done — removed the awkward hero arrow, fixed the triangle connector, and cleaned red process arcs/labels.
✅ Done — tightened section language and replaced wordy chips with visual signal cards.
Files changed — `index.html`, `img/fibonacci-bear.svg`, `ACTIVE_TASK.md`.

✅ Done — Jarvis margin companion: pencil notes in the red margin, lime highlighter on question stems, reads scratch ink + debounced `/api/jarvis` coach nudges.
✅ Done — Wired into chapter spreads + login diagnostic probe (left=question highlights, right=work + transcription readout).
Files changed — `journalGuide.ts`, `useJournalGuide.ts`, `JarvisGuide.*`, `HighlightedStem.*`, `ConceptChapterPage.*`, `GradeOnboard.*`, `ScratchTranscriptionPane.module.css`, `ACTIVE_TASK.md`.

✅ Done — founder copy is shorter, more human, and less resume-like.
✅ Done — Akshat's real headshot is now in `img/akshat-koirala.jpg`; Blake still needs an actual `img/blake-kell.jpg` file.
Files changed — `index.html`, `img/akshat-koirala.jpg`, `ACTIVE_TASK.md`.

✅ Done — login now has responsive iPad/iPhone/MacBook sizing plus a user-triggered fullscreen option.
✅ Done — world entry removes visible `3D | Web` and `Click Projects` chrome, wakes audio on Enter, and opens diagnostics automatically.
Files changed — `app/src/pages/Login.tsx`, `app/src/pages/Login.module.css`, `worlds/world2/index.html`, `worlds/world2/mc-world-chrome.js`, `worlds/world2/mc-diagnostic.css`.

---

## Recently completed (this session)

- ✅ Concept vignettes: 40 SVGs in `ConceptVignette.tsx` (was 6)
- ✅ Scene stamp on story pages: protagonist + setting shown on first story spread
- ✅ Multi-source pipeline: `ml/scripts/pipeline/` with OpenStax/AMC/Khan adapters
- ✅ OpenStax 37 MCQs wired into `questionBank.ts`
- ✅ Khan empty slot wired (API 410, needs offline dump at `ml/data/khan/exercises.json`)
- ✅ Practice session reskin to journal paper (FABLE5 Area 1 complete)
- ✅ Pre-test audit: all items green (mc-diagnostic.js, ML endpoints, scene stamps, TS)
- ✅ WORLD_VISION.md extended: pipelines, MCP, Roblox dimension, story quality standard
- ✅ AGENTS_QUICKSTART.md + ACTIVE_TASK.md created (this file)
- ✅ ML pointed to HF Spaces in `.env.production` + webhook (not Cloud Run)

---

## Blocked / needs human input

| Item | Blocker | What's needed |
|------|---------|--------------|
| AMC questions | AoPS Cloudflare 403 | Playwright scraper OR offline JSON dump from Akshat |
| Khan Academy | API 410 Gone | Pre-downloaded dump at `ml/data/khan/exercises.json` |
| Generation scale | 30% bad key rate | Fix prompt first (see `PIPELINE_MCQ_SPEC.md` when ready) |
| Anthropic credits | Exhausted | Homework solver (`mindcraft-homework`) still down |

---

## Next up (in priority order)

0. **NotebookLM session notes + interactive figures** — spec: `agent_work/cross-cutting/SESSION_NOTEBOOK_ARTIFACTS_PLAN.md`. Two tracks: (A) Desmos figures for graphable questions via inferred `FigureSpec` (Product, ships alone); (B) concept-grouped "notebook" in Notes → select sources → `/synthesize-artifact` (Groq) → flashcards/figure v1 (Product + Engine). v1 cut: flashcards + figure. Start with Track A.
1. **Wire OpenStax MCQ bank** — `ml/data/openstaxMCQ.json` ready (**221** story-wrapped MCQs, 5 concepts). Product lane: import in `questionBank.ts` like `openstaxQuestions.json`.
2. **Story Cell Studio scale** — run `--concepts all --refresh` batch to `ml/data/story_cells/batch_all.json` (3-concept LLM pilot ✅ in `batch_llm_002.json`).
2. **FABLE5 Area 2** — Dashboard personalization: mastery bars, top-6 weaknesses, skeleton shimmer (see `FABLE5_VISION.md §Area 2`)
3. **FABLE5 Area 3** — PawHub upgrades: concept labels in pads, pulse animation, SVG progress ring
4. **FABLE5 Area 4** — Tutor focus areas
5. **Jarvis dashboard margin notes** — chapter + diagnostic done; dashboard margin notes still open

---

## Shared seam files — check before touching

- `app/src/lib/questionBank.ts` — question shape contract. Last touched: wired OpenStax + Khan slots
- `app/src/lib/mlApi.ts` — ML API client. Last touched: pointed at HF Spaces
- `app/src/data/conceptStories.json` — 41 story worlds. DO NOT overwrite — append only
- `app/src/data/questionContextFrames.json` — 47 context frames. Last touched: all rewritten this session

---

## Agent token tips

- Start with this file. Then read only the deep doc for your specific task.
- If you're doing UI: read `FABLE5_VISION.md §Area N` for your area only
- If you're doing pipeline: read `PIPELINE_MCQ_SPEC.md` + `ml/scripts/pipeline/base.py`
- If you're doing stories: read `WORLD_VISION.md §9` (story quality standard) + `conceptStories.json` for the concept you're touching
- Never read `CLAUDE.md` in full — use Ctrl+F for the section you need
