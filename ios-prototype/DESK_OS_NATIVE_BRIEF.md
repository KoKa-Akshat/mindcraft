# Desk OS in the native app — agent brief

**Paste this whole file's contents, or point the agent at this file path, at
the start of a new session.** This is a specialized charter, same format as
the web side's `agent_work/product/desk_os/DESK_OS_AGENT_BRIEF.md` (in the
shared `mindcraft` repo) — that format is being reused here on purpose,
because a vague brief is exactly what caused a prior Cursor session to build
against a retired concept and deploy it without permission. Read this whole
file before writing any code.

---

## UPDATE — 2026-08-08 (round 17), read this before the rest of the file

Round 17 Field Desk UX (Akshat live feedback):

1. **Fully immersive** — no window chrome / no left rail.
2. **Floating tool dock** sits right above **Ask MindCraft** (Add / Record /
   Mail / Cal / Search / Repo).
3. **Pannable plane** (~2.2× viewport, drag to move; house button resets).
4. **Connect** — no red margin rule through labels; footer is just
   “Tap a tool”.
5. **Repo + ACT** laid out fully in the home quadrant (not clipped).

---

## UPDATE — 2026-08-08 (round 24)

Field Desk: pannable multi-screen plane again; pages drag to rearrange;
shrunk mascot top-left (connections + intel hub); home resets; Binder big;
intel/memo/calendar titles are tabs so the red rule doesn’t cut text.

---

## UPDATE — 2026-08-08 (round 23)

Welcome screen cleaned up: no “Start your ACT learning book”, no “YOUR ACT
BOOK INCLUDES”. Three feature boxes sit under the tagline; Welcome card with
Continue with Google / Apple is on the page. Sign-in → DeskShell boot
(connection intel slide) → hub dash.

---

## UPDATE — 2026-08-08 (round 25)

**test-instance** is the document→cook learning-product showcase: drop any
PDF / textbook chapter / lecture notes / syllabus → McCreary pipeline cooks
graph + MicroSims + Bloom quiz. Cook studio chips on Tour; Open Labs /
Take Quiz CTAs. Demo seed still uses Official ACT Prep Guide structure.
Hub badge **Doc→Cook**. Later replaces ACT Field Book.

---

## UPDATE — 2026-08-08 (round 22)

**test-instance** (superseded by round 25 for product story) showed what
McCreary’s GitHub does to the Official ACT Prep Guide 2025–2026: source
card → cook steps → learning graph → MicroSim labs → Bloom quiz → pipeline.
Hub badge was **ACT×Sim**.

---

## UPDATE — 2026-08-08 (round 21)

**test-instance** is now the full McCreary showcase product:
Tour · Levels · Graph · Labs · Learn · Quiz · Pipeline.
Open hub card → walk the tour, then Labs / Graph / Quiz.

---

## UPDATE — 2026-08-08 (round 20)

Hub **piano-book** replaced by **test-instance**: McCreary Level-2 slice
(learning graph + live MicroSims from microsims site + Bloom quiz).
Open from hub → Tour / Graph / Labs / Quiz (expanded in round 21).

---

## UPDATE — 2026-08-08 (round 19)

1. Call button = icon only (no “Start your mastery check-in” bubble).
2. **Manage** (was Dashboard) → account: username, billing stub, AgentMail
   key, company whitepaper.
3. **Create an instance** opens upload studio → custom instance on hub.
4. Field Desk is **scrollable**; Ask + tool icons share one bottom row.
5. Mail = **AgentMail** Live Inbox (summaries + suggested replies + send).

**Still open:** full cook pipeline pages, real billing, mounted AI agent
drafting (suggested replies are pattern-based until then), OAuth Gmail.

---

## UPDATE — 2026-08-08 (round 18)

Akshat: hub map should be **writable like the website** (search city/zip;
tutors shuffle up by distance). Workflow market should only show
**Application Tracker** + **Connect health data**, both grayed / coming soon.

1. **Writable Tutors nearby map** — search field + geocode, use-my-location,
   pan/zoom MapKit, distance sort (~250 mi) so the list reshuffles like web
   `filterTutorsForSearch`.
2. **Workflow market** — two grayed cards only (Application Tracker: drop a
   link / resume / CLs / contacts / similar jobs; Health: Whoop + Apple +
   diet / math reports). Buy disabled.

**Still open:** real Application Tracker + Health pipelines, OAuth Connect,
Google Docs chip, true 3× pannable parity, Apple Sign-In, peer Trade.

---

## UPDATE — 2026-08-08 (round 16)

Round 16 adds the **missing design-PDF page 2 / Figma hub surfaces**:

1. **Tutors nearby** on the Desk OS hub — MapKit US map + available-tutor
   list (All / Nearby / Math / ACT / College) + BOOK FREE SESSION (Calendly)
   + Open map → full `FindTutorView`. Roster synced with web (Akshat, Blake,
   Abhigya). *(Round 18 makes the map searchable / distance-sorted.)*
2. **Workflow market** on the hub — initially Gap scan / Mail→Repo / ACT
   nightly; **Round 18 replaces** with Application Tracker + Health insights
   (grayed).
3. **ACT Dashboard Home pads** — Map · Tutors · Market · Work (Market opens
   the same catalog sheet).

---

## UPDATE — 2026-08-08 (round 15)

Round 15 fixes Akshat’s two Field Desk complaints:

1. **Windowed by default** — Open instance is a padded desk *window* (left
   rail + canvas inset + rounded chrome over hub backdrop). **Immerse** is
   the only edge-to-edge fullscreen path.
2. **Connect works inside the instance** — Moodle / Gmail / GCal nest opens
   real guide sheets (steps from web `connectLinks.js`) with Mark as
   connected + Load sample inbox / sample week / Moodle file. Status in
   `deskOs.connect`; calendar/mail samples persist.

Verified via `testFieldDeskFilesNoteIntoBinder` (window + Gmail guide +
file). Rebuild on device to see it.

**Still open:** real OAuth (honest local demos for now), Google Docs chip,
pannable 3× plane, Apple Sign-In, `git pull` every session.

---

## UPDATE — 2026-08-08 (round 14)

Round 14 **polishes** Groq’s Round 12–13 foundation (no rewrite): landscape
Field Desk floating plane, rail-mounted **Immerse** (compact rail + hide Ask
bar + hide status bar — never floats chrome over widgets), warmer ACT field
palette + wider writing column, filing toast/keyboard hardening, raccoon
kept on boot / hub / desk / cover / welcome. Dashboard Map/Tutors/Work pads
stay. Piano still deprioritized.

Verified on device (`id=00008103-0012296E01D0C01E`):
`testFieldDeskFilesNoteIntoBinder`, `testQuestionOneRendersWithRealBankContent`,
`testDiagramQuestionRendersRealBundledImage`, `testDeskHubMasteryGoalAndCheckIn`
**PASSED**. Screenshots:
`MindCraftNotes/screenshots_realdevice_2026-08-08_round14/`.

**Still open:** real Google Docs chip, deeper Connect/OAuth, pannable 3×
plane, Apple Sign-In, `git pull` every session.

---

## UPDATE — 2026-08-08 (round 13)

Round 13 makes **Field Desk Open instance** the real MindCraft desk home
(matching `localhost:5180` / `desk_os`): 88pt left rail (MindCraft, + Add,
Record/Mail/Calendar/Search, Repository) + ivory widgets (connect, intel,
binder, ACT cover, memo, calendar) on dark wallpaper, Ask bar, raccoon on
the plane. ACT cover jumps into ACT Field Book. Raccoon also on boot
transition, hub nav, cover stickers pill, welcome quote. ACT Dashboard home
gains Map / Tutors / Work launch pads. Piano unchanged (deprioritized).

Screenshots: `MindCraftNotes/screenshots_realdevice_2026-08-08_round13/`.
`testFieldDeskFilesNoteIntoBinder` green on device.

**Still open:** real Google Docs chip, deeper Connect/OAuth, pannable 3×
plane, Apple Sign-In, `git pull` every session.

---

## UPDATE — 2026-08-08 (round 12)

Round 12 redesigns the **ACT Field Book practice screen** against the
design PDF *Please Bring Back the Owl Mascot but make it a Racoon*
(Downloads). Full detail in `NATIVE_APP_BUILD_PLAN.md` Round 12.

- **Modular field layout:** labeled floating cards on a soft dot-grid —
  `question.` / conditional `diagram.` / conditional `graph.` / `writing.`
  No empty media boxes when a question has no diagram/graph.
- **Writing is its own box** (Calc / Tutor / Docs strip + PencilKit). Canvas
  no longer overlays choices — fixes Round 10 tap-swallow class of bugs.
- **Raccoon mascot** bundled (`stickers/raccoon-mascot.png`), default
  sticker id `raccoon`, shown in ACT practice nav (`ActRaccoonBadge`).
- Verified on device: question/diagram/practice/graph/drawing tests green;
  screenshots under `MindCraftNotes/screenshots_realdevice_2026-08-08_round12/`.

**Still open (design PDF / product):**
1. Full Field Desk floating-widget home (PDF page 4) — separate from ACT
   practice layout shipped this round.
2. Real Google Docs drop-in for the Docs chip (honest toast for now).
3. Apple Sign-In flip-on (paid membership).
4. `git pull origin main` first thing every session.

---

## UPDATE — 2026-08-08 (round 11)

Round 11 shipped the two remaining Desk OS hub modules as honest minimum
v1 (hub → module, matching the web relationship — not the full 7-brick Desk
OS). Full detail + evidence in `NATIVE_APP_BUILD_PLAN.md`'s "Round 11"
section; short version:

- **Field Desk — DONE and VERIFIED.** Hub card `deskInstance_fieldDesk`
  opens a real Drop → File → Binder → Intel module (`FieldDeskView` +
  `FieldDeskStore`). Heuristic course classify (web `classifyFile`
  stand-in); UserDefaults keys `deskOs.fieldDeskItems` /
  `deskOs.intelLines`; skips persistence under `--ui-testing-in-memory`.
  No OAuth / mail / Connect in this pass. Test
  `testFieldDeskFilesNoteIntoBinder` **PASSED** on device.
- **Piano Field Book — DONE and VERIFIED.** Hub card
  `deskInstance_pianoBook` opens a seed book player
  (`PianoFieldBookView`) from bundled `Resources/pianoSeed.json` (copied
  from web `desk_os/data/pianoSeed.json`). Cover → read → piano drill →
  quiz → done; C4–C5 keyboard; Play phrase / Mark practiced; AVAudioEngine
  tones. Test `testPianoFieldBookOpensSeedAndShowsKeyboard` **PASSED** on
  device (watch SwiftUI parent a11y ids — they swallow `pianoKey_*`).
- **Apple Sign-In — still HARD-BLOCKED** (re-checked this round). Paid
  Apple Developer Program + Xcode Accounts required; entitlement left empty;
  `LoginView.appleSignInEnabled = false`. Implementation stays in place.
- Screenshots (inspected):
  `MindCraftNotes/screenshots_realdevice_2026-08-08_round11/`
  (`field_desk_opened`, `field_desk_after_file`, `piano_book_cover`,
  `piano_book_drill`).

**Still genuinely open:**
1. Apple Sign-In flip-on when paid membership + Xcode account exist (steps
   in `MindCraftNotes.entitlements`), incl. Firebase Apple provider.
2. Deeper Field Desk (real classify LLM, calendar/ICS, pannable home
   sheets) and richer piano (quiz polish, more seeds, studio cook).
3. `git pull origin main` first thing, every session — this repo is
   private under Akshat's own GitHub account, separate from the shared
   `mindcraft` team repo.

---

## UPDATE — 2026-08-08 (round 10, later the same day)

Round 10 closed most of the previous update's open list. Full detail +
evidence in `NATIVE_APP_BUILD_PLAN.md`'s "Round 10" section; short version:

- **Full test-suite verification (previous item 1) — DONE, and it caught a
  real bug.** The consolidated 16-test run exposed that
  `launchDashboardApp()` still dismissed the notebook cover at LAUNCH
  (pre-Brick-1 flow) while the cover now mounts INSIDE the ACT Field Book
  fullScreenCover — every Contents assertion was running with the cover on
  top. Fixed (cover dismissed after the ACT tap). **14/16 tests green on
  the real device** with inspected screenshots
  (`MindCraftNotes/screenshots_realdevice_2026-08-08_round10/`). The two
  stragglers are root-caused with fixes landed but NOT yet re-verified —
  the device's automation session degraded (60s springboard stalls on
  every event + intermittent runner crashes after a mid-run kill).
  **Next session: reboot the iPad, then run these two:**
  `testDiagramQuestionRendersRealBundledImage` (rewritten against an
  audited bank — old target `linear_equations` NEVER serves a diagram
  question inside `session()`'s `.prefix(12)` at any level; new target
  `geometric_transformations`/`eedi_543` is deterministic at every mastery
  level) and `testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome`
  (choice `tap()`s were being swallowed — switched to
  `press(forDuration:)` with bounded retries).
- **Login screen / Apple (previous item 2) — implemented, hard-blocked by
  the account tier, honestly parked.** `AuthService.signInWithApple()` +
  LoginView's "Continue with Apple" are fully built (nonce-hardened
  Firebase flow, web `#authBlock` parity). BUT team `4YV3SZN6P7` is a FREE
  personal team and Apple's portal refuses the Sign in with Apple
  capability for personal teams (verified — the exact error is quoted in
  the build plan). The button is gated off via
  `LoginView.appleSignInEnabled = false`; `MindCraftNotes.entitlements`
  (wired, currently empty) carries the 3-step flip-on instructions for
  when a paid Apple Developer membership lands. Do NOT re-enable without
  that membership — the provisioning failure is immediate and total.
- **Mastery orb / goal-setter / check-in (previous item 4) — DONE and
  VERIFIED.** Full `.hub-mastery-head` + `.hub-orb-row` port in
  `DeskShellView.swift`: greeting, SET GOAL card (`GOALS_BY_KIND`
  verbatim), call button, Canvas-projected wireframe cube (web's exact
  size/tilt/period/perspective numbers), `hubCall.js` check-in sheet, and
  `DeskGoalStore` persisting to the web's exact `deskOs.*` localStorage
  key shapes via UserDefaults. `masteryForInstance()`'s honesty rule kept
  (em-dash until real check-in evidence). New
  `testDeskHubMasteryGoalAndCheckIn` PASSED on device — the three
  screenshots show hub → sheet → live "Mastery 40%" repaint.
  Two flag-gated test accommodations documented in the build plan (cube
  pauses + goal store skips UserDefaults under `--ui-testing-in-memory`).

**(Superseded by Round 11 update above for Field Desk / Piano / Apple.)**

**Closed later the same day (reboot + `636c54d`):** the two remaining
tests are green on device — diagram a11y id was swallowed by a parent
`questionPrompt` wrapper (SVG was rendering); choice rows now use
`contentShape`/`onTapGesture` because SwiftUI `Button` accepted XCUITest
taps without firing; outcome assert accepts saved or failed (real
Keychain session can succeed under skip-auth).

---

## 0. Who you are, and the one rule that matters most

You are the **MindCraft native-app agent**, continuing work in the private
repo `github.com/KoKa-Akshat/mindcraft-ios-prototype` (SwiftUI, real iPad,
`id=00008103-0012296E01D0C01E`). Your job this brief: bring the **Desk OS**
shell concept into the native app, with the existing MindCraft/ACT
experience living inside it as one module — matching what was just built and
shipped on the web side, natively.

**The rule**: verify every claim in this document against the actual current
files before acting on it. This document is a snapshot written at a specific
moment; the code is ground truth if they ever disagree. Do not guess a
layout, color, or behavior — go read the real source (native Swift files,
and the web reference described below) every time.

## 1. Read these first, in this order

1. `NATIVE_APP_BUILD_PLAN.md` (this repo, root) — the full history of this
   native app across 9 rounds. The "🔴 SESSION HANDOFF" banner at the top and
   the last dated "Phase 5 progress, round N" section are your real starting
   context for the app's current state (Dashboard, QuestionView, chapter
   view, the ML engine copy at `ml/`, etc.). **Round 9's work is sitting
   UNCOMMITTED in the working tree right now** — `git status` will show ~11
   modified files plus one new file (`WeeklyReviewWalkthroughView.swift`).
   That work was never build-verified (the last test run hung — 52 minutes
   of wall-clock time, 20 seconds of CPU — and was killed). Your first
   action, before touching Desk OS at all, is exactly what a prior handoff
   already asked for and never got done: **one clean foreground build+test,
   fix or revert what's broken, commit what's solid.** Do not build Desk OS
   features on top of an unverified foundation.
2. `/Users/akoirala/Developer/mindcraft/agent_work/product/desk_os/` (the
   **shared** `mindcraft` repo, not this one) — the real, working reference
   implementation. This is a vanilla JS/HTML web app, now live and
   CI-deployed at `mindcraft-93858.web.app/desk` (and `/desk-os`,
   `/try/desk`). Open it in a real browser and use it before writing any
   Swift — this is your visual and behavioral north star, the same way the
   web app is the north star for every other native screen in this project.
3. `agent_work/product/DESK_OS_AGENT_BRIEF.md` (same shared repo) — the
   original product brief for the web version. Read the "Harvard-case
   reframe" section specifically: it explains WHY the OAuth-connections
   concept (Gmail/Notion/Drive/Moodle login halo) was explicitly retired in
   favor of a local-first upload model. **Do not port the OAuth-connection
   files** (`js/mail.js`, `js/connect.js`, `js/connectGuide.js`,
   `js/connectLinks.js` in the web reference) — those implement the retired
   concept and slipped into the shared repo's merge; they are not part of
   the real product direction. If you're ever unsure whether a piece of the
   web reference is "real current direction" or "retired concept residue,"
   check whether it appears in the Brick table in that brief (§below) — if
   it's not one of the 7 bricks, treat it as suspect and ask rather than
   port it silently.

## 2. What "Desk OS in the native app" concretely means

The web reference implements a desk/shell metaphor: a home surface (the
"desk") where a student's work lives as tangible objects — dropped files,
a calendar, a binder of organized notes — with the **existing MindCraft ACT
experience embedded as one module inside that shell** (on web: an iframe
overlay pointing at `/try/dashboard`, see `agent_work/product/desk_os/js/actBook.js`
in the shared repo for the exact mechanism).

The native equivalent is NOT "build a WKWebView and load the web version" —
that would be a shortcut that doesn't match how the rest of this native app
is built (real SwiftUI screens reading real data, per every prior round's
discipline). The native equivalent is: **a new top-level shell/hub screen
that becomes the app's actual entry point**, with the current
`DashboardView` (Contents/Map/Work/Notes) becoming one reachable module
inside it — the "ACT Field Book" — the same relationship the web version has,
built natively.

## 3. The bricks — same discipline as the web brief: one working, demoed
   piece before starting the next

Do not attempt all of this in one pass. Each brick ends with a real device
screenshot and a working build before you start the next one.

| Brick | What ships | Demo test |
|---|---|---|
| **0. Stabilize round 9** | Round 9's uncommitted work (full-page canvas, landscape bug fix, question bank refresh, Weekly Review walkthrough) builds clean, passes the real XCUITest suite (foreground run, no Monitor/background-wait — that pattern hung and stalled multiple times last session), and is committed with a real round-9 doc entry. | `xcodebuild test` passes (or only the known pre-existing `testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome` baseline failure), real screenshot pulled and inspected. |
| **1. The Desk shell** | A new SwiftUI view — the desk/hub home surface. Read the web reference's `js/home.js` and `js/bootHub.js` for the real layout/behavior (the boot sequence, the desk surface itself). This becomes the new root screen behind `AuthGate`, replacing `DashboardView` as the direct post-login destination. | Fresh launch → real device screenshot shows the desk shell, not the old Dashboard. |
| **2. ACT Field Book module** | The existing `DashboardView` (Contents/Map/Work/Notes, everything built across rounds 1-9) becomes reachable FROM the desk shell as one module/icon — same relationship `actBook.js`'s iframe overlay has on web, built as a real SwiftUI navigation destination (a sheet, a `NavigationStack` push, or a full-screen cover — your call on the exact mechanism, but it must be real navigation to the real, unmodified `DashboardView`, not a rebuild). | Tap the ACT/Field Book icon on the desk shell → the real Dashboard (with real Contents lanes, real progress data) opens. Tap back/close → returns to the desk shell. |
| **3. The Drop (if time allows)** | Per the web brief's Brick 1: drag/pick a file or photo, something (even a stub/manual-tag flow — a real LLM classify call is a stretch goal, not required for this brick) files it into a course-like bucket. Read `js/upload.js`/`js/classify.js` in the web reference for the real behavior to match. | Add a file from the desk shell, see it appear filed somewhere. |
| **4+. Everything else in the 7-brick table** | Binder browsing, calendar (ICS paste), tonight queue, study artifacts, grounded Q&A, map hookup — per the original web brief's own brick table. Only attempt these after 0-3 are real and demoed. | Per the web brief's own demo test for each brick. |

## 4. Explicit "do not do this" list (learned the hard way, this session)

- **Do not deploy/push anything without it being asked for.** The web
  version got shipped to live production hosting without permission, against
  its own brief's explicit rule. This repo is already private/yours — commit
  freely — but do not attempt anything resembling a "ship it live"
  equivalent (there isn't really a native analog beyond App Store
  submission, which is obviously out of scope, but the principle is: don't
  take irreversible/visible actions beyond what's asked).
- **Do not use a Monitor/background-wait pattern on `xcodebuild` runs.**
  This stalled real work at least three times last session — once for over
  50 minutes with a hung process. Run builds/tests in the foreground, read
  the result when the command returns.
- **Do not guess web reference behavior from memory or assumption** — open
  the actual `agent_work/product/desk_os/` files (or the live
  `mindcraft-93858.web.app/desk` site) every time, the same discipline every
  other round of this native app has followed for the Dashboard/Practice/etc.
- **Do not port `mail.js`/`connect.js`/`connectGuide.js`/`connectLinks.js`**
  (the retired OAuth-connections concept) — see §1.3 above.
- **Do not rebuild `DashboardView`/`QuestionView`/etc. from scratch** for
  the Field Book module — reuse what's already real and verified across 9
  rounds. The desk shell is new; the ACT module inside it is not.

## 5. Standing discipline (unchanged from every prior round)

- Real device only — `xcodebuild ... -destination 'id=00008103-0012296E01D0C01E'`,
  never the simulator. Prefix
  `env -u GIT_CONFIG_COUNT -u GIT_CONFIG_KEY_0 -u GIT_CONFIG_VALUE_0` if SPM
  hits the sandboxed-shell `safe.bareRepository` error.
- A green build is never proof of correctness — pull real screenshots
  (`xcrun xcresulttool export attachments --legacy ...`) and look at them.
- Commit real checkpoints often, specific files only (`git add <files>`,
  never blind `-A`). `MyScriptRecognizer.swift` is gitignored (real
  credentials) — never force-add it.
- Append a new dated round section to `NATIVE_APP_BUILD_PLAN.md` as you go.
- `agent_work/product/desk_os/DEMO.md`, `DEMO_HOME.md`, `DEMO_R1.md`,
  `BOOK_PIPELINE.md` (shared repo) document what the web version's bricks
  actually do in practice — useful ground truth alongside the brief itself.
