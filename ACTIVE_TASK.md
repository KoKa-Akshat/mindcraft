# Active Task — MindCraft
> Updated at the end of every session by every agent. The FIRST thing any agent reads.
> Keep entries short. Delete completed items after 2 sessions.

---

## Font consolidation: four typographic roles, app-wide (Claude, 2026-07-23)

Decision was already made in a prior session (see task brief); this session
implemented it. Did not touch `app/src/manjushree/`, `agent_work/manjushree-zone/`,
`ml/**`, `webhook/**`, `data/**`, `worlds/**`. `App.tsx` had pre-existing
uncommitted Manjushree routing (not touched by this pass);
`grep manjushree app/src/App.tsx` still shows all 4 references. Nothing
committed — left in working tree for review, per instructions.

**The decision, unchanged:** exactly four typographic roles, everywhere —
Caveat (`--tok-font-hand`, voice/personality/branding), DM Sans
(`--tok-font-sans`, body/UI chrome everywhere), Source Serif 4
(`--tok-font-serif`, story/chapter headings — dropped the `DM Serif Display`
fallback), IBM Plex Mono (`--tok-font-mono`, data/labels/eyebrows). Cut
entirely: Sora, Fredoka, Space Grotesk, plain Nunito, Nunito Sans, DM Mono —
plus two more debt fonts found mid-sweep that weren't in the original
inventory: `Fraunces` (never even imported, `pages/Book.module.css` — was
silently falling back the whole time) and `DM Serif Display` as a standalone
family (same file). All folded into the four roles.

**What got swept:** every `font-family` (and `font:` shorthand) declaration
across `app/src/**/*.css`/`*.module.css` plus inline `fontFamily` in `.tsx` —
~40 files, see `git status` / `git diff --stat app/src` for the exact list.
Where a hardcoded literal was the ONLY debt (e.g. `'Caveat', cursive` used
directly instead of `var(--tok-font-hand)`), routed straight through. Where a
component used a cut font as its ACTUAL rendered choice (Fredoka/Space
Grotesk first in the stack, not just an unused fallback), picked the role by
what the text actually is, matching how the same page already used the other
three tokens: Login/Tutor/Admin headings and buttons -> sans (Login's own
`.wordmark` already inherited sans pre-sweep, so kept that precedent rather
than introducing Caveat there); "MindCraft" wordmark instances (Admin
`.sideLogo`, `TutorDashboard.module.css` `.logo`) -> hand, matching
`MindCraftLogo.module.css` and the cover page's wordmark; student/tutor
names -> hand, matching the existing `StudentSummaryCard.module.css` `.name`
precedent; `ConceptChapterPage.module.css` `.coverTitle` (was Space Grotesk,
turned out unused in the current component tree, fixed anyway) -> serif,
chapter-heading role. `--f-display` (the alias used 51x for what used to be
Sora, mostly in `Practice.module.css` — far more than the "essentially
unused" the deciding session assumed) -> redirected to sans (matches how the
SAME file already reserves hand for its journal/story-paper-scoped areas
only, e.g. `.matteShell`, `.paperScan`, and uses the display alias for
general session-UI chrome outside those scopes).
Left alone, explicitly out of scope: `lib/themeUtils.ts`
`ALLOWED_CUSTOM_FONTS` + `JournalStyleDrawer.tsx` (a deliberate per-student
Field Journal font-picker feature with its own `ensureGoogleFont` loader —
not app-wide typography debt); decorative math-glyph `fontFamily` attributes
in `ConceptPathIcon.tsx`/`ConceptVignette.tsx` SVG icon art (generic
`system-ui`/`Georgia`/`monospace` fallbacks, not named webfonts, a separate
illustration-glyph concern); `App.tsx`'s `ZoneLoading` component (Manjushree's
own loading screen, tied to that out-of-scope feature even though physically
in `App.tsx`).

**Imports cleaned up + consolidated:** `global.css`'s own `@import` (used to
duplicate-request `DM Sans` on top of `index.html`'s link, plus Sora/Nunito/DM
Mono) removed entirely — after the sweep it needed nothing `index.html`
wasn't already fetching. `index.html`'s link trimmed to the four families
with real weights checked against actual usage (grepped every `font-weight`
paired with each role, resolving alias chains like `--f-display`/`--td-font`/
`--pd-font-head`): Caveat 400/600/700 (its real max — no 800/900 exist),
DM Sans roman 400-900 + italic 400, Source Serif 4 roman 400-700 + italic
400, IBM Plex Mono roman 400-700 + italic 400 (was requesting 400/500 only
before — now covers weights already used in the CSS that just weren't
loaded). **Before: 2 separate Google Fonts requests, 42 font-face variants,
10,038 bytes of CSS descriptor. After: 1 request, 20 font-face variants,
4,690 bytes** (measured via direct `curl` against the old vs. new
`fonts.googleapis.com/css2` URLs; doesn't include the actual woff2 binaries,
but fewer families/weights strongly correlates with fewer of those too).
Removed the now-dead `--tok-font-display`/`--tok-font-dm-mono` tokens from
`styles/tokens.css` (re-confirmed zero references after the sweep, not just
before).

**Verification:** `npx tsc --noEmit` clean. `npx vitest run` — 109 passed, 1
skipped (7 files), same as baseline, including the untouched Manjushree
quadratics suite. `npm run build` — clean, only the pre-existing unrelated
chunk-size warning. Real Playwright screenshots (headless Chromium against
`npm run dev`): `/login` and `/book` (both public routes) render the new calm
DM Sans/Source Serif system correctly, zero console errors. **Could not get
authenticated screenshots of Dashboard/Practice/Diagnostic/TutorDashboard/
Admin/ConceptChapterPage** — all sit behind real Firebase Google OAuth, this
sandbox has no test credentials, no Firebase emulator config, and no
`@testing-library`/jsdom setup to mount components directly (didn't want to
`npm install` a new dev dependency for a throwaway check). Built a
supplementary static swatch instead (real Google Fonts URL, real weights,
representative text pulled from each gated page's actual classes/copy) to
confirm the four fonts + every weight/italic combo actually used load and
render distinctly — clean, no fallback boxes. Recommend a follow-up session
with test credentials (or a Playwright auth-state fixture) do a real visual
pass on the gated pages specifically.

---

## Click feedback (sound+confetti) / iPad write-mode fix / Map simplification (Claude, 2026-07-23)

Three asks from Akshat, all shipped, none committed (left in working tree for
review, per instructions). Did not touch `app/src/manjushree/`,
`agent_work/manjushree-zone/`, `ml/**`, `webhook/**`, `data/**`, `worlds/**`.
`App.tsx` was already modified on disk (Manjushree wiring, pre-existing,
uncommitted) — left it untouched; `grep manjushree app/src/App.tsx` still
shows all 3 references.

**1. Sound + confetti feedback system.**
`app/src/lib/uiSound.ts` — Web Audio API tone synth, no audio files, no paid
service. Two tones: `playTap()` (soft single triangle-wave tick) and
`playChime()` (brighter ascending two-note C5→F5). Mute persists in
localStorage (`mc_sound_muted`) + a same-tab change event so multiple toggle
instances stay in sync. AudioContext is constructed lazily, only inside a
play call, which is only ever invoked from a click handler — proved via
Playwright: 0 AudioContext constructions after full page load with zero
clicks, exactly 1 (state `running`) after the first real click.
`app/src/components/SoundToggle.tsx` — small speaker icon button, wired into
`Sidebar.tsx`, `ConceptChapterPage.tsx` header, and `Diagnostic.tsx` (fixed
top-right, since first-time students hit these sounds before ever reaching
the Sidebar).
Confetti: extracted the confetti-only mechanism out of
`components/doodle/DoodleReward.tsx` into `components/doodle/ConfettiBurst.tsx`
+ `.module.css` (DoodleReward now composes it instead of owning a duplicate
copy) so there's one confetti implementation, not two.
Wired to 5 specific moments (not every click — Akshat was explicit about
this): correct answer (`Practice.tsx`, `ConceptChapterPage.tsx` — chime +
confetti via existing `DoodleReward`/`pickDoodleStamp` call sites), wrong
answer (soft tap only, no confetti), completing a diagnostic step
(`Diagnostic.tsx` — chime + a small `ConfettiBurst` hoisted to `.page` level
so it survives the step swap instead of unmounting mid-animation), the
exam-horizon pill tap (tap), and tapping through Jesse's Kitchen intro (tap).
**Diagnostic hide-correctness mode (C4) plays the SAME neutral tap regardless
of correct/incorrect** — a differentiated sound would leak correctness
exactly like a colored flash would, so `Practice.tsx`'s hideCorrectness branch
intentionally does not call `playChime()`.
Verified via a throwaway Playwright harness (mounted the real `Diagnostic`
under a fake `UserContext`, deleted after use, nothing committed): mute
toggle persists to localStorage and actually suppresses `createOscillator`
calls (0 while muted, 2 after unmuting); confetti renders 18 real DOM bit
elements mid-animation, screenshot captured mid-burst.

**2. iPad write-mode bug (`ConceptChapterPage.tsx` write-mode / `ScratchPad.tsx`).**
Root cause was NOT a missing `touch-action: none` (that was already present
on the canvas and its wrappers) — it was that `.annotationLayer` (the overlay
wrapper) never set `touch-action` itself, only its `<canvas>` descendant did,
and separately `ScratchPad.tsx`'s pointer handlers never called
`preventDefault()` on `pointermove` (only `pointerdown`), and had no
non-passive native listener as a backstop. React attaches ONE root-level
listener for `touchstart`/`touchmove` as `passive:true` unconditionally for
every app (see `react-dom/cjs/react-dom.development.js` — hardcoded for those
two event names + `wheel`), regardless of which component uses `onTouch*` —
so any reliance on a synthetic React touch handler's `preventDefault()`
silently no-ops. Fix: (a) `touch-action: none` + `overscroll-behavior: none`
added directly to `.annotationLayer`/`.annotationActive`; (b) new
`.chapterDeskLocked` class applied to the whole `.chapterDesk` root while
`writeMode` is on (matches the write-toggle's own aria-label, "Lock page for
tapping answers" — the page was never actually locked before); (c)
`ScratchPad.tsx` now registers a real non-passive `addEventListener(...,
{passive:false})` for `touchstart`/`touchmove` directly on the canvas DOM
node (bypassing React's synthetic system entirely) calling `preventDefault()`,
plus `preventDefault()` added to the `pointermove` handler for parity with
`pointerdown`; (d) `html, body { overscroll-behavior: none }` added in
`global.css` as a global safety net against the whole-viewport rubber-band
bounce.
**Proof, not just code review:** built a throwaway Playwright harness
(deleted after use) mounting the real `ScratchPad` inside the real
`.annotationLayer`/`.annotationActive` wrapper markup. Chromium + CDP
`Input.dispatchTouchEvent` (drives touch through the actual compositor input
pipeline, not a JS-fabricated event — the standard technique for this exact
class of bug) with iPad Pro viewport + `hasTouch`: dragging across the canvas
draws real ink (1,006,080 non-white pixels) and the scrollable ancestor's
`scrollTop` stays at 0 before and after. Additionally proved the specific
"passive listener silently no-ops preventDefault" failure mode directly:
dispatched a real cancelable `touchmove` at the canvas and read back
`event.defaultPrevented` — `false` on the pre-fix code (verified via
`git stash` of just `ScratchPad.tsx`), `true` after the fix. WebKit was
installed (`npx playwright install webkit`) but its Playwright driver has no
public API for a multi-step touch drag (`page.touchscreen` is tap-only, no
CDP in WebKit) — Chromium + CDP was the most faithful drag-gesture test
available in this environment; noting the limitation rather than skipping
verification.

**3. Map simplification (`ConstellationGpsExplorer.tsx`, `DashboardPanels.module.css`).**
- Connections: new `isMajorEdge()` — `prerequisite`-relation edges need
  `weight > 0.25`, any other relation needs `weight > 0.45` (edge weights are
  Beta-Binomial posteriors seeded from prior pseudo-counts per CLAUDE.md, so a
  lot of edges clear a low bar on prior alone before any real evidence —
  that's most of what made 732 edges show up for one real student). Replaces
  the old flat `edge.weight > 0.1`. Tune the two constants
  (`MAJOR_PREREQ_WEIGHT`/`MAJOR_ANY_WEIGHT`) if the real graph still reads too
  dense/sparse — the shape of the filter (prereq backbone + exceptionally
  strong edges of any type) is the considered part.
- Icon-over-node: each node now renders its real `conceptIconUrl()` badge
  (already used on the dashboard TOC) clipped into a circle, with the old
  plain-dot fill replaced by a colored status ring (got-it/working-on-it/
  needs-love/unexplored) around the icon and the mastery-progress dashed ring
  moved just outside that. Found and fixed a real click-target regression
  while verifying: the icon has `pointer-events:none` and the status ring is
  stroke-only (`fill:none`), so without an explicit invisible hit-area circle
  the icon's own face would have been dead space — added one.
- Click → side panel: this already existed structurally (a flex sibling of
  the map inside `.mapArea`, never a modal) — the gap was visual, not
  structural. `.panel` now uses `var(--desk-radius-md)`/
  `var(--desk-shadow-raised)` (with literal fallbacks for the standalone
  `/constellation-gps-lab` route, which doesn't nest under `.canvasDesk`) so
  it reads as a raised desk card beside the map instead of a flush flat
  strip; `.btnPrimary`'s hardcoded sticker border/shadow values swapped for
  the equivalent `--desk-border-sticker`/`--desk-shadow-sticker(-hover)`
  tokens (same values, now actually token-linked instead of coincidentally
  matching).
Verified via a throwaway Playwright harness (mounted the real
`ConstellationGpsExplorer embedded` inside a `.canvasDesk` wrapper so
`--desk-*` custom properties are genuinely in scope, network mocked via
`page.route()` for `**/knowledge-graph/**` — no app source altered for this;
deleted after use) with 10 real concept ids and 8 mock edges spanning both
sides of the new thresholds: 3 of 8 edges rendered (matches the filter math),
all 10 nodes show real icons, clicking a node opens the side panel with
name/status/mastery-bar/tagline/actions. Screenshots taken of both states.

**Verification run:** `npx tsc --noEmit` clean. `npx vitest run` — 109 passed,
1 skipped, 7 files (same baseline; none of the changed files have existing
unit tests). `npm run build` exit 0 (pre-existing >500kB chunk warning,
unrelated to this pass — same warning exists on `main`). All temporary
Playwright harnesses, mock `.env.local`, and scratch test scripts were
deleted before finishing; nothing test-only was committed or left behind.

---

## Onboarding/cover/Map review pass (Claude, 2026-07-23)

Akshat reviewed live screenshots of onboarding, cover, notebook intro, and
Map, and gave 7 specific complaints. All 7 addressed. Files: `Diagnostic.tsx`
/ `.module.css`, `DiagnosticArt.tsx` (read only, unchanged), `CoverLanding.tsx`
/ `.module.css`, `NotebookIntro.tsx` / `.module.css`, `ActEmojiMap.tsx`,
`actToc.ts`. Did not touch `App.tsx`, `ml/**`, `webhook/**`,
`app/src/manjushree/**`, or `agent_work/manjushree-zone/**`.

**1. Jesse's Kitchen intro sizing + interaction.** `Diagnostic.module.css`
was still on the OLD global dark-navy theme (`--bg`/`--surface`/`--accent`
from `global.css`, #102F35 + lime), a full palette generation behind the
desk/cover/notebook-intro system, that's most of why it read as a small,
disconnected floating card. Rebuilt the whole file on the same hardcoded
desk values `CoverLanding.module.css`/`NotebookIntro.module.css` use (no
`--desk-*` custom properties reach this route, it's a separate page, so
values are repeated the same way those two files already do): full-bleed
`padding: 4px 8px 8px` shell, `#fffdf8` paper, `#2a2430`/`#3a2f55` ink,
22px radius. **Interaction interpretation (stated, not confirmed by
Akshat): the intro's `DeskArt` illustration IS the interaction.** Wrapped it
in one real `<button>` (whole illustration is the tap target, matching
`CoverLanding`'s existing button-wraps-whole-scene pattern), click plays a
650ms scale+fade zoom (`transform-origin` set over the open-notebook group
in the SVG so it reads as diving into the notebook, `prefers-reduced-motion`
skips straight through), then auto-advances to the goals step. No separate
"Start" button anymore. Did not find any other partially-built click-to-zoom
mechanic anywhere in the codebase to defer to instead.

**2. Horizon step colors/icons.** `HorizonIcon` (`DiagnosticArt.tsx`) already
had good parchment/navy/gold SVGs from an earlier same-day pass; the bug was
purely that the surrounding `.card`/`.horizonBtn` were still dark-navy
dark-theme colors clashing with them. Recolored to the same parchment/navy
(#1d3a8a)/gold(#c99a3a) system the icons themselves use, no new icons drawn.

**3. Confidence step: 3 boxes, no Skip.** `actDiagnostic.json`'s 20
confidence-step concepts split CLEANLY into exactly 3 non-empty
`ACT_TOC_SECTIONS` lanes already (Algebra 11, Geometry 7, Data & chance 2),
no merging needed. New `actTocSectionForConcept()` helper in `actToc.ts`
(reuses the SAME live section membership the Map/Contents already use, not a
second hand-rolled category list) groups concepts into up to 3 side-by-side
boxes, `align-items:stretch` so all 3 share one height, dense compact rows so
even the 11-concept Algebra box fits with no inner scroll on a 900px-tall
viewport (confirmed via screenshot). Skip button, `excludedIds` state, and
`toggleSkip` all removed; Finish now requires every concept rated (was
"rated OR skipped" before, functionally the same bar).

**Bonus fix found while grouping (`actToc.ts`):** the geometry regex was
`|line` which substring-matches "line" INSIDE `linear_equations` /
`linear_inequalities` / `systems_of_linear_equations`, so those 3 concepts
were ALSO placed in the algebra section, i.e. rendered as duplicate Map/TOC
nodes with the same React key (the pre-existing "duplicate key" console
warning flagged in this file's own 2026-07-23 entry above). Changed to
`lines_` (still matches the intended `lines_angles`, no longer matches
`linear_*`). Verified: TOC pool is exactly 27 unique concepts after the fix
(was 30 counting the 3 duplicates).

**4. Loading transition replaces "You're mapped."** `Step` union's `'done'`
renamed to `'loading'`. Clicking Finish now transitions straight into a
wizard loading screen (`WizardMascot`, non-compact, cheering) reading
"Loading…" / "Personalizing your world ★", then auto-navigates to
`/dashboard` once `applyDiagnosticConfidence` resolves (with a 900ms minimum
dwell so it never flashes). No manual "Go to my dashboard" tap anymore.

**5. Cover redesign.** Root cause of the "blending artifact bleeding on the
right edge": `mindcraft-cover-hero.jpg` is a PORTRAIT photo (933×1400,
aspect ~0.67) being forced through `object-fit: cover` into the cover's full
landscape desk box (aspect ~1.75+, per the prior full-bleed sizing pass) ,
the crop pushed the photo's bright window toward the right edge, where it
washed out against the dark vertical `.scrim` gradient sitting on top of it.
Fix per the brief: removed the photo entirely (not just re-positioned it).
New `.cover` is a calm parchment-to-lavender gradient (`#fffdf8` → soft
lavender, same paper family as the rest of the desk), 3 low-opacity
hand-drawn ink-line doodles standing in for the old photo's charm, the
saturated hot-pink ribbon is gone. Added a name input (`#cover-name`,
`localStorage`-persisted via new `loadCoverName()`/`saveCoverName()`) that
live-updates the open button's text ("Tap to open →" → "Let's go, Maya →"),
verified interactively via screenshot. Sizing formula (the full-bleed
`padding: 4px 8px 8px` match to `.canvasStage`) is unchanged from the prior
pass. Restructured from "whole cover is one button" to "button + separate
input" since a nested `<input>` inside a `<button>` is invalid and made
Enter-to-open swallow the name field; also removed a static `aria-label`
that would have frozen the accessible name at "Open your notebook" while the
visible text personalizes underneath it.

**6. NotebookIntro resize + single tap.** Same full-bleed formula as the
cover (was `padding:12px` + `display:grid;place-items:center` +
`width:min(1120px,96vw)` cap, a different, smaller box). Whole card is now
one `<button>` (matches `CoverLanding`'s existing pattern); "Show me
contents" is a visual cue span inside it, not a second required tap.

**7. Map tab real edges, the most involved item, investigated fresh.**
**Root cause, confirmed by code AND numbers:** `ActEmojiMap.tsx`'s
`edgesFor()` (now renamed `syntheticFallbackEdges` with a header comment)
never read `kg.edges` at all, it only chained nodes within the same
`ACT_TOC_SECTIONS` lane in list order plus one hub-to-hub link per lane, a
made-up scheme with zero relationship to the real ontology graph. Computed
the gap precisely (`ml/mindcraft_graph/engine/student_graph.py`
`create_personal_graph`, read-only): the real ontology graph has 68
prerequisite/bridge edges across 42 concepts, seeded from ontology prior
strength so they exist even for a brand-new student with zero practice
(min weight 0.35, all pass the 0.2 threshold KnowledgeGraph.tsx already
uses); of those, 39 have both endpoints inside the 27-concept ACT TOC pool
the Map renders, versus ~26-29 from the old synthetic chain scheme. Fixed
`ActEmojiMap.tsx`: fetches `kg.edges` alongside the existing `kg.nodes` read,
new `realEdgesFor()` filters to weight>0.2 within the placed node set, new
`relationDash()` gives prerequisite/related/application/discovered their own
dash pattern (same grammar `KnowledgeGraph.tsx`'s `edgeStyle()` already
uses); synthetic edges now only render as a loading/error fallback.

**However: `ActEmojiMap.tsx` turned out to be orphaned.** `grep -rln
ActEmojiMap app/src` returns only the file itself. `git diff 67b7c0ed
426a0254 -- app/src/pages/Dashboard.tsx` shows the concurrent commit
("Polish Contents lanes and restore constellation Map on dashboard")
swapped Dashboard's Map view from `ActEmojiMap` to `ConstellationGpsExplorer`
, so at commit `67b7c0ed`, `ActEmojiMap` WAS live and WAS exactly the
synthetic-edge bug described above (almost certainly what Akshat originally
saw); as of `426a0254` it no longer renders anywhere. Verified
`ConstellationGpsExplorer.tsx` is not the same bug: it already reads real
`kgData.edges` (`.filter(e => e.weight > 0.1)`, line ~515) and renders them
as real `<line>` elements from real PCA node positions. **Live-tested against
production**, not just read: pointed a local dev server's `VITE_ML_API_URL`
at the real HF Space, signed up a real throwaway test student
(Firebase Auth + Firestore, `mindcraft-93858`), ran them through the full
onboarding, and screenshotted the real Map tab, 732 real `<line>` edges
rendered (the co-occurrence "discovered" edge type clearly firing on top of
the 68 ontology-prior edges once real assessment events exist), "26 of 42
stable" coverage readout, a real GPS route panel. So the DATA half of item 7
is already fixed, by the other concurrent agent, most likely in direct
response to the same complaint.
**What's still missing versus the full brief**: `ConstellationGpsExplorer`
does NOT yet use `conceptIconUrl()` (nodes are still plain colored circles,
1-10px radius, too small for a 64×64 icon to read at that scale without a
larger redesign of the layout) and still carries the "older" chrome the
brief wanted replaced (zoom +/- buttons, filter chips, axis labels), unlike
`ActEmojiMap`'s bigger icon-tile layout which already has both. **Deliberately
did not swap this back or force an icon retrofit onto the dense PCA
scatter**, `426a0254` was Akshat's own explicit, same-day "restore" decision
and I'm not overriding it unilaterally per this task's own instructions on
detecting concurrent-work conflicts. Both components are left correct and
working; which one should be the live Map (icon-grid `ActEmojiMap`, now
real-data-correct too, vs. the currently-live real-data-correct-but-visually-
older `ConstellationGpsExplorer`) is a product decision flagged back to
Akshat, not one I made silently.

**Verification (all real, this pass):** `npx tsc --noEmit` clean. `npx
vitest run` → **109 passed, 1 skipped (110 total)**, identical to the
pre-pass baseline (re-measured on this exact commit before touching
anything, since several sessions' worth of prior "5,4xx kB" build notes
above are now stale). `npm run build` green both before and after: main JS
chunk **5,647.27 kB → 5,649.97 kB** (+2.7KB), CSS **429.77 kB → 433.77 kB**
(+4KB), measured by literally stashing this pass's diff, building on bare
`HEAD`, then popping the stash back and rebuilding, not assumed. `grep
manjushree app/src/App.tsx` still shows the lazy import + both routes,
checked before, during, and after. Real screenshots (temporary `?qaEmail=1`
shim in `Login.tsx` exposing the existing email/password path to sign up a
throwaway test student against real prod Firebase, plus a temporary
`app/.env.local` pointing `VITE_ML_API_URL` first at a local ML server, then
at the real HF Space for the Map test, both **fully reverted**, confirmed
via `git diff app/src/pages/Login.tsx` empty and `app/.env.local` absent) at
`agent_work/onboarding-fixes/screenshots/`: `03_diagnostic_intro` /
`03b_..._zooming` (click-to-zoom), `05_diagnostic_horizon` /
`05b_..._selected` (recolored icons), `07_diagnostic_confidence` /
`07b_..._filled` (3 boxes, no Skip, all visible with no scroll), `08_
diagnostic_loading` (wizard transition), `01_cover` / `01b_cover_with_name`
(redesigned cover, name personalization live), `02_notebook_intro` /
`02b_dashboard_after_intro_tap` (resized, single-tap), `10_dashboard_map`
(732 real edges, real production data). Capture scripts kept at
`agent_work/onboarding-fixes/*.mjs` for reruns.

---

## CURRENT SPRINT, 2026-07-21

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
  `import.meta.glob`, **no code edit needed to register new concept art**,
  future runs are truly rerunnable. Spent the account's only 1 remaining
  Higgsfield credit on `fractions_decimals` (Simon Stevin / Antwerp 1585
  ledger scene), exactly the "pizza ≠ Stevin ledger" example Akshat flagged.
  **1 of 27 ACT-tested concepts now has real concept-accurate art; the other
  26 are still on the old shared/theme-fallback photos, blocked purely on
  Higgsfield credits** (run `node app/scripts/generateConceptArt.mjs --list`
  to see priority order by `actFrequency`, then
  `node app/scripts/generateConceptArt.mjs --top N` once credits are topped
  up, each concept costs 1 credit at `seedream_v5_lite` quality `high`).
  Manifest of every generation (prompt, cost, source URL, protagonist) is at
  `app/scripts/conceptArtManifest.json`, append-only, never double-spends on
  an already-generated concept.
- **Done: Practice concept-lock decision (item 2 in the brief), resolved as
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
  `selectStoryForConcept()` code path Practice.tsx uses) ,
  see screenshot below.
- **Verification (all real, this session, after reverting every temp
  screenshot aid):** `npx tsc --noEmit` clean. `npx vitest run` → **85
  passed, 1 skipped (86 total)**, identical to the pre-change baseline, zero
  regressions. `npm run build` green (`story-fractions_decimals-*.jpg` now in
  the bundle at 149.30 kB, same ballpark as the existing story plates; the
  pre-existing 5.3 MB main-chunk size warning is unchanged, not introduced by
  this pass). Screenshots (cover → intro → desk Home/Map/Work/Notes →
  fractions_decimals chapter with the new art → chapter's embedded practice
  question panel with the same art) at
  `agent_work/canvas-notebook/screenshots/`, captured via a temporary,
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
     data-driven question loaded, it requires router `state` from an actual
     PawHub/dashboard launch (weakness/learn recommendation data), which
     needs a real authenticated session; the auth shim only faked the React
     user context, not a real Firebase ID token, so Firestore reads
     (recommendations, diagnostic status) all 403'd. Verified the same code
     path is wired in by reading `Practice.tsx` (`storyArtFor`,
     `selectStoryForConcept`, `matchSkinForQuestion`) instead, a real login
     is the only way to close this out visually.
  3. `mc-diagnostic.js` overlay retarget (pre-existing open item, untouched
     this pass, see "Known gotchas" in `CLAUDE.md`).

**2026-07-21 second follow-up pass (Fable 5, marketing trim, dashboard
polish, 26 hand-authored SVG plates, alt-text bug fix):** four pieces of
direction from Akshat, all done.

- **1. Marketing copy trim.** Read `BRAND_BOOK.md` sections 8 + 11 first, then
  read all 5 files named in the brief. `review-questions.html` (20,625 lines)
  and `architecture.html` (1,474 lines) turned out to be internal dev tools
  (a QA question-bank dump and an engineering system-architecture diagram),
  not marketing prose, left untouched, no user-facing copy to trim there.
  `index.html` was already fairly tight from a prior redesign pass (short
  fragment-style copy); trimmed 3 remaining 2-sentence paragraphs (system
  section, pricing section, tryapp section) down to one clean sentence each,
  no claims/numbers touched. `article.html` had the real wordiness: two blog
  posts with repetitive, passive-voice prose (e.g. the mission post's opening
  line was said almost verbatim in both the excerpt AND the first body
  paragraph). Rewrote both posts' body copy, verbs first, cut repeated
  ideas, cut passive constructions ("all of the information discussed will
  be documented and organized" → "everything discussed gets documented").
  `blog.html`'s duplicate excerpt synced to match. **Also removed every em
  dash found in all 3 files** (both in copy and in code comments, for full
  compliance), `article.html` had 6, `index.html` had 2 (pre-existing, in
  CSS/JS comments). Diff: touched lines went from 508 words to 342 words
  (33% shorter) in `article.html`; `git diff --stat` shows
  `article.html 26 changed, index.html 10 changed, blog.html 2 changed`. No
  facts/stats/claims altered anywhere, confirmed via `git diff`, every
  change is either a cut or a rephrase of existing content.
- **2. Dashboard polish pass.** Structural layout untouched (cover → intro →
  desk → chapters stays exactly as the prior pass shipped it), pure visual
  craft. Root cause found for a real bug, not just aesthetics: the Notes
  panel (`DashboardNotesPanel` via `DashboardPanels.module.css`) depends on
  CSS custom properties (`--rule`, `--ink-katha`, `--paper-raised`, `--font-
  katha`, etc.) that only exist inside the OLD `BookShell` (`.shell` in
  `components/book/Book.module.css`), which no longer wraps the Notes view
  in the new canvas-desk layout, so those `var()` calls were silently
  resolving to nothing. Screenshots confirmed the effect: the search input
  had no visible border and "No notes yet." was nearly invisible. Fixed by
  defining the same variable names on `.canvasStage` (Dashboard.module.css),
  tuned to the canvas desk's own palette rather than the book's. Beyond that
  fix: introduced a shared design-token scale (`--desk-radius-sm/md/lg`,
  `--desk-shadow-soft/raised/stage/sticker(-hover)`, `--desk-border-sticker`,
  `--desk-ease(-bounce)`) on both `.canvasDesk` (Dashboard.module.css) and
  `.chapterDesk` (ConceptChapterPage.module.css), same names, same values ,
  so the dashboard desk and the chapter canvas draw from one vocabulary
  instead of two independently-tuned ones (this was the concrete form of the
  "several UIs stapled together" complaint: chip/button corner radii and
  shadow depths differed between files with no shared reference). Applied to
  `ActEmojiMap.module.css` and `WorkStudio.module.css` too (defensive
  fallback values included so nothing breaks if a component ever renders
  outside `.canvasDesk`). Added hover/active micro-interactions
  (translateY + shadow growth on chips/pills/buttons, consistent
  ~160ms cubic-bezier bounce) that were entirely missing before, buttons had
  no hover feedback at all. Real before/after screenshots (not just
  asserted) at `agent_work/canvas-notebook/screenshots/before_*.png` vs
  `after_*.png` (Home, Map, Work, Notes, Notes is the clearest diff, text
  went from unreadable to legible).
- **3. 26 hand-authored SVG concept illustrations** (`app/scripts/
  generateConceptArtSvg.mjs`, sibling to the Higgsfield pipeline, NOT an
  image-generation model, genuinely hand-composed SVG markup). Covers all
  26 of the 27 ACT-tested concepts still on fallback art (`fractions_decimals`
  already had the real Simon Stevin photo from the prior pass; left that file
  alone). Zero skipped. **Style decision** (documented in the script's own
  header comment too): sampled the actual rendered colors out of
  `story-fractions_decimals.jpg` (warm cream walls, Stevin's navy coat,
  golden wheat-bowl light) and built the palette from that instead of
  guessing, warm parchment background, warm ink-brown linework (not flat
  black), navy `#1d3a8a` as the one signature accent per figure (this is
  ALSO literally MindCraft's own brand "Depth" color, `BRAND_BOOK.md`
  section 9, a deliberate double-bridge, not a coincidence), warm gold for
  props. Reasoning for why this doesn't clash with the one photoreal plate:
  a real notebook where one page got a full watercolor treatment and the
  rest are pen-and-wash sketches reads as normal, not inconsistent, same
  palette family, different rendering weight. Every scene = one shared
  "cloaked scholar" figure archetype (recolored/reposed per protagonist,
  mirroring how `generateConceptArt.mjs` reuses one fixed `STYLE_FORMULA`
  string across every photoreal generation) + hand-drawn setting props for
  that concept's locked `questionContextFrames.json` protagonist/setting +
  ONE bespoke hand-drawn math metaphor per concept invented specifically for
  that concept (rope-stretched 3-4-5 triangle for right-triangle geometry,
  a balance scale for basic equations, the doubling-grains chessboard for
  exponent rules, Hippasus going overboard for radical expressions, the
  Alhambra tessellation for geometric transformations, etc., genuine
  per-concept craft, not a template swap). Wired into `storyArt.ts` via a
  second `import.meta.glob` for `story-*.svg` alongside the existing `.jpg`
  glob, feeding the same `GENERATED` lookup map, `storyArtFor()` stays the
  single function every caller uses, no other code changed. Bundle cost:
  all 26 SVGs total 272KB uncompressed (most under the 4KB Vite inline
  threshold and get base64-embedded directly in the JS, the rest emit as
  tiny separate files, 40KB total in `dist/assets/`), versus 149KB for the
  ONE existing photoreal JPG plate. Verified in real chapter context (not
  just the raw SVG file): screenshots of 5 chapters
  (`right_triangle_geometry`, `quadratic_equations`, `circles_geometry`,
  `basic_probability`, `linear_equations`) at
  `agent_work/canvas-notebook/screenshots/chapter_*.png`, all showing the
  new art in the actual polaroid-framed chapter layout next to the real
  story text. **Noticed but out of scope to fix:** `quadratic_equations`'s
  chapter header correctly says "Muhammad al-Khwarizmi" (matches the new
  art) but the body paragraph below it opens with an unrelated Galileo
  anecdote, a pre-existing `conceptStories.json` content mismatch between
  the locked protagonist and the story's own opening sentence, same root
  cause noted for `measurement_units` in this file already. Not something
  this pass touched (Product-lane art wiring, not Engine-lane story data);
  flagging for whoever owns `conceptStories.json` next.
- **4. Alt-text-as-literal-text bug, fixed with a real diagram renderer, not
  just reformatted text.** Root cause: `MathText.tsx`'s `replaceMarkdownImages()`
  already converted Eedi's `![alt]()` images into `(Diagram: alt text)`, and
  `HighlightedStem.tsx` already gave the stem's version a bordered callout
  box, but both just showed the raw alt-text sentence verbatim inside it,
  and answer CHOICES (rendered via plain `MathText`, no callout at all) had
  it worse: no box, no framing, just a run-on sentence mid-button. Also
  found: `components/QuestionFigure.tsx` (a real geometry/graph SVG
  renderer, including a `numberline` shape) exists in the codebase but is
  **not imported anywhere**, completely unwired dead code, a bigger finding
  than the reported bug itself. Rather than force-fit alt-text parsing into
  that stem-only, non-alt-text-aware system, built a purpose-built pipeline:
  `lib/altDiagram.ts` (`parseAltDiagram()`, recognizes two real Eedi alt-text
  families: "N dashes, dash K marked with value V, arrow pointing at dash J"
  number lines, and "circle at value V, arrow pointing left/right" inequality
  rays; `humanizeAltCaption()`, light cleanup fallback for anything else,
  never invents content) + `components/AltDiagramCallout.tsx` (draws a real
  SVG diagram for a recognized pattern, otherwise renders the cleaned text
  in a clearly-labeled "Picture: ..." callout instead of a bare sentence).
  Wired into BOTH `HighlightedStem.tsx` (stem) and `MathText.tsx` (choices,
  hints, anywhere else `(Diagram: ...)` can appear) so the fix covers
  wherever this pattern shows up, not just the one reported spot. Verified
  against the EXACT reported bug text (`eedi_696`, `fractions_decimals`,
  "Line with 5 dashes... First dash marked with a 1 fourth dash marked with
  a 2. Blue arrow pointing upwards towards the third dash.") via a temporary
  dev-only route rendered through the real running app (not a mock), now
  draws 5 tick marks, "1" under tick 1, "2" under tick 4, a navy arrow over
  tick 3, screenshot at `agent_work/canvas-notebook/screenshots/
  altdiagram_fix_verification.png`, temp route fully removed after.
  **Honest scope count** (`eediQuestions.json`, 1,508 records): 439 questions
  have a `(Diagram:`/`![...]()` pattern in the STEM (many already handled
  reasonably by the existing stem callout box; the ones matching the two
  patterns above now get a real diagram, the rest get the improved fallback
  caption); separately, **62 questions have it in at least one ANSWER
  CHOICE** (242 individual choice strings total), those were the worst case
  (zero framing at all before this fix) and are now fixed the same way.
  Not hand-fixed one-by-one, the rendering path is fixed for all of them at
  once, per the brief.

**Verification (all real, this session):** `npx tsc --noEmit` clean.
`npx vitest run` → **85 passed, 1 skipped (86 total)**, unchanged from
baseline. `npm run build` green, main JS chunk `5,399.84 kB` (was `5.3 MB`
per the prior entry, the ~100KB delta is the 21 base64-inlined SVGs, expected
and small). `grep manjushree app/src/App.tsx` still shows the lazy import +
both routes. Screenshot inventory (all real, captured via a temporary
env-gated `VITE_SCREENSHOT_MODE` auth shim in `App.tsx`/`Dashboard.tsx`,
identical technique to the prior pass, fully reverted, `grep SCREENSHOT
app/src/App.tsx app/src/pages/Dashboard.tsx` returns nothing) at
`agent_work/canvas-notebook/screenshots/`: `before_*`/`after_*` (dashboard
Home/Map/Work/Notes, both states), `chapter_*` (5 chapters with new SVG
art), `altdiagram_fix_verification.png`. Did not touch
`app/src/manjushree/**` or `agent_work/manjushree-zone/**`.

### Onboarding diagnostic consolidation + deadline_days + cover sizing (Fable 5, this pass)

Akshat played the live onboarding and had three complaints. Root causes were
already found by a prior same-day pass before this brief was written; this
pass implemented the fixes.

**1. Wrong, heavier diagnostic was live.** New/incomplete students were being
routed to `GradeOnboard.tsx` (`/onboard`, grade question + ~10 full graded
probes), not the lighter canonical `Diagnostic.tsx` ("Jesse's Kitchen":
goals + a few ACT anchor probes + a 3-point confidence tap per concept). The
gate lived in **two** places, not just `Dashboard.tsx` as the brief's initial
grep suggested, `lib/postLogin.ts#resolvePostLoginPath` is the one that
actually fires on every fresh login (three separate `return '/onboard?...'`
sites), with `Dashboard.tsx`'s own gate as a secondary check. Fixed all four
call sites (`postLogin.ts` x3, `Dashboard.tsx` x1) to route to `/diagnostic`.
`GradeOnboard.tsx` is **kept on disk, not deleted** (confirmed via `grep -rn
"GradeOnboard\|/onboard" app/src` that only `App.tsx` referenced it), the
`/onboard` route now redirects to `/diagnostic` (`<Navigate to="/diagnostic"
replace />`, same pattern as the existing `/learning-gps` redirect) so no
stale bookmark/link 404s. `Diagnostic.tsx` never asked a grade question, so
nothing to remove there for the surviving flow.

**2. Diagnostic needed one fast, engaging question that actually feeds the
backend.** Added a tap-pill "When is your exam?" step to `Diagnostic.tsx`
between goals and the confidence taps (`Today` / `3 days` / `1 week` / `2+
weeks`, same day-value buckets as `PanicInput.tsx`'s existing time-horizon
pills, so `deadline_days` means one thing everywhere it's collected). This is
the ONE new question added, per the brief's "fewer, not additive" instruction.
Wired end to end: `Diagnostic.tsx` → `applyDiagnosticConfidence(...,
{ deadlineDays })` (`lib/diagnosticSeed.ts`) → `markDiagnosticComplete` persists
`users/{uid}.diagnostic.deadlineDays` (`lib/practiceState.ts`, both read/write
sides typed) → `lib/recommendNextConcept.ts` and `lib/practicePathQueue.ts`
(the two `mode: 'exam'` call sites, PawHub's "Learn" pad path and the gap-scan
practice-path queue) now load it via `loadDiagnostic()` and pass it into
`getRecommendations(..., deadlineDays)` → `mlApi.ts` sends it as
`deadline_days` in the `/recommend` POST body. **Concretely verified**, not
just asserted: ran the real app in a browser, signed up a fresh test student,
completed the new horizon step picking "1 week", and captured the actual
network request fired on dashboard load ,
`{"student_id":"...","mode":"exam","exam":"ACT","deadline_days":7}`, confirms
the value that reaches the ml `/recommend` exam-mode pathfinder is exactly the
one tapped. Did not touch anything under `ml/**`, `exam_concept_budget`
already existed and consumes this field; only the UI source + plumbing were
added.

**3. Cover and desk were two different-shaped UIs stapled together.**
`CoverLanding.module.css` fixed the cover at `width: min(560px, 92vw); height:
min(86dvh, 820px)`, a narrow portrait card, while the very next screen
(`NotebookIntro`, `width: min(1120px, 96vw)`) and the desk after that
(full-bleed `canvasStage`) are both wide landscape surfaces. Fix chosen:
**widen the cover to match** (`width: min(1120px, 96vw); height: min(80dvh,
760px)`), same width class as `NotebookIntro`, rather than rewriting the
transition animation, the cover now opens into a surface the same shape as
itself, so the sequence reads as one surface widening, not a hard cut. Left
the fade/rotate close animation (`coverClose` keyframes) unchanged; the size
match alone removes the jump. `mindcraft-cover-hero.jpg`'s `object-fit: cover`
crop absorbed the new aspect ratio with no visible distortion (see
screenshots).

**Illustrations** (new `app/src/components/DiagnosticArt.tsx`): a cozy-desk
scene on the diagnostic's intro card + four small per-pill doodles for the
horizon step (ringing clock → torn calendar → week grid → growing sprout,
urgency fading as the horizon widens). Explicitly did **not** use Higgsfield ,
confirmed at 0 credits (checked twice, CLI + MCP connector). Reused the exact
hand-authored SVG "field notebook sketch" palette/style already established in
`app/scripts/generateConceptArtSvg.mjs` (warm parchment bg, ink-brown
linework, one navy + one gold accent) so this reads as the same notebook, not
a third visual style bolted on. No cartoon mascots/faces per `BRAND_BOOK.md`
, objects only (clock, calendar, hourglass-adjacent sprout).

**Verification (all real, this pass):** `npx tsc --noEmit` clean. `npx vitest
run` → **85 passed, 1 skipped (86 total)**, identical to baseline, zero
regressions. `npm run build` green (pre-existing 5.3MB main-chunk warning
unchanged, not introduced by this pass). `grep manjushree app/src/App.tsx`
still shows the lazy import + both routes (checked before AND after all
edits). Screenshots at `agent_work/canvas-notebook/screenshots/`:
`before_cover*`/`before_desk_full` (narrow portrait cover cutting hard into
the full-bleed desk, captured against the ORIGINAL code before any edit, via
a real signup through the then-live heavy `GradeOnboard` flow) vs.
`after_cover`/`after_intro_overlay`/`after_desk_full` (widened cover, same
silhouette as the next two screens) and `after_diag_01..08_*` (full
consolidated diagnostic flow: intro with desk art → goals → horizon step
unselected/selected → ACT anchor probes → confidence taps → done). Captured
via a temporary `emailMode` URL-param QA shim in `Login.tsx` (this app's
sign-in is Google-OAuth-only in the visible UI, which real credentials would
be needed to automate; the shim just exposed the app's own existing
email/password code path so a throwaway test student could be created and
driven through the flow), **fully reverted**, confirmed via `git diff
app/src/pages/Login.tsx` returning empty before this entry was written.


**Done:** lavender desk + spiral-ring gutter + margin star mascot (`Book.module.css` /
`BookShell`); sticker MCQ hover swell + soft-wrong wiggle (no red buzz) + stamp/confetti
reward (`DoodleReward`, Practice matte + Concept chapter); Map/GPS simplified, primary
CTA opens `/concept/:id` notebook lesson (same BookShell as dashboard); explore tiles
stickerized; learn CTA opens chapter not raw practice.
**Do not include Manjushree** in this commit, still awaiting playthrough sign-off below.

### Cover true full-bleed fix + concept icon system + merged hero bar + binding rings (Fable 5, 2026-07-23)

Akshat looked at the cover and Contents page again after the prior pass's
widening fix and was still unhappy, plus flagged the emoji ("why does
fractions and decimals have a pizza slice lmao") and asked for the header
bands to merge into one hero bar with a binding-ring motif, across every
dashboard view. Four items, all done.

**1. Cover STILL didn't match, because the fix so far only changed the
aspect ratio, not the actual sizing formula.** `CoverLanding.module.css` had
`width: min(1120px, 96vw); height: min(80dvh, 760px)`  -  a hard cap. That cap
made the SHAPE match `NotebookIntro`/`canvasStage`, but not the rendered
SIZE: canvasStage has no cap at all (`.canvasDesk` is full-viewport with
`padding: 4px 8px 8px`, and `.canvasStage` fills whatever that leaves), so on
any viewport wider than ~1166px the two diverged again. Measured with
Playwright at a 1440px viewport: cover was 1120px, canvasStage was 1424px, a
304px gap. Fix: removed the cap entirely. `.desk` (the cover's outer fixed
container) now uses `padding: 4px 8px 8px`  -  **the identical numbers**
`.canvasDesk` uses, not a similar-looking value  -  and `.cover` is `width:
100%; flex: 1 1 auto` inside it, so its box resolves to the exact same
"100vw minus the same 16px" formula canvasStage uses. `border-radius`
changed 28px → 22px to match `--desk-radius-lg` (the same token
canvasStage's own radius uses). Rotate angles in the settle/close/hover
keyframes were reduced (was up to 8deg) since a big rotation on a now
near-edge-to-edge box would show desk background through a corner past the
thin 8px gutter. **Verified as an exact match, not just "closer"**: captured
both elements' `offsetWidth` (the untransformed layout width, immune to the
cosmetic perspective/rotate transform which otherwise skews
`getBoundingClientRect()`) via a real Playwright session at 1440px viewport
 -  cover `offsetWidth: 1424`, canvasStage `offsetWidth: 1424`. Byte-for-byte
identical. Screenshot:
`agent_work/canvas-notebook/screenshots/2026-07-23_cover_1440.png` (cover
now genuinely edge-to-edge with the same lavender gutter the desk uses).

**2. Concept icon system  -  replaces `actTopicEmojis.ts`'s pun emoji in the
TOC and Map.** New sibling script to the existing hand-authored SVG art
pipeline: `app/scripts/generateConceptIconsSvg.mjs`. Same ink/parchment/
navy/gold palette as `generateConceptArtSvg.mjs`, but every icon is a
**re-simplified** small badge (64x64 viewBox), not a shrunk copy of the full
scene  -  a full 800x800 scene's gradients/vignettes/multi-layer props turn to
mud at 18-34px, so each concept's ONE bespoke math metaphor prop from its
full scene was redrawn from scratch with 2-3 legible strokes. Examples:
`fractions_decimals` (no SVG scene before, only the one Higgsfield photo)
gets a brand-new icon invented for this pass  -  Simon Stevin's ledger, a
tally-marked account card + one gold coin, the literal "pizza ≠ Stevin
ledger" example Akshat gave; `basic_equations` → the balance-scale metaphor,
simplified to stand/beam/two pans; `right_triangle_geometry` → the
rope-stretched 3-4-5 cord reduced to the taut cord + right-angle marker;
`radical_expressions` → the radical sign over a ripple (Hippasus overboard);
`geometric_transformations` → a 2x2 Alhambra tile repeat. **Count: 27 of 27
TOC/Map-rendered concepts got a real bespoke icon** (26 from the existing
SVG scenes + the new fractions_decimals ledger), plus 2 bonus icons for
`act_strategy`/`representation_translation` (Layer-1 cross-cutting tags
`actToc.ts` itself already excludes from the TOC/Map today  -  done anyway for
completeness, not currently visible), plus 1 generic compass-rose `fallback`
badge for any truly unlisted id (never hit by the current TOC  -  a disclosed
safety net, not a silent one). New `app/src/lib/conceptIcon.ts` auto-discovers
the generated `icon-*.svg` files via `import.meta.glob`, same pattern as the
existing `storyArt.ts`, exporting `conceptIconUrl(conceptId)`. Wired into
`ActEmojiMap.tsx` (Map nodes + focus dock) and `Dashboard.tsx` (TOC chips +
the spark CTA), replacing the `topicEmoji()` calls at both sites (kept
`actTopicEmojis.ts` on disk with a header comment marking it superseded for
visual rendering, not deleted). Screenshot:
`agent_work/canvas-notebook/screenshots/2026-07-23_toc_icons_crop.png` (TOC
list showing the new icons, "Fractions and Decimals" now reads a ledger
badge, not a pizza) and `2026-07-23_map_herobar_1440.png` (Map nodes on the
same icon system).

**3. Merged hero bar (nav + wizard + spark), one visual band instead of
three or four.** Home used to stack: a bare nav row (`.canvasChrome`) → a
"Contents" header with `WizardMascot` off to the side → a yellow
"today's spark" banner → the TOC  -  four bands, and Map/Work/Notes only got
the bare nav row, no wizard, no spark. Restructured `Dashboard.tsx` so nav +
wizard encouragement + the spark CTA are now ONE `<header className={s.heroBar}>`
with two internal rows (top: wordmark/nav/user, bottom: wizard + spark pill),
rendered ONCE outside the `{view === ...}` switch  -  so it now appears
identically on Home, Map, Work, AND Notes, per the "across the dash platform"
instruction, not just Contents. `WizardMascot` got a new `compact` prop
(46px sprite instead of 88px, smaller bubble) so it fits comfortably in a
shared strip that also has to hold nav and a spark pill on every view, not
dominate a whole Home-only row. Home's own remaining content dropped from 4
stacked bands to 2 (shared hero bar + a content pane holding a small
"Contents" title + the TOC + tool pills). Verified the SAME hero bar renders
on all four views via Playwright screenshots:
`agent_work/canvas-notebook/screenshots/2026-07-23_home_herobar_1440.png`,
`2026-07-23_map_herobar_1440.png`, `2026-07-23_work_herobar_1440.png`,
`2026-07-23_notes_herobar_1440.png`  -  all four show the identical
"Let's tackle Quadratic equations next" wizard line + yellow spark pill at
top, only the section content below changes.

**4. Spiral/binding-ring motif**, scoped exactly as instructed: read
`DASHBOARD_NOTEBOOK_SPEC.md`'s ring/binding vocabulary (center-gutter binding
shadow, stitch marks down the gutter) as reference, did NOT touch that spec's
much larger "Deep Field" dark-mode rebuild (different visual direction, a
separate initiative). Added one new `.deskSpine` element inside the shared
`.canvasStage` (so, like the hero bar, it's present under every view)  -  a
left-edge column with a soft vertical gutter-shadow bar and 7 small ring
"stitches" (`.deskRing`), same visual family as the existing `Book.module.css`
`.gutter`/`.stitch` spiral-ring system already used elsewhere in this app,
adapted from a center-gutter two-page layout to a single left-edge spine
since this canvas desk is one page wide. `.canvasStage`'s left padding
widened (24px → 38px) to make room for it without overlapping content. Hidden
on narrow screens (`@media max-width: 720px`), matching how the existing
`.gutter` already hides itself there. Visible in all four hero-bar
screenshots above (thin ring of small violet-white circles down the left
edge of the page).

**Em-dash sweep**: fixed 2 remaining hits found in `JournalStyleDrawer.tsx`
(contrast-warning copy, shop hint copy) plus everything in `Dashboard.tsx`,
`components/canvas/` (including pre-existing comments in files touched this
pass), and `components/book/` (ditto)  -  comments got a plain hyphen swap,
user-facing copy (`NotebookIntro.tsx`'s 3 `<li>` items, `WorkStudio.tsx`'s
loading tip, the 2 `JournalStyleDrawer.tsx` strings) got a proper rephrase
(colon, comma, or semicolon instead of a bare `-`). Final sweep:
`grep -rn "," app/src/pages/Dashboard.tsx app/src/components/canvas/
app/src/lib/actTopicEmojis.ts app/src/components/book/` → zero hits.

**Verification (all real, this pass):** `npx tsc --noEmit` clean. `npx
vitest run` → **85 passed, 1 skipped (86 total)**  -  identical to baseline,
zero regressions (re-ran after reverting the screenshot shim below, same
result both times). `npm run build` green, main JS chunk `5,417.66 kB` (was
`5,399.84 kB` in the last recorded build  -  the ~18KB delta is the 30 new
small icon SVGs, expected and small; pre-existing 500kB chunk-size warning
unchanged). `grep manjushree app/src/App.tsx` still shows the lazy import +
both routes (checked after the shim revert too). Screenshots captured via a
temporary `VITE_SCREENSHOT_MODE` env-gated shim in `App.tsx`/`Dashboard.tsx`
(same technique as the 2026-07-21 passes) driven by a scripted Playwright
session (not manual clicking) at a real dev server
(`VITE_SCREENSHOT_MODE=1 npx vite --port 5193`)  -  **fully reverted**,
confirmed via `grep SCREENSHOT app/src/App.tsx app/src/pages/Dashboard.tsx`
returning empty before this entry was written, and `tsc`/`vitest`/`build`
all re-run clean after the revert (numbers above are post-revert). All 8 new
screenshots saved under `agent_work/canvas-notebook/screenshots/` with a
`2026-07-23_` prefix; every pre-existing screenshot in that directory was
left in place, none deleted or overwritten.

**Noticed but out of scope to fix**: `ActEmojiMap.tsx`'s Map view logged
React "duplicate key" console warnings for a few concept ids
(`linear_equations`, `linear_inequalities`, `systems_of_linear_equations`)
during screenshot capture  -  pre-existing, not introduced by the icon swap
(same node/edge key logic as before, only the emoji-vs-icon rendering inside
each node changed). Looks like the same concept id appears in more than one
`ACT_TOC_SECTIONS` category (the section-filter regexes in `actToc.ts` aren't
mutually exclusive), so `layoutNodes()` places it twice with the same React
key. Flagging for whoever owns `actToc.ts`/`ActEmojiMap.tsx` next, same
pattern as the pre-existing `quadratic_equations`/Galileo story mismatch
already flagged in this file.

### Tutor + parent visual pass: shared StudentSummaryCard (Fable 5, 2026-07-23)

Akshat: "apply similar designs and what's important on tutor and parent side
too, like a nice summary card or something, neat and clean." Brought
`TutorDashboard.tsx`/`ParentDashboard.tsx` into the same parchment/violet
notebook language as the student `Dashboard.module.css` (`--desk-*` scale) ,
visual pass + one new centerpiece component, not a feature rewrite.

**New: `app/src/components/StudentSummaryCard.tsx` + `.module.css`**, the
"5-second read" card, one per student. Shows exactly three things: (1) the
student's current worst-weakness concept illustrated with the SAME
`storyArtFor()` plate + `conceptIconUrl()` badge the student sees on their own
dashboard, so a tutor/parent recognizes their student's actual world, not a
generic icon; (2) one composed sentence ("Weakest at Quadratic Equations,
around 42% mastery, last active 2d ago" + a quoted onboarding goal line when
present), deliberately not a raw mastery-percent dump, same spirit as
`TutorBriefingPanel`'s engine-to-sentence composition, just trimmed to a
single scannable line; (3) one clear next-action button (never a menu).
Fetches only `getStudentProfile` (topWeaknesses[0] + masteryByConcept),
one `users/{id}` doc (goal text), one `interactions` query (last-active), no
new backend endpoints, reuses what `TutorDashboard` already calls per-hero.

**Wired in:**
- `TutorDashboard.tsx`, new "Your Students" horizontal row (one card per
  roster student, capped at 8 + "+N more" note) above the existing grid.
  Primary action is "Start session" when a real join URL exists for that
  student (own session `meetingUrl` or the tutor's saved Meet room),
  else "View profile" (`setSelectedStudent`); secondary action reuses the
  existing `emailParent()` helper. All existing panels kept as-is:
  `TutorBriefingPanel`, `StudentIntelPanel`, `SessionCallCard`, Calendly,
  Google Meet room, flagged questions, live activity, classroom code.
- `ParentDashboard.tsx`, one `StudentSummaryCard` for the linked child,
  now the FIRST thing shown (above the existing "This week" hero/stats/
  strengths-gaps/tutor sections, which are unchanged and still the fuller
  detail underneath). Primary action is "Message tutor" (mailto) when a
  tutor is on file, else "View full report" (smooth-scrolls to the existing
  hero section via a new ref); secondary action is "View full report" when
  primary is the tutor mailto.

**Visual pass (not a rebuild):** `TutorDashboard.module.css`'s `--td-*` scale
and `ParentDashboard.module.css` (which gets its own new `--pd-*` scale, see
below) were re-pointed at the same values as `Dashboard.module.css`'s
`--desk-*` tokens, same ink/plum/gold/violet palette, same radius (12/16/22),
same shadow formulas, Caveat for the wordmark/short name labels, IBM Plex Mono
for uppercase eyebrow labels/buttons, rather than inventing a third design
system. Tutor's old dark-green/lime Duolingo-style top bar is now the same
dark ink-plum + parchment-gold as the rest of the notebook; hardcoded green
rgb tuples (`20,58,46` / `36,122,77`) swapped to the violet ink/leaf
equivalents throughout the file. Semantic status colors (live-activity green
pip, strength/weakness pill green/red, draft/pending/needs-review badges,
amber test-account banner) were deliberately LEFT alone, those signal state,
not brand identity.

**Real pre-existing bug fixed in passing:** `ParentDashboard.module.css`
referenced `var(--navy)`, `var(--blue-dd)`, `var(--gdd)`, `var(--blue-bg)` ,
none of which are defined anywhere in `global.css`, so those declarations
were silently invalid the whole time (text fell back to inherited/default
color instead of the intended navy/blue). Replaced with real, locally-scoped
`--pd-*` tokens matching the new palette. Untouched: `Admin.module.css` and
`StudentIntelPanel.module.css` also reference `--gdd`, out of scope for this
pass (different lane risk), flagging for whoever owns those next.

**Verification (all real, this pass):** `npx tsc --noEmit` clean. `npx
vitest run` → **85 passed, 1 skipped (86 total)**, identical to baseline,
zero regressions. `npm run build` green, main JS chunk `5,422.48 kB` (was
`5,417.66 kB` before this pass, the ~4.8KB delta is the one new component,
expected and small). Screenshots at
`agent_work/tutor-parent-summary/screenshots/`:
`2026-07-23_summary_cards_wide.png` (all three `StudentSummaryCard` states ,
populated with goal quote, populated without goal quote, and the "hasn't
practiced yet" empty state, plus the parent variant, all rendered via a
temporary dev-only route `/screenshot-harness-dev` feeding the REAL component
mock data through a temporary `__previewData` prop, since neither a tutor nor
a parent test account with real linked data currently exists in this repo)
and `2026-07-23_tutor_page_live.png` (the actual `/tutor` route live in a dev
server, via a temporary `VITE_SCREENSHOT_MODE` env-gated bypass in `App.tsx`'s
`AuthGuard`, same technique as prior passes today, confirming the full
page reskin: dark ink-plum top bar, gold accents, parchment/violet
background, Caveat wordmark, in real browser chrome, not just the isolated
card). Both temporary mechanisms (the `__previewData` prop, the
`_ScreenshotHarness.tsx` file + its dev route, and the `AuthGuard` bypass)
were **fully reverted**, confirmed via
`grep -rn "SCREENSHOT|ScreenshotHarness|__previewData|screenshot-harness-dev" app/src/App.tsx app/src/components/StudentSummaryCard.tsx app/src/pages/`
returning empty, and `tsc`/`vitest`/`build` all re-run clean after the revert
(numbers above are post-revert). `grep manjushree app/src/App.tsx` still
shows the lazy import + both routes, checked after the revert too, App.tsx's
net diff from before this pass is zero (temporary additions added then fully
removed). `grep -rln ","` across every file touched this pass
(`StudentSummaryCard.tsx/.module.css`, `TutorDashboard.tsx/.module.css`,
`ParentDashboard.tsx/.module.css`) → zero hits; `App.tsx` still has
pre-existing em dashes from the (untouched, uncommitted, not-mine) Manjushree
wiring already in the working tree before this pass, left alone
deliberately, both because this pass's net contribution to that file is zero
and because it's explicitly the highest-collision-risk shared file in this
checkout.

### Past-mistake wizard callback (Fable 5, 2026-07-23)

New mechanic: resurface a student's OWN past, dated struggle on a concept
once there's real evidence they've since improved, through the existing
`WizardMascot` (its `compact` prop from today's earlier dashboard work),
surfaced when a chapter opens (`ConceptChapterPage.tsx`'s cover panel).
Distinct from the already-live `journalGuide.ts`/`JarvisGuide.tsx` real-time
ink feedback (untouched, not duplicated), this is about a LATER callback to
a PAST moment, per `DASHBOARD_NOTEBOOK_SPEC.md`'s "you wrote 'flip the
sign??' here on June 12" reference idea.

**Honest data finding (read this before extending):** the literal quoted-
mistake version, and even the fallback "reframe the misconceptionCallout
text they saw" version, are NOT buildable from what's actually persisted
today. Traced the full path: `attempt_observations`
(`ml/mindcraft_graph/firestore_adapter.py`) is the only store holding
per-question detail (questionId, misconceptionId, errorType,
selectedChoiceIndex), but `firebase/firestore.rules` grants the client no
read rule on that collection at all, so the browser can't query it back
(adding that rule is a security-surface change outside this feature's lane,
Engine-owned deploy path). The story-skinned `misconceptionCallout` text a
student actually saw lives only in `sessionStorage` (`storyModule.ts`), gone
once the tab closes, never written to Firestore. And `student_work`'s
`selectedAnswerIndex` field IS durable, but the one write path that could
populate it for a WRONG choice (`ConceptChapterPage`'s soft-wrong retry flow)
clears `answers[qIdx]` before the debounced save fires, so a wrong pick is
never durably saved there either, only the eventual correct lock-in is.
What IS real, durable, and client-readable: the `interactions` collection
(rule at `firebase/firestore.rules:146`; deployed composite index
`interactions(studentId, timestamp)` already covers the query, no new index
needed), one aggregated PRACTICE SESSION per doc: `{conceptId, outcome
(signed, coin-flip-neutral at 0), source, timestamp}`. Built the callback
from THAT: real date, real concept, real evidence of improvement, honestly
framed as a performance callback rather than a misconception quote. Full
reasoning in the header comment of the new file.

**New: `app/src/lib/pastMistakeCallback.ts`.** `fetchConceptInteractionHistory`
queries `interactions` (own studentId, `source === 'practice'` only, excludes
the onboarding gap-scan self-rating and the tutor-summary parser, neither is
an observed attempt). `selectPastMistakeCallback` (pure, no Firestore) picks
the single most relevant past struggle: needs a real below-neutral session,
needs at least 2 real above-neutral sessions AFTER it (the "gotten this right
X times" evidence), and requires the LATEST session on that concept to also
read as good, never resurfaces a struggle while the student is presently
still struggling. Among qualifying struggles picks the MOST RECENT, not the
oldest ever recorded. Returns null (nothing rendered, no error state) when
there's no history yet or no qualifying evidence. Wired into
`ConceptChapterPage.tsx`'s cover panel (`renderOpenPanel`) via one `useEffect`
+ one conditional `<WizardMascot>` render; no new mascot/UI component built.

**Verification (all real, this session):** `npx tsc --noEmit` clean.
`npx vitest run` → **109 passed, 1 skipped (110 total)**, baseline 85/1/86
plus this session's 10 new `pastMistakeCallback.test.ts` cases plus the
parallel story-scenes agent's 14 `sceneSelection.test.ts` cases (their work,
not mine, confirms no collision). `npm run build` green. Real end-to-end
screenshot (not mocked inputs): stood up the Firestore + Auth emulators
locally (`brew install openjdk@21`, the bundled Java 17 is below the
emulator's minimum), seeded a real test student
(`past-mistake-test@example.com`) with 3 real `interactions` docs via
`firebase-admin` (one struggle on May 28, two clean sessions on Jun 30 + Jul
18), signed in through the actual `Login.tsx` email/password form via
Playwright (Google OAuth isn't automatable headless), navigated to
`/concept/linear_equations`, and captured the wizard bubble rendering "Linear
Equations was rough on May 28. You've gotten it right 2 times since." live on
the real chapter cover. All scaffolding used to do this (temporary
`VITE_USE_EMULATORS` emulator-connect branch in `firebase.ts`, temporary
`emulators` block in `firebase.json`, the Playwright driver script) was
**fully reverted**, confirmed via `git diff --stat firebase.json
app/src/firebase.ts` returning empty after the revert. `grep manjushree
app/src/App.tsx` still shows the lazy import + both routes (I never touched
`App.tsx`).

**Gotcha for whoever screenshots this app next:** `app/.env.local` currently
has `VITE_SCREENSHOT_MODE=1` (not mine, gitignored, presumably another
agent's in-progress harness per `App.tsx`'s `SCREENSHOT_MODE`/
`SCREENSHOT_USER` shim), this silently replaces the signed-in user with a
fake `screenshot-preview-uid` that owns no real Firestore data, which cost
real debugging time here (Firestore reads came back empty even though the
seed data was confirmed present via direct admin reads). Override per-process
with `VITE_SCREENSHOT_MODE=0` when you need a REAL authenticated session
alongside that flag being on in the shared `.env.local`.

**Open / next steps:** the per-question misconception detail (the actual
"flip the sign" granularity) is real progress waiting on either (a) a
deliberate, reviewed Firestore rule change to let a student read their own
`attempt_observations` docs, or (b) a durable write of the wrong
`selectedAnswerIndex` in `ConceptChapterPage`'s soft-wrong flow (currently
transient `eliminated` state only), either is a real product decision, not
a quick fix, and both cross into territory this task's brief explicitly said
to leave alone (`ml/**`/rules security surface, or changing core answer-flow
persistence). Flagging for a team discussion rather than guessing.

### Story scenes pilot: varying scenes for fractions_decimals (Fable 5, 2026-07-23)

Akshat's ask: the concept-lock system (`conceptStories.json` one `story` per
concept, `questionContextFrames.json` one `questionBridge` per concept) fixed
a real folk-tale-mismatch bug but means every fractions_decimals question
gets the identical bridge sentence forever, which reads as boring on repeat
sessions. Piloted "a short ordered list of scenes... different moments: a
different customer, a different dispute" for exactly one concept
(`fractions_decimals`), same locked protagonist (Simon Stevin) and art
throughout, per the brief.

**Interpretation of "numbers should make sense in context":** built as a
situational-anchor system, not per-question numeric rewriting. Each scene is
setting + a customer/dispute beat + a bridge sentence ending right before the
math ask (same style as the existing locked `questionBridge`), generic enough
that any real bank question's actual numbers can follow it without
contradiction. NOT hand-rewriting hundreds of question wrappers with
question-specific numbers baked in, that isn't what the architecture
supports at bank scale. Stating this back per the brief's explicit ask, in
case a tighter per-question binding was intended instead.

**Built:**
- `app/scripts/syncQuestionOntologyLayers.mjs` mirrors two read-only Layer
  2/3 slices from the Engine lane (`ml/data/5_level_ontology/**`, read-only,
  never written to) into the Product lane: `app/src/data/questionArchetypes.json`
  (all 84 Layer 2 archetypes, verbatim) and
  `app/src/data/questionArchetypeLinks.json` (the 342 of 450 Layer 3 seed
  question instances that carry a real archetype link, trimmed of verbose
  tutor-annotation prose). Concept-agnostic; re-run any time upstream Layer
  2/3 files change.
- `conceptStories.json`'s `fractions_decimals` entry gets an additive
  `scenes: []` array (5 entries), `story` untouched, shape unchanged for every
  other concept. 2 of the 5 scenes (`guild_shipment_shares`,
  `customs_manifest_count`) are anchored to the two real Layer 2 archetypes
  that tag `fractions_decimals` (`pie_chart_pair_sum_to_target_percent`,
  `pie_chart_percent_of_total_count`); the other 3 are hand-authored in the
  same protagonist/voice.
- `app/src/lib/sceneSelection.ts` (new, generic, not fractions_decimals-
  hardcoded): `selectSceneForQuestion(question, conceptId?)` picks a scene by
  archetype match first (question's bank id -> Layer 3 mirror -> archetype id
  -> tagged scene) if a real link exists, else rotates by a stable hash of
  the question id (deterministic, no `Math.random`, never always scene 1).
  Wired into `ConceptChapterPage.tsx`'s `chapterStem()` and
  `Practice.tsx`'s local fallback `framedLocalStem()`, plus
  `storyMatch.ts#matchSkinForQuestion`'s concept-lock branch (feeds the
  Groq/story-module conceptStory context too). Concepts without a `scenes`
  array (everything else, for now) fall through to the single legacy frame
  unchanged.
- **Found while testing:** only 1 of the 450 Layer 3 seed question instances
  is actually linked to `fractions_decimals`, and even that one plus its
  archetype sibling are filed under `descriptive_statistics` in the LIVE
  question bank (`actMasterQuestionBank.generated.json`), not
  `fractions_decimals`. So the archetype-match branch is real and unit-tested
  against real linked ids, but will rarely fire for actual fractions_decimals
  practice sessions today; rotation is what most students will see. Not a bug
  in this pass, a bank-coverage gap worth flagging for whoever does the next
  archetype-annotation pass.
- Tests: `app/src/lib/sceneSelection.test.ts`, 14 new tests (archetype match,
  rotation spread, determinism, no-scenes fallback, conceptId override).
  Full suite: 109 passed + 1 skipped (110 total, up from 95+1 baseline).
  `tsc --noEmit` clean, `npm run build` clean.
- Verified live in a real dev-server browser session (temporary
  `VITE_SCREENSHOT_MODE` AuthGuard bypass, same technique as prior passes
  today, fully reverted, `grep SCREENSHOT app/src/App.tsx` empty after).
  Screenshots at `agent_work/story-scenes/screenshots/`: 10 chapter-view
  questions showing 4 of 5 scenes rotate with real, non-contradictory math
  asks, plus a Practice-session screenshot showing the archetype-matched
  `guild_shipment_shares` scene correctly paired with a real fraction-addition
  question. Capture scripts kept at `agent_work/story-scenes/scripts/` for
  reruns.

**Open / next steps:** extend `scenes[]` to more concepts (additive, just
data); consider a richer archetype-to-live-bank join once more Layer 3
annotation lands so the archetype-match branch actually fires in production.

### Manjushree hidden action-math zone

**Read first:** `agent_work/manjushree-zone/HANDOFF_FOR_CLAUDE.md`, then
`MANJUSHREE_ZONE_REPORT.md` and `MANJUSHREE_ASSET_MANIFEST.md`'s 2026-07-21 2D-pivot
section (at the top of that file). Spec: `ORIGINAL_SPEC.md`. Full pivot reasoning + all
new lessons from this pass: `LESSONS.md` (durable lessons 19-27 + the pivot explainer at
the top).

**Status: rebuilt from Three.js 3D to a 2D layered-illustration scene (agent
`ab4994a97e2c6dc7f`), independently re-verified, NOT yet committed. The only remaining
gate is Akshat's own playthrough/sign-off, do not commit or push until that happens.**

**What changed in this pass**: the entire 3D presentation layer (`engine/ZoneEngine.ts`,
`world.ts`, `overlay.ts`, `postfx.ts`, the old `ManjushreeZone.tsx`'s Three.js mounting)
was archived (not deleted) to `app/src/manjushree/_archive-3d/`, see that directory's own
`README.md` for how to restore it if ever needed. `math/quadratics.ts` (untouched),
`math/content.ts` and `state.ts` (both adapted, not rewritten), and `telemetry.ts`
(untouched) were kept, they had zero rendering imports, so the entire visual swap cost
them almost nothing. `math/mapping.ts` was rewritten (same "one shared function" principle,
now targeting SVG percent-space instead of Three.js world units). The zone is now a plain
DOM/CSS layered scene matching the house style of `spark/spark.js` and
`components/book/**`, with one dedicated SVG component (`ParabolaOverlay.tsx`) for the one
thing that deserves genuine math-driven drawing: the parabola curve itself.

**Gameplay simplified** per the owner's own description: arrival (establishing
illustration) → villager dialogue (a real short exchange, not a text dump) → travel
transition → Wisdom Sight reveal → roots ("sword power", first charge) → axis-of-symmetry
+ vertex height as two rune-stone sub-steps inside ONE "cleave power" encounter (dropped
axis as its own separately-gated phase, per the brief, the math/misconception checks
underneath are unchanged) → hold-to-strike → a 5-6s cut cinematic (crack-line SVG reveal +
two CSS `clip-path` image halves separating + an unclipped turquoise water layer
underneath) → result / learning summary (same content/structure as before, restyled).

**Three real Higgsfield-generated 2D illustrations** (all in `app/src/manjushree/assets2d/`,
full prompts/costs in the asset manifest): the valley/hill background (reused across
arrival, hill, and cinematic beats via CSS framing/clip-path, no second image needed), the
villager sprite, and the sword/charge icon. 4 of 5 available credits spent, 1 left
unspent as reserve.

**Re-verified after the full rebuild (by Claude, not just trusting agent output):**
`tsc --noEmit` clean, `vitest run` **85 passed + 1 pre-existing skip (86 total)**, up
from 82 total before this pass (3 new mapping tests + 3 new vertex-height-candidate tests,
zero regressions), `npm run build` green, the Manjushree chunk is now **~44KB JS / ~17KB
CSS** (was ~622KB with the Three.js engine). A full scripted Playwright playthrough
(`/manjushree-dev?q=mjz_q01`) drove the entire loop end to end (both a wrong-answer trap
path and a correct path at every gated step) and captured 24 screenshots into
`agent_work/manjushree-zone/screenshots/2d_pivot_2026-07-21/`, reviewed all of them
personally and found + fixed 4 real bugs this way (not just eyeballed): a duplicated
villager sprite behind the dialogue panel, a duplicated travel-line toast, the parabola
curve plunging off-screen outside the roots (needed the same `Math.max(0, ...)` clamp the
old 3D ridge mesh used), and the cinematic "water flowing through the gap" being invisible
(the water layer was clipped to the same shape as what was moving over it, so it could
never show in a NEW gap, fixed by making it a static full-bleed layer underneath instead).
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
   `agent_work/manjushree-zone/**`) and push to `main`, CI auto-deploys. Note: the
   Dashboard.tsx/Dashboard.module.css portal snippet already landed in commit `69bbf4c4`
   (a concurrent dashboard-redesign session on this same checkout swept it up while
   committing its own unrelated work), verify it's still there (`grep manjushreeGlow
   app/src/pages/Dashboard.tsx`) rather than assuming it needs re-adding. **App.tsx got
   fully overwritten by that same concurrent session at least once this pass and had to
   be re-applied**, before shipping, re-confirm `grep manjushree app/src/App.tsx` still
   shows the lazy import + both routes, in case it happened again after this session ended.
3. If not: describe exactly what's still wrong and start a new focused pass, the 2D
   scene/math/state underneath is solid and tested, only iterate on what's actually broken.
4. Optional, not blocking: Firestore `events` create rule (telemetry currently soft-fails
   on writes with no matching rule, unchanged gap from before this pass, see
   `MANJUSHREE_ZONE_REPORT.md`).
5. Read `agent_work/manjushree-zone/NEXT_RUN.md`'s "bigger vision" section before starting
   any follow-up work here, this chapter is explicitly a proof-of-concept for a much
   larger per-question story-world pattern Akshat wants eventually, and he was explicit
   about NOT forking attention across multiple chapters/questions until this one has "a
   decent run."

**Everything else in this repo is already committed and pushed to `main`** as of commit
`d8fbcbe3`, this Manjushree work is the only uncommitted thing in the working tree.

**Why this matters beyond this one chapter**: Akshat revealed the actual long-term goal ,
every question, on its own page, should eventually become an embedded 2D story-world with
space to write, paying off on completion with a narrative tied to the concept solved
("you saved a city"). Manjushree Zone is the deliberate first proof-of-concept for that
reusable pattern; other questions/concepts follow only after this one has "a decent run"
(his explicit sequencing, don't fork attention across many at once). Full writeup:
`agent_work/manjushree-zone/NEXT_RUN.md` (new section at the bottom, "The bigger vision
this is a proof-of-concept for").

---

## Previous sprint, 2026-07-08

### Cursor, Product lane (`app/**` ONLY)
**Spec:** `agent_work/product/STORY_INTRO_RENDER_SPEC.md`

Add the `storyIntro` rich narrative scene block. Three files to touch:
1. `app/src/lib/questionBank.ts`, add `storyIntro?: string` to `Question` interface
2. QuestionPage CSS module, add `.storyIntroBlock` class (spec has the exact CSS)
3. The component that renders `storyContext`, prepend the storyIntro block above it
   (`grep -rn "storyContext" app/src/` to find it)
4. Add real storyIntro to 5+ story cells following tone rules in the spec

Verify: `npm run build` passes. Commit, push to main.

✅ Done (Fable 5 + Cursor), `storyIntro?: string` added to `Question`; storyContext only actually
renders in `GradeOnboard.tsx` (spec's assumed `book/QuestionPage.tsx` doesn't exist), so the
italic `.storyIntroBlock` was added to `GradeOnboard.module.css` and rendered above the
existing `storyContext` line there; 6 storyCells.json cells (fractions_decimals ×2,
linear_equations ×2, ratios_proportions ×2) got real storyIntro content. **Cursor follow-up:**
same blocks wired into `Practice.tsx` session UI (journal paper theme via `.matteShell` /
`.paperScan` overrides). `npm run build` green.

**Do NOT touch:** `ml/**`, `homework/**`, `webhook/**`, `index.html`

---

### Codex, Engine lane (`ml/**` ONLY)
**Primary spec:** `agent_work/engine/STORY_CELL_SCALE_PLAN.md` (read Sections B + D)

**Task 1 first:** Write `ml/mindcraft_graph/world_feedback.py` (spec Section D)
- Exports: `WORLD_FEEDBACK_SYSTEM_PROMPT`, `build_world_feedback_user_prompt(...)`, `generate_world_feedback(...)`, `cache_key(...)`
- After writing, update `ml/scripts/world_feedback_generator.py` to import from this module
  (replace the duplicated inline versions)

✅ Done (Claude Code, 2026-07-08), `ml/mindcraft_graph/world_feedback.py` created (also exports
`load_cache`/`save_cache`/`build_ontology_index`); `world_feedback_generator.py` refactored to
import from it, dry-run output unchanged (`total=138 filled=121 cached=0 no_misconception=17 errors=0`).

**Task 2 after Task 1:** Write `ml/scripts/generate_story_cells.py` (spec Section B)
- DNA cells in → math verified → Katha-narrated → Gate A scored → output JSON
- Uses `ml/generation/llm_client.py` for all LLM calls
- Math integrity auto-verify: re-solve, discard on disagreement
- Dry-run must pass: `python3 ml/scripts/generate_story_cells.py --dry-run`

✅ Done (Claude Code, 2026-07-08), 4-step pipeline (math spine → independent re-solve verify →
Katha narrative → 7-dim pedagogy score/gate) built; per-distractor `world_feedback` generated via
the shared module from Task 1. `--dry-run`, `--limit`, `--concept`, `--dna-file`, `--no-llm` all
wired; live run needs `LLM_PROVIDER=groq` (no GROQ key in this sandbox, so only dry-run + a
graceful-failure smoke test were exercised here, verified error handling drops cleanly with no
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
| Story Intelligence spec v2, agent-loop human gates, diagnostic IG selection, worstWeakness tier 3, voice skins | Claude (architecture) | `STORY_INTELLIGENCE_SPEC_V2.md` (new), `CLAUDE_HANDOFF.md` (lane rows + done markers), `ACTIVE_TASK.md` | ✅ Done, design only, no code touched; implementation lanes assigned in spec §5 |
| Founder portrait expansion polish | Codex | `index.html`, `ACTIVE_TASK.md` | ✅ Done |
| Diagnostic placeholder cleanup + landing profiles | Codex | `app/src/data/storyCells.json`, `app/src/lib/questionBank.ts`, `app/src/components/QuestionFigure.tsx`, `app/src/pages/GradeOnboard.module.css`, `index.html`, `img/ab-founder.jpeg`, `img/mindcraftmascot.jpg`, `ACTIVE_TASK.md` | ✅ Done |
| Landing mascot/map/founder flip polish | Codex | `index.html`, `ACTIVE_TASK.md` | ✅ Done |
| Diagnostic ACT probe step | Codex | `app/src/pages/Diagnostic.tsx`, `app/src/data/actDiagnostic.json`, `app/src/pages/Diagnostic.module.css`, `ACTIVE_TASK.md` | ✅ Done |

**Codex diagnostic probe summary (2026-07-08):** ✅ Done, added the `probe` step between goals and confidence with four real ACT cluster anchors rendered through `MathText`.
Files changed: `Diagnostic.tsx`, `actDiagnostic.json`, `Diagnostic.module.css`, `ACTIVE_TASK.md`.
Verification: `npm run build` passed from `~/Developer/mindcraft/app`.

**Codex landing polish summary (2026-07-08):** ✅ Done, mascot is cropped instead of squished, CTA copy is punchier, map labels are shorter, and founder cards flip as full rectangles.
Files changed: `index.html`, `ACTIVE_TASK.md`.
Verification: `npm run build` passed from `~/Developer/mindcraft/app`.

**Codex diagnostic/landing summary (2026-07-08):** ✅ Done, removed stale tank placeholder cells from app data, added frontend safety filter, and stopped generic area/volume tags from drawing random XY grids.
Files changed: `storyCells.json`, `questionBank.ts`, `QuestionFigure.tsx`, `GradeOnboard.module.css`, `index.html`, `img/ab-founder.jpeg`, `img/mindcraftmascot.jpg`, `ACTIVE_TASK.md`.
Verification: storyCells now 12 curated / 0 tank / 0 template; no-install syntax/source checks passed; TypeScript not run because fresh clone has no `app/node_modules`.

**Codex founder UI summary (2026-07-08):** ✅ Done, founder stories now open as stable desktop overlays instead of resizing the two-column grid.
Files changed: `index.html`, `ACTIVE_TASK.md`.
Verification: read back CSS/JS changes; no git commands run.

**Codex ML summary (2026-07-08):** ✅ Done, story studio `--per-concept`, aggregate + enrich scripts, 99 ingredient cells structurally valid.
⚠️ **Quality gate:** deterministic fallback = same tank stem ×99, **do not ship to app** until LLM batch completes. Use `python3 ml/scripts/merge_story_cells_for_app.py` (ships 3 LLM cells only).

**UX fix summary (2026-07-08):**
- ✅ Fix 1, Jarvis right-side only: removed `<JarvisGuide side="question">` from `ConceptChapterPage.tsx` and `GradeOnboard.tsx`; added `user-select: none; cursor: default` to `HighlightedStem.module.css`.
- ✅ Fix 2, ScratchPad expression evaluator + mini graph: `ScratchPad.tsx` new recursive-descent `safeEval`, `parseFnLine`, `MiniGraph` SVG component; overlay positioned by workLine bbox. Parents (`ConceptChapterPage.tsx`, `GradeOnboard.tsx`) pass `evalLines` prop.
- ✅ Fix 3, ScratchPad eraser + session logs: eraser × button with 200ms fade + confirm-before-clear; Logs dropdown (last 5) keyed by `questionId` in `localStorage`; new CSS in `ScratchPad.module.css`.
- ✅ Fix 4, Page flip animation: `PageFlipTransition.tsx` rotateY 7° → 90° with `backfaceVisibility: hidden`, `willChange`, `transformPerspective: 1800`.
- ✅ Fix 5, GradeOnboard grade auto-advance + voice: grade buttons immediately advance step; caption text removed; goals step replaces chips with text input + `MediaRecorder` voice button (60s, pulsing); `GradeOnboard.module.css` updated.
- ✅ Fix 6, World fullscreen lock: `mc-world-chrome.js` adds `fullscreenchange` listener + `userExitedIntentionally` flag set only on ESC; re-requests fullscreen on unexpected exit.
- ✅ Fix 7, Booking button: added `{ to: '/book', label: 'Book a Session' }` to `Sidebar.tsx` NAV; removed duplicate text link from `DashboardNotesPanel.tsx` empty state.
| MCQ triple-verify pipeline | ✅ Done (Fable 5) | `ml/scripts/pipeline/mcq_generator.py`, `story_wrapper.py`, `sources/openstax.py`, `ingest.py`, `PIPELINE_MCQ_SPEC.md` | Committed `43e3d62d`, pushed |
| Practice session journal paper reskin | ✅ Done (Fable 5) | `app/src/pages/Practice.module.css` | Committed `0b698e2a`, pushed |
| iPad login + world diagnostic flow | Codex | `app/src/pages/Login.tsx`, `app/src/pages/Login.module.css`, `worlds/world2/index.html`, `worlds/world2/mc-world-chrome.js`, `worlds/world2/mc-diagnostic.css` | ✅ Done |
| Google login fullscreen bug | Cursor | `app/src/pages/Login.tsx` | ✅ Done, redirect auth on iPad; no fullscreen on login; fullscreen stays on Enter World |
| OpenStax MCQ 50-item test batch | Cursor | `/tmp/openstax_mcq_test_v3.json`, `ml/data/.mcq_test_v3_log.txt` | ✅ Done, **52% yield** (26/50) after concept balance + HTML alt recovery; full batch running |
| Story Cell Studio LLM batch (3) | Cursor | `ml/data/story_cells/batch_llm_002.json`, `story_cell_studio.py` | ✅ Done, real LLM cells (Steady Drift, Waterfowl Pond, Thales shadow) |
| OpenStax MCQ full batch (5 concepts) | Cursor | `ml/data/openstaxMCQ.json`, `ml/data/.openstax_mcq_full_log.txt` | ✅ Done, **221 questions** (29.3% of 753); wire in Product lane |
| Founder section copy + photos | Codex | `index.html`, `img/akshat-koirala.jpg` | ✅ Done |
| Landing visual polish + mascot | Codex | `index.html`, `img/fibonacci-bear.svg` | ✅ Done |

✅ Done, removed the awkward hero arrow, fixed the triangle connector, and cleaned red process arcs/labels.
✅ Done, tightened section language and replaced wordy chips with visual signal cards.
Files changed, `index.html`, `img/fibonacci-bear.svg`, `ACTIVE_TASK.md`.

✅ Done, Jarvis margin companion: pencil notes in the red margin, lime highlighter on question stems, reads scratch ink + debounced `/api/jarvis` coach nudges.
✅ Done, Wired into chapter spreads + login diagnostic probe (left=question highlights, right=work + transcription readout).
Files changed, `journalGuide.ts`, `useJournalGuide.ts`, `JarvisGuide.*`, `HighlightedStem.*`, `ConceptChapterPage.*`, `GradeOnboard.*`, `ScratchTranscriptionPane.module.css`, `ACTIVE_TASK.md`.

✅ Done, founder copy is shorter, more human, and less resume-like.
✅ Done, Akshat's real headshot is now in `img/akshat-koirala.jpg`; Blake still needs an actual `img/blake-kell.jpg` file.
Files changed, `index.html`, `img/akshat-koirala.jpg`, `ACTIVE_TASK.md`.

✅ Done, login now has responsive iPad/iPhone/MacBook sizing plus a user-triggered fullscreen option.
✅ Done, world entry removes visible `3D | Web` and `Click Projects` chrome, wakes audio on Enter, and opens diagnostics automatically.
Files changed, `app/src/pages/Login.tsx`, `app/src/pages/Login.module.css`, `worlds/world2/index.html`, `worlds/world2/mc-world-chrome.js`, `worlds/world2/mc-diagnostic.css`.

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

0. **NotebookLM session notes + interactive figures**, spec: `agent_work/cross-cutting/SESSION_NOTEBOOK_ARTIFACTS_PLAN.md`. Two tracks: (A) Desmos figures for graphable questions via inferred `FigureSpec` (Product, ships alone); (B) concept-grouped "notebook" in Notes → select sources → `/synthesize-artifact` (Groq) → flashcards/figure v1 (Product + Engine). v1 cut: flashcards + figure. Start with Track A.
1. **Wire OpenStax MCQ bank**, `ml/data/openstaxMCQ.json` ready (**221** story-wrapped MCQs, 5 concepts). Product lane: import in `questionBank.ts` like `openstaxQuestions.json`.
2. **Story Cell Studio scale**, run `--concepts all --refresh` batch to `ml/data/story_cells/batch_all.json` (3-concept LLM pilot ✅ in `batch_llm_002.json`).
2. **FABLE5 Area 2**, Dashboard personalization: mastery bars, top-6 weaknesses, skeleton shimmer (see `FABLE5_VISION.md §Area 2`)
3. **FABLE5 Area 3**, PawHub upgrades: concept labels in pads, pulse animation, SVG progress ring
4. **FABLE5 Area 4**, Tutor focus areas
5. **Jarvis dashboard margin notes**, chapter + diagnostic done; dashboard margin notes still open

---

## Shared seam files, check before touching

- `app/src/lib/questionBank.ts`, question shape contract. Last touched: wired OpenStax + Khan slots
- `app/src/lib/mlApi.ts`, ML API client. Last touched: pointed at HF Spaces
- `app/src/data/conceptStories.json`, 41 story worlds. DO NOT overwrite, append only
- `app/src/data/questionContextFrames.json`, 47 context frames. Last touched: all rewritten this session

---

## Agent token tips

- Start with this file. Then read only the deep doc for your specific task.
- If you're doing UI: read `FABLE5_VISION.md §Area N` for your area only
- If you're doing pipeline: read `PIPELINE_MCQ_SPEC.md` + `ml/scripts/pipeline/base.py`
- If you're doing stories: read `WORLD_VISION.md §9` (story quality standard) + `conceptStories.json` for the concept you're touching
- Never read `CLAUDE.md` in full, use Ctrl+F for the section you need
