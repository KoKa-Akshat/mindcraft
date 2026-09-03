# Desk OS · Workspace redesign handoff (2026-09-02)

Combined work: Codex's Workspace/Tutors redesign, finished and extended here
with a matching Resume Helper pass. All in `agent_work/product/desk_os/`
(source of truth — `app/public/desk-os/` and `app/dist/desk-os/` are
generated copies, `npm run sync:desk-os` / `npm run build` in `app/`).

## What Codex built

- Replaced the oversized cube hero with a paper-workspace layout: a
  hero "next page" sheet that opens `/learn`, a Jesse activity slip tied to
  the real `learnActivityCount` handoff, three real header tabs (Workspace,
  Resume studio, Tutors & events) that swap surfaces in place — no page
  navigation between them.
- Wired both Learn entry points (`hub-hero-cta`, the paper sheet itself) to
  navigate immediately, no artificial delay.
- Fixed a real responsive bug: the tab row was overflowing the header on
  narrower screens. Moved to its own grid row below 1100px
  (`styles.css:6460`), confirmed no horizontal overflow at 834px and 390px
  widths.
- Verified via real screenshots: desktop, iPad both orientations, phone,
  and tutor role (tutor tiles swap in for the student hero/Jesse slip).

## What I added: Resume Helper polish

The founder asked specifically for Resume Helper to "look so much better"
now that it's a first-class tab next to Workspace and Tutors. It already
shared the same card chrome (`.hub-tutor-duo`/`.hub-tutor-pane`) but the
interior felt like a bare form next to Tutors' richer cards. Changes,
scoped to `index.html`, `styles.css`, `js/resumeHelper.js`:

1. **Starter prompt chips** (`js/resumeHelper.js` `STARTER_PROMPTS`,
   `.rh-starters`/`.rh-starter`): three tap-to-send opening messages
   ("I don't have a resume yet…", "I'm looking for summer internships…",
   "Ask me the right questions…") shown only on a genuinely first-time
   profile (same `substantive` check the existing greeting already used).
   Tapping one sends it through the real chat pipeline (`bubble('you', …)`
   + `askJesse(…)`), same as typing it — not decorative, and it retires
   itself the moment the student sends anything, including their own typed
   message or a file upload (moved the hide into `bubble()` itself so every
   real-engagement path covers it, not three separate call sites).
   This also fixes a latent bug in the same spot: `greetOnce()`'s
   "already greeted" check was `!transcript.childElementCount`, which
   would have broken the moment a static element ever lived inside
   `.rh-transcript` — changed to `!transcript.querySelector('.rh-bubble')`.
2. Upload buttons ("Upload resume (PDF)", "Upload a writing piece") got a
   small upload icon — previously bare dashed-outline text buttons.
3. The profile pane header got an icon badge (lime circle, matches the
   `.rh-chip` treatment already used for skills) so it visually pairs with
   Jesse's avatar circle instead of reading as a plain form label.
4. "Add" buttons for skills/links upgraded from flat white-outline to the
   same dark-fill treatment as the Send/Search buttons elsewhere in the
   hub, for consistent visual weight on primary actions.

No data hooks, auth flow, or backend contracts touched — every
`data-rh-*` attribute `resumeHelper.js` reads is unchanged.

## Verification

- Playwright walkthrough against a local static build of `app/dist`
  (unauthenticated local demo path, `/try/desk`-equivalent): entered as
  Student, screenshotted Workspace, Tutors, and both Resume Helper steps
  (build + jobs table) at desktop width, then Resume Helper again at
  834×1194 (iPad portrait) and 390×844 (phone) — zero horizontal overflow
  at either width, no console errors or exceptions during the whole walk.
- Clicked a starter chip live: confirmed it sends through the real chat
  path (user bubble appears, "Jesse is reading" status, chips retire
  immediately) rather than just looking clickable.
- `node --check js/resumeHelper.js` — syntax clean.
- `npm run build` in `app/` (sync:desk-os + tsc + vite build) — clean.

## Round two: Resume Helper rebuilt as a three-pane app (same day)

The founder shared a screenshot of a competitor's job-search copilot
("Jack"/Jill") — a persistent center chat with real message history (like
ChatGPT web), a left rail, and a right panel whose content the rail
decides — and asked for the same shape, "prettier". This replaced the
whole two-step boxed layout above, not just its interior polish.

**Architecture** (`index.html`'s `#hubResume`, all under `.rh-app`, a
3-column CSS grid): a left icon rail (`Jobs`/`Profile`/`Documents`), a
center `.rh-chat-col` that is the same Jesse conversation at all times —
it never swaps out — and a right `.rh-side` whose three `.rh-side-panel`s
toggle visibility based on which rail button is active
(`resumeHelper.js`'s `selectRail()`, replacing the old mutually-exclusive
`setStep('build'|'jobs')`). `rail` state persists per-session the same way
`step` used to (`sessionStorage`, key renamed `RAIL_KEY_PREFIX`).

- **Jobs** (default): discovery (`runDiscovery`) + candidate cards
  (unchanged logic) plus a compact "On your board" list. This used to be
  a `<table>`; at the side panel's ~400px width a 5-column table either
  clipped its last column or forced horizontal scroll (tried both, then
  gave up on the table entirely) — replaced with a stacked row list
  (`.rh-board-row`, same shape as the new Documents rows below) once real
  content was screenshotted and the clipping showed up. A lime badge on
  the rail button shows the live discovered-candidate count
  (`data-rh-jobs-badge`, driven by `paintCandidates()`).
- **Profile**: the same editable fields/skills/experience/links form as
  before, unchanged logic, restyled.
- **Documents** (new): one resume + one cover letter button per board
  role, aggregated in one place instead of two columns squeezed into the
  old jobs table. Reuses the exact `.rh-pdf`/`downloadPdf()` buttons and
  click handler that already existed — `paintDocuments()` is new, the
  download logic is not.
- **Composer**: the two upload buttons moved behind a "+" attach popover
  (`data-rh-attach`/`data-rh-attach-menu`, click-outside-to-close) instead
  of two always-visible dashed buttons, and a persistent quick-actions row
  above it ("Find openings for me", "Resume feedback", "Review my
  profile", "My documents") — all four wired to real functions
  (`runDiscovery`, `askJesse` with a canned feedback prompt, or
  `selectRail`), no fake affordances.
- Restyled everything (`.rh-*` in `styles.css`) off the same desk-token
  palette (`--desk-ink`/`--desk-paper`/`--desk-forest`/`--desk-muted`,
  `--serif` for panel titles) Codex's redesign already established for
  Workspace/Tutors, replacing the older hardcoded-hex palette this section
  had before — the whole hub reads as one design system now, not two.
- `.rh-app` sizes to `clamp(520px, calc(100vh - 200px), 820px)` — a big,
  mostly-full-viewport app rather than a page-scrolled card, without
  touching `.hub-stage`/`.hub-main`'s shared scroll model (which every
  other panel still relies on) to keep blast radius contained to this one
  section.
- Below 1000px: rail becomes a horizontal strip at the top, chat and the
  active side panel each get a bounded height with their own scroll,
  matching the mobile pattern the rest of Desk OS already uses.

Not built: a "Coaching" section and a distinct "Job search settings"
section, both present in the reference. Skipped rather than faked —
neither maps to a real MindCraft feature today (age/BYOK config already
lives in the global Settings button; there's no coaching flow at all).
Worth a real look if the founder wants either as an actual feature later.

### Verification (round two)

- Playwright walkthrough of all three rail panels plus the attach-menu
  popover at desktop width — zero console errors/exceptions.
- Injected realistic populated content (a discovered candidate, two board
  roles, a generated document) via `page.evaluate` to screenshot the
  non-empty states, since the local demo has no real Firestore data — this
  is exactly what caught the jobs-table clipping bug above before it
  shipped.
- Live end-to-end check: clicked a starter chip, confirmed it flows
  through the real `askJesse()` chat call (not just a UI toggle) — "Jesse
  is reading" status, disabled Send button, lime user-bubble all appeared
  correctly.
- Responsive: 834×1194 (iPad portrait) and 390×844 (phone) — zero
  horizontal overflow at either. One visual question mid-review (a starter
  chip looked cut off on phone) turned out to be legitimate scroll
  clipping on measurement (`transcript.scrollHeight` 365 vs `clientHeight`
  312, chat-col bottom flush against quick-actions top, zero pixel
  overlap) — not a layout bug, left as-is.
- Regression: re-screenshotted Workspace and Tutors after all changes —
  both pixel-identical to before, confirming the shared desk-token
  variables and hub chrome were untouched.
- `node --check js/resumeHelper.js` clean, CSS brace count balanced
  before and after the ~400-line block replacement, `npm run build`
  (tsc + vite) clean.

## Round three: the Workspace hero's card is now the real knowledge map

The founder shared a screenshot of the actual Knowledge Map (the dark,
colored-cluster force graph) and asked for it to replace the static "next
page" paper-sheet visual, auto-rotating, "blending into the color we have",
with a search bar that comes down on click instead of navigating away
immediately.

**Reused the real thing, did not rebuild it.** `app/public/full-graph-viewer.html`
is the exact 3d-force-graph viewer `/learn` itself already embeds
(`Learn.tsx:909`), reading the real `full-concept-graph.json` (4,118
concepts), and it already auto-rotates on load (`controls.autoRotate`,
turns off the moment someone drags). The hero's paper-sheet card
(`.hub-paper-sheet`, kept for its rotated/shadowed "paper" chrome) now
holds this same file in an iframe instead of static text — same-origin, so
its root-relative `fetch('/full-concept-graph.json')` resolves correctly
regardless of being embedded under `/desk-os/`.

- **"Blending into the color we have"**: a `.hub-graph-vignette` overlay
  (`box-shadow: inset 0 0 70px 18px var(--desk-paper)`) softens the dark
  canvas into the paper card's cream edges instead of ending in a hard
  rectangle. Recoloring the graph's own subject-hue palette for a light
  background was out of scope — that's the tuned, working visualization
  Learn also depends on, not something to fork.
- **Click reveals search, doesn't navigate**: a transparent `.hub-graph-veil`
  button covers the card until the first click, which hides itself and
  slides `.hub-graph-search` up from the bottom (CSS transition, respects
  `prefers-reduced-motion`). After that the veil is gone and the 3D map
  itself is interactive (drag to orbit, click a node — its own existing
  behavior, untouched). Submitting the search form navigates to
  `/learn?q=<text>` — the same real `?q=` deep link `Learn.tsx` already
  runs one search from on mount, not a new endpoint.
- Two small, backward-compatible additions to `full-graph-viewer.html`
  itself (affects Learn's own real map too, not just this embed):
  `controls.autoRotate` now respects `prefers-reduced-motion`, and a new
  opt-in `?hideLegend` param (Learn's own embed doesn't pass it, so its
  behavior is unchanged) fully hides the coverage-key panel, which
  competed with the new search bar for the same bottom-left corner at
  this card's much smaller size.
- Real bug caught by screenshot, not assumed: `.hub-paper-raccoon`
  (z-index 4) sat on top of `.hub-paper-sheet` (z-index 3) at the card's
  bottom-right corner — fine for the old static card, but it silently
  covered the new search bar's submit button once added there. Moved the
  raccoon to the right edge, vertically centered (`top:50%`), the one
  spot clear of the bookmark ribbon (top), the graph tag pill (top-left),
  and the search bar (bottom) at every card height this hero renders at.
  Also switched the search input from `type="search"` to `type="text"`:
  Chromium's native clear-icon on search inputs was rendering in the same
  corner as the custom submit button.
- Removed the now-dead `.hub-sheet-*`/`.hub-thread` CSS (the old static
  card's title/kicker/Ask-Work-Keep-dots content) and the mobile-breakpoint
  overrides that targeted them.

**Not built: a "friends online" indicator**, the other half of the
founder's ask. There is no presence/online system anywhere in this
codebase — `friends.js`'s "Call a friend" list (`users/{uid}/friends`) is a
personal contact list with no online/offline signal at all, and it only
loads its data lazily when its own panel opens, not eagerly on hub load.
Showing a real "N online" count would need an actual heartbeat/presence
write path, a genuine feature, not a styling change. Showing a fake number
would violate this project's working rule (established earlier this
session with alumni data, tutor availability, "zero is an honest answer"
for job search) never to invent a stat this codebase doesn't actually
back. Skipped rather than faked; worth scoping as its own feature if the
founder wants it.

### Verification (round three)

- Playwright: entered as Student, screenshotted the hero before/after
  clicking the veil, filled the search input, submitted it, and confirmed
  the resulting URL was the real `/learn?q=quadratic%20equations` deep
  link — not just that a form existed.
- Caught the raccoon/submit-button overlap and the native search-clear-icon
  collision by looking at real screenshots and a `boundingBox()` check on
  the submit button, not by inspecting CSS in isolation.
- Responsive: 834×1194 and 390×844, zero horizontal overflow at either,
  raccoon and search bar both confirmed clear of every other element in
  the stack at both sizes.
- Confirmed `Learn.tsx`'s own `full-graph-viewer.html` embed (`?hideSubjects`
  only, no `?hideLegend`) is unaffected by both additions to that shared
  file — real backward-compatibility check, not an assumption.
- `npm run build` (tsc + vite) clean.

## Round four: EntryStage gets a real mode chooser + voice input, History goes pure, legend removed on /learn too

Same day, next ask, covering five separate items:

1. **Legend removed from /learn's own embed too** — `Learn.tsx`'s iframe
   src now also passes `&hideLegend` (previously only the Desk OS embed
   did). This also removed the one real reason `EntryStage`'s new bottom
   search bar needed a responsive breakpoint (the legend's bottom-left zone
   it used to dodge below ~1088px wide) — simplified back to a single
   `bottom: 28px`, verified via a static preview at desktop/iPad/phone that
   nothing else lives there to collide with now.
2. **Graph motion**: `full-graph-viewer.html`'s `controls.autoRotateSpeed`
   0.35 → 1 (roughly 3x, still gentle) — shared file, benefits both /learn
   and the Desk OS hero card.
3. **History sidebar stripped to a pure session list.** Dropped the search
   input, upload button, and every status line (materialsError, embedPct,
   resolveMeta, studiedIds, searchErr) that Phase G1 had folded in here —
   `HistorySidebarProps` shrank from 22 fields to 9. Pill label is always
   "History" now (was conditionally "Search" with zero sessions).
   **Real bug caught and fixed to make this safe, not just a rename**:
   `backToGraph()` (the "Back to full graph" button shown once a concept
   resolves) never reset `searchedQuery`/`materials`, so clicking it used
   to land on a screen where `resolved === null` but `searchedQuery` was
   still truthy — failing `EntryStage`'s own render guard
   (`!searchedQuery && !materials && !routeCardsFor`), meaning no search UI
   at all. The sidebar's own (now-removed) search input was the only way
   out of that dead end. Fixed `backToGraph()` to do a real full reset
   (`searchedQuery`, `query`, `materials` and its sub-state, the `?q=` URL
   param) so it reliably lands back on `EntryStage` — a real fix this
   session's removal needed to be safe, not scope creep.
4. **"Help me learn something new" now opens a real two-option chooser**
   instead of jumping straight to the search bar: **Fun Lessons** (the same
   real search — "begin" focuses the same bottom bar) and **Vocal
   Practice** (speak the question instead of typing it). Neither term
   existed anywhere in the codebase before this — verified via a full
   repo-wide search — so Vocal Practice's actual behavior was a real
   design call, not a lookup: real browser `SpeechRecognition`
   (`webkitSpeechRecognition` fallback for Safari), transcript becomes the
   query and runs through the same real `runSearch()` every other entry
   point already uses. No new backend, no fabricated "vocal practice"
   pedagogy — just voice as an alternate input method for search that
   already works. Handles all three real states honestly: listening (pulse
   animation), unsupported browser (a real message naming Chrome/Edge/
   Safari-iOS-17+, not a silently dead mic), and error (mic denied vs. no
   speech heard, with a Try again). Fixed a real stale-closure risk along
   the way: `onSearch` had to gain an optional explicit `text` override
   (`Learn.tsx`'s `runSearch(text)` already supported this) because setting
   `query` then immediately calling a no-arg `onSearch()` in the same
   synchronous handler would have searched the *previous* query, not the
   just-heard transcript — React state updates aren't visible to a closure
   created before the update lands in the same tick.
   **Flagging the interpretation, not asking permission for it**: this
   session's established pattern (see "friends online," round three) — a
   term with nothing behind it gets a real, honest, buildable
   interpretation shipped and clearly documented, not silently faked and
   not blocked on a question. If "Vocal Practice" was meant to be a bigger
   ongoing spoken conversation with Jesse (closer to the iOS app's real
   `JesseCallSession` voice-call pattern — replies read aloud too, not just
   one-shot speech-to-search), that is a materially bigger build (TTS
   playback, persistent listening state, a different UX entirely) and
   would need to be scoped as its own follow-up, not assumed here.

### Verification (round four)

- `npx tsc --noEmit` clean after each of the four file changes
  (`Learn.tsx`, `EntryStage.tsx`, `HistorySidebar.tsx`,
  `full-graph-viewer.html`), confirming the `HistorySidebar` prop-shrink
  and the `onSearch` signature change didn't break any call site.
- Static style previews (same technique as round three, since `/learn` is
  auth-gated in this environment) for the simplified bottom bar and the
  new chooser card — both read cleanly against the real dark-forest
  palette from `shared.tsx`, not just verified by reading the JSX.
- Traced `backToGraph()`'s full call graph and every piece of state
  `EntryStage`'s render guard depends on before removing the sidebar's
  search input, specifically to rule out creating a dead end — this is
  the one item in this round that would have shipped a real regression if
  skipped.
- `npm run build` (tsc + vite) clean.

## Round five: Fun Lessons becomes a real conversation, Desk OS hero stripped to one object

Two unrelated halves of the same message, both shipped.

### Fun Lessons: a real multi-turn scoping conversation, not a one-shot box

The founder's ask: click Fun Lessons, Jesse asks what you're preparing for
or want to learn, asks real follow-ups, then decides what to show once it
knows enough — not the single "type your topic" reveal from round four.

Built a new backend, `webhook/lib/handlers/learn-scope-agent.ts` (routed
through `app-actions.ts` + `vercel.json`, same Hobby-cap pattern every
other handler here uses — the deployment already sits at exactly 12
functions), mirroring `resume-agent.ts`'s established shape (no auth
required, `callAnthropic → callGemini → callGroq → BYOK` waterfall,
strict-JSON model contract, honest fallback if every provider fails) but
scoped narrowly: the model's ONLY job is turning a few exchanges into a
good search query (`ready`/`searchQuery`), never inventing lesson content
itself. Once `ready` fires, the real handoff is to the exact same
`runSearch()` pipeline everything else on this page already uses — same
discipline as Practice Probe's real-bank-only rule and
discover-internships' honesty filter: the LLM proposes a query, the real
concept library decides what gets taught.

Client: new `app/src/lib/learnScope.ts` (mirrors `learnTutor.ts`'s shape,
no-auth to match the handler), and a new `scope` mode in `EntryStage.tsx`
— a compact conversation card (small scrollback, Jesse/You labeled lines,
one input) that opens on "Fun Lessons," calls the real endpoint each
turn, and hands off to `onSearch(searchQuery)` the moment it's ready.

**Real bug caught by actually running the conversation, not just reading
the code:** a live multi-turn test against the real API reached a 4th
clarifying question before the model called itself ready — a fine
individual answer, but not the hard guarantee "never trap the student in
endless questions" needs (this project's `sanitizeText` and `discover-
internships`'s aggregator-page fix already established that "never dead-
end the user" is a hard requirement here, not a suggestion). Added a
code-side cap: after 3 real student turns, force a handoff on the current
message regardless of what the model wants. Re-ran the same test after
the fix; a second live run actually converged on its own by turn 3 with a
genuinely good query ("quadratic factoring sign errors") — confirms real
model variance run to run, and that the cap is a backstop for the slow
runs, not the common case.

**Also answered, not built:** the founder asked in the same message how
sim (interactive simulation) selection is decided today, floating "voice
sims" as a maybe. Real answer, given directly rather than assumed: sims
are either a fixed pre-built Firestore doc keyed by concept id
(`concept-library-sims/{conceptId}`, only fetched when the concept's own
`hasSim` flag is true), or generated on demand through a real backend
pipeline (`/api/generate-sim`: fit-check, generate, headless render,
structural rubric, vision gate) when no pre-built one exists — no LLM is
involved in the matching step itself, only in generation. "Voice sims"
specifically was not scoped or built this round; flagged back rather than
guessed at.

### Desk OS Workspace hero: the graph is the only thing there now

"No need to have logo / mascot or Jesse is nearby thing or the page under
it — just put that one neat thing." Removed, from `.hub-workspace-object`:
the paper-back-one/two stacked-paper layers, the bookmark ribbon, the
raccoon mascot, the "Jesse is nearby" slip, and the "Open Learn" CTA
button in the copy column beside it (redundant now — clicking the graph
card already launches `/learn`, unchanged). `.hub-workspace-object` and
`.hub-graph-sheet` collapsed into one element: straight (no tilt, this
was "a page in a paper stack," now it's the one object), filling its
whole box edge to edge, sized up (`680×600`, was `620×540`) now that
nothing else needs to share the space. Removed the now-fully-dead
`paintJesse()`/`JESSE_STAGES` growth-stage system from `bootHub.js` (the
slip was its only consumer) and the now-empty `masteryNavs` wiring,
rather than leaving orphaned no-op code behind.

Also: the Resume Helper's Jesse avatar (`.rh-jesse-face`) was showing
`mascot-ivory.png`, an illustrated owl — the founder called it "the
eagle" and asked for "our mascot" instead. Swapped to `raccoon-logo.png`
(confirmed by actually looking at both image files, not guessed from the
filename), and switched `object-fit` from `cover` to `contain` since the
raccoon is a full-body silhouette with real transparent margin, not a
face-cropped portrait like the owl was — `cover` would have zoomed into
one corner of it at this small a size.

### Verification (round five)

- Ran the actual new backend handler locally against the real Anthropic/
  Gemini/Groq waterfall (a small `tsx` harness posting real conversation
  turns), not just a code read — this is what caught the 4-turn
  convergence issue and confirmed the fix, and confirmed a real
  `searchQuery` comes back, not a stub.
- Static style previews (same technique as prior rounds) for the scope
  conversation card, since `/learn` is auth-gated here.
- Real screenshots (this environment can reach Desk OS unauthenticated)
  of the simplified hero at desktop/iPad/phone — zero horizontal overflow
  at any width, confirmed the raccoon-swap renders correctly via the same
  screenshot pass.
- `npx tsc --noEmit` clean on every touched file (webhook and app,
  separately) after each round of edits, not just once at the end.
- `npm run build` (tsc + vite) clean.
