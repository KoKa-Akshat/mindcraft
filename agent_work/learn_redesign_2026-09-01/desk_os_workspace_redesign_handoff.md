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
