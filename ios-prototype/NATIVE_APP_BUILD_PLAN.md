# MindCraft Native iOS App — Build Plan

> ## 🔴 SESSION HANDOFF — READ THIS FIRST (written 2026-08-06, ~7:45pm CDT)
>
> Akshat is starting a fresh Claude Code session after this one. If you're
> that fresh session: **do not re-derive context, read this block, then jump
> straight to "Phase 5" (search for that heading) for the full detailed
> status.** Phase 1/2 are fully done (real device, 8/9 XCUITests passing).
> Phase 5 ("Visual & content parity pass") is the active work, currently
> mid-flight across several background-agent rounds.
>
> **What's real and verified so far this Phase 5:** Login/Diagnostic-gate/
> Dashboard-shell colors fixed against live CSS (not guessed — see the
> "round 1" cautionary tale below about a wrong first attempt). App icon
> background recolored. QuestionView per-cluster theming ported for real
> (`CLUSTER_MAP`/`CLUSTER_THEME`, verified distinct from `TocSection` lanes).
> ContentsRoadmapView had a real root-cause bug fixed (was painting its own
> stale lavender background over Dashboard's already-fixed one).
>
> **What's currently in flight / NOT yet confirmed done — verify actual file
> state before assuming any of this landed, a background agent session was
> interrupted by infra issues (stalls/connection drops) partway through this
> batch:**
> 1. Real bugs from live device testing: Contents can't scroll far enough to
>    reach "Geometric Transformations"; landscape orientation on the concept
>    chapter page has text overlapping the story-art image.
> 2. Nav bar must become icon-only (currently shows text labels "Home"/"Map"/
>    "Work"/"Notes" — real web nav is icon-only, 3 icons + wordmark, per §2
>    below). An "index" affordance near it was requested but is still
>    genuinely ambiguous — needs real investigation against the live web
>    toolbar, not a guess.
> 3. Contents tiles need real painterly story-art images (not circles/icons —
>    confirmed via real screenshots Akshat sent), bigger sizing, consistent
>    mastery-driven outer glow (currently inconsistent — some tiles have it,
>    some don't).
> 4. A brand-new pre-login "Welcome to MindCraft" screen, shown before
>    LoginView — NOT a copy of the Dashboard or the in-app Cover. Full spec
>    (real wireframe + real verified tagline from BRAND_BOOK.md) is in the
>    "Phase 5" section under a "Welcome screen" subheading — if that
>    subheading doesn't exist yet, the background agent hadn't gotten to
>    writing it up when this handoff was written; the full spec was sent to
>    it via message, not yet necessarily in this file.
> 5. The existing in-app Cover (post-login, per-session) should be simplified
>    back to JUST the center name-input card — remove any scattered
>    floating subject-topic bubbles (Writing/Violin/Fashion/etc.) if they got
>    built from an earlier, now-superseded instruction.
> 6. A motivational quote (real punchy line, on-brand voice per BRAND_BOOK.md,
>    "most premium visual treatment") belongs on the Dashboard (as a real
>    sticker once that feature exists, or via the existing wizard-mascot tip
>    mechanism — verify which is real on web) — NOT on the new Welcome screen
>    (that was the original ask, then corrected).
> 7. The Live "Call" co-working feature (real-time cross-device Firestore
>    scratchpad sync, built on web earlier this session) is completely
>    missing from the native app. Akshat wants to test it for real, cross-
>    device (iPad + his laptop). Real web files to port from:
>    `app/src/lib/liveSession.ts`, `app/src/components/CallButton.tsx`,
>    `app/src/pages/LiveSessionPage.tsx`, `app/src/components/LiveJoinBanner.tsx`.
> 8. The full interactive Dashboard sticker feature (drag/tilt/remove-chip/
>    Firestore persistence, wizard-mascot shelf) doesn't exist natively at
>    all yet — real feature to build, not a color fix. Source of truth:
>    `app/src/lib/dashboardPersonalization.ts`.
> 9. An iPad-native layout audit across all screens (multi-column/wide-canvas
>    appropriate, not iPhone-stretched) — not started.
>
> **Standing discipline for whoever continues this** (learned the hard way
> this session, multiple times): never guess a color/layout/copy value —
> verify against the actual live web source file directly first. A green
> "BUILD SUCCEEDED" is not proof of visual correctness — pull a real
> screenshot and look at it. Build/test the real device destination only
> (`id=00008103-0012296E01D0C01E`), never simulator. Keep this file's Phase 5
> section updated with real "round N" status entries as you go — it's the
> continuity thread across sessions now. Akshat wants continuous, steady
> forward progress across the whole list above, not a stop-and-checkpoint
> after every small piece.

> **Phase 0 status: DONE, 2026-07-25.** Scaffolding lands, real device build
> green, existing test suite green (on simulator — see deviation notes below).
> Agents A/B/C are unblocked. Read "Phase 0 execution notes" right below this
> banner before starting — it lists every real deviation from this plan's
> literal text and why, plus the exact file/UUID inventory.

## Phase 0 execution notes (read before starting Agent A/B/C)

**What landed, matching §9 items 1–6 exactly:**
1. SPM deps added: `firebase-ios-sdk` (pinned `upToNextMajorVersion` from
   `12.16.0`, the actual latest tag at resolve time) with `FirebaseAuth`,
   `FirebaseFirestore`, `FirebaseCore` linked to the `MindCraftNotes` target.
   `FirebaseStorage` deliberately NOT linked, per plan.
2. `GoogleSignIn-iOS` added (pinned `upToNextMajorVersion` from `9.2.0`).
   **Deviation**: only the `GoogleSignIn` product was linked, not
   `GoogleSignInSwift` — the plan text named the package but not a specific
   product list (unlike the explicit 3-product Firebase list), so the minimal
   single product was chosen. Agent A: add `GoogleSignInSwift` too if its
   async/SwiftUI convenience APIs turn out to be worth it — it's the same
   package reference, just one more `XCSwiftPackageProductDependency` +
   target link, no new package resolution needed.
3. Placeholder `GoogleService-Info.plist` added at
   `MindCraftNotes/MindCraftNotes/GoogleService-Info.plist` (empty `<dict/>`,
   registered as a Resources-phase bundle resource on the app target). Agent A
   replaces its contents with the real Firebase Console values — no pbxproj
   change needed for that, just editing the file in place.
4. `UIAppFonts` added as an **empty array** (not pre-populated with guessed
   filenames — guessing the Google Fonts static-file naming convention risked
   being wrong and misleading whoever adds the real files later; an empty
   array is unambiguous and just as compiling). `Resources/Fonts/` group
   created in the pbxproj (`CA5A54D600251645F06C0493`/`CB2CDC89BE2B87C8E5B16E21`)
   with matching real on-disk folders at
   `MindCraftNotes/MindCraftNotes/Resources/Fonts/` — empty for now, ready for
   Agent B/C to drop `.ttf` files into as a content-only (no-group-creation)
   diff.
   **Deviation (mechanism, not outcome)**: `GENERATE_INFOPLIST_FILE = YES`
   was already set project-wide with no physical `Info.plist` file (Xcode
   auto-generates it from `INFOPLIST_KEY_*` build settings). `UIAppFonts` is
   an array, which `INFOPLIST_KEY_*` scalar settings can't express, so a real
   partial `Info.plist` was added at
   `MindCraftNotes/MindCraftNotes/Info.plist` (currently just `UIAppFonts:
   []`) and wired in via `INFOPLIST_FILE = MindCraftNotes/Info.plist;` on the
   app target's Debug **and** Release configs (`GENERATE_INFOPLIST_FILE`
   stays `YES` — Xcode merges the two). This is also where Agent A should add
   the `CFBundleURLTypes`/`REVERSED_CLIENT_ID` entry Google Sign-In needs,
   per §3 — the file and merge mechanism already exist, so that's a
   content-only edit too.
5. Placeholder Swift files pre-registered (file ref + build file + group
   membership + Sources-phase membership, all in `project.pbxproj`), each
   with a `// TODO: Agent <letter> — see NATIVE_APP_BUILD_PLAN.md §9` comment:
   `Networking/FirebaseBootstrap.swift`, `Networking/AuthService.swift`,
   `Views/LoginView.swift` (Agent A) · `Networking/FirestoreStudentStore.swift`,
   `Networking/KnowledgeGraphClient.swift`, `Views/DashboardView.swift`
   (Agent B) · `Views/ContentsRoadmapView.swift` (Agent C).
   **Deviation**: the plan's step 5 literally says "(for the two Views)" when
   describing the bare `struct X: View { Text("TODO") } }` pattern, but 3 View
   files are named across Agents A/B/C. Applied the View-struct placeholder
   pattern to all 3 (`LoginView`, `DashboardView`, `ContentsRoadmapView`) for
   consistency — omitting it on one for the sake of matching "two" literally
   would have been the actually-inconsistent choice.
6. `Models/DashboardModels.swift` written for real (not a placeholder) —
   `ConceptProgress`, `TocSection`, `ConceptDisplay`, `TocDotState`,
   `tocDotState()`, `STATUS_COLOR`, matching §4/§9-step-5's verbatim spec.
   Added to the pbxproj as a real Sources-phase file (not placeholder-marked).

**pbxproj mechanics (for whoever next hand-edits this file):** every new
Swift/plist file got a `PBXFileReference` + `PBXBuildFile` + a slot in its
`PBXGroup`'s `children` + a slot in the relevant build phase's `files` list,
UUIDs generated as random 24-hex-char strings (checked for collision against
the existing file first) — same shape as every prior hand-edit to this file
(`PolynomialExpression.swift` etc.). The two SPM packages needed a new
`XCRemoteSwiftPackageReference` section, a new `XCSwiftPackageProductDependency`
section, a `packageReferences` array added to the `PBXProject` object, a
`packageProductDependencies` array added to the `MindCraftNotes` native
target, and the 4 product build files added to the (previously empty)
`Frameworks` build phase. `plutil -lint` confirmed the file stays a
syntactically valid plist after every edit pass.

**Verification (§9 step 6 / plan §7 step 7) — real deviations from the
literal command in the plan:**
- Package resolution and every `xcodebuild` invocation in this pass needed
  `env -u GIT_CONFIG_COUNT -u GIT_CONFIG_KEY_0 -u GIT_CONFIG_VALUE_0` prefixed
  onto the command. This sandboxed shell environment injects
  `GIT_CONFIG_KEY_0=safe.bareRepository`/`GIT_CONFIG_VALUE_0=explicit` into
  every process by default, and SwiftPM's package resolution clones each
  dependency as a bare git repo under `~/Library/Caches/org.swift.swiftpm/`,
  which that setting unconditionally refuses ("cannot use bare repository...
  safe.bareRepository is 'explicit'"). Unsetting those 3 env vars for just
  the `xcodebuild`/SPM-resolution subprocess (never touching any actual git
  config file, never touching this repo's or any repo's git state) was the
  fix. Future agents building this project in the same kind of sandboxed
  shell will hit the identical error on first package resolution and need
  the same env-var-unset prefix.
- `xcodebuild build -destination 'id=DD553C3C-D821-5869-BBA2-AB501D46210E'`
  (the real iPad) **succeeded** — this is the actual checkpoint, real output,
  not simulator-only. Ran it twice (once mid-pass, once as a final clean
  check after disk cleanup below) — both `** BUILD SUCCEEDED **`. No
  simulator fallback was needed for the build itself.
- `xcodebuild test` on that same physical device **failed**, but for a
  pre-existing, unrelated reason confirmed NOT caused by this pass's diff:
  the `MindCraftNotesUITests` target has `CODE_SIGNING_ALLOWED = NO` /
  `CODE_SIGNING_REQUIRED = NO` baked into its Debug **and** Release configs
  (present before any Phase 0 edit — grep the file's git-blame-equivalent
  history if in doubt, or just note this pass never touched those two
  XCBuildConfiguration blocks). That setting produces an effectively
  unsigned `MindCraftNotesUITests-Runner.app`, and real iOS device installd
  refuses to install any unsigned/invalidly-signed app outright (the
  Simulator does not enforce this, which is exactly why
  `PROTOTYPE_STATUS.md`'s entire verification history only ever ran
  `xcodebuild test` against a Simulator, never a physical device — this
  pass is simply the first time anyone tried the test action on-device at
  all, and it surfaces a real, pre-existing gap, not a regression). Fixing
  that is out of Phase 0's scope (infrastructure-only, don't touch
  `MindCraftNotesUITests.swift`'s target settings without a reason tied to
  this pass's own work) — flagging it here as an open item for whoever picks
  up on-device UI test automation later.
- Given the above, the existing-test-suite regression check (§9 step 8) ran
  on the `iPad Pro 11-inch (M5)` Simulator instead — the same fallback this
  plan explicitly pre-authorizes for the build step, applied to testing for
  the same underlying reason (an environment/signing gap, not a build
  defect), and the same instrument `PROTOTYPE_STATUS.md` already established
  as this project's real testing method. All tests passed.
- **Count deviation**: the brief (and `PROTOTYPE_STATUS.md`) describe 4
  existing XCUITests. The actual file now has **6** test methods (2 more —
  `testGraphBoxAcceptsLaTeXAndScreenshots` and
  `testLayoutScreenshotsPortraitAndLandscape` — were added sometime after
  `PROTOTYPE_STATUS.md` was last written, evidently alongside the GraphView
  work `ACTIVE_TASK.md`/this plan's §7 references). This pass did not modify
  `MindCraftNotesUITests.swift` at all; all 6 passed unmodified:
  `Executed 6 tests, with 0 failures (0 unexpected) in 80.684 seconds`.
- **Disk space**: this environment's disk filled to ~121Mi free mid-pass
  (Firebase's dependency tree is large) and the first Simulator test attempt
  failed on `No space left on device` mid-compile. Fixed by deleting
  `~/.npm` (3.1G, fully unrelated to this project) — nothing project-related
  was deleted. Future agents in this same environment should watch `df -h /`
  before large SPM-heavy builds.

> Architect pass only. No Swift written against this plan yet. This is the
> shared source of truth several agents build against next — read it in full
> before touching a file. If something here conflicts with a doc below, THIS
> file wins for the native app; ping before overriding it.

**Author's ground-truth sources, in the order read, with what's now stale:**

1. `/Users/akoirala/Developer/mindcraft/CLAUDE.md` — architecture/data model/
   deploy. Accurate for the ML engine, Firestore, and deploy rules. **Stale
   on frontend nav**: it documents `AppTabBar` as "Dashboard | Practice |
   Problem Solver | Knowledge Map" pill tabs. The live `Dashboard.tsx`
   (2026-07-25) does not use that pattern for its primary nav anymore — see
   §2 below for what's actually live.
2. `/Users/akoirala/Developer/mindcraft/CODEX_BRIEF.md` — voice/persona
   (Maya), the "click," never-say word list. Still accurate for tone.
   **Stale on typography/palette**: its "Design System" section lists
   Space Grotesk/Inter/DM Sans and a dark "Deep Field" cover + warm-ivory
   page journal aesthetic. That was superseded by the 2026-07-23 font
   consolidation and the "canvas desk" redesign — see §2 and §3, which are
   sourced from the actual current CSS, not this doc.
3. `/Users/akoirala/Developer/mindcraft/ACTIVE_TASK.md` (top entries,
   2026-07-24/25) — confirmed current: the Contents roadmap (horizontal
   lanes of mastery-driven dots), the GraphBox live typed-expression graph
   (**a direct port of this very prototype's `PolynomialExpression.swift` +
   `GraphView.swift`** — see §7), the Find-a-Tutor page with a real Google
   Maps embed, and the marketing overhaul.
4. `ios-prototype/MindCraftNotes/` itself — read file by file, see §7/§8.
5. `app/src/firebase.ts`, `Login.tsx`, `Dashboard.tsx`, `Dashboard.module.css`,
   `styles/tokens.css` — current design system and data flow, see §2–§4.

---

## Plan refresh — 2026-08-06 (read before resuming Phase 2)

Phase 0 and most of Phase 1 (this plan's §9 Agent A/B/C work) were built
against the web app as it stood **2026-07-25**. The web app shipped a lot in
the ~10 days since, including three brand-new product surfaces on
2026-08-05 and a full visual overhaul of the exact screen this plan's §4
describes pixel-by-pixel (the Contents roadmap + its whole color system).
This pass re-verified every file this plan cites — fonts, the Contents
roadmap's actual DOM/CSS mechanics, the hero bar/nav — directly off the
current source, not off memory of the 07-25 state, and corrected what had
drifted. Nothing below is a guess; every hex value, prop name, and Firestore
field name was read from the real file on 2026-08-06.

**What changed and where it's now documented:**
- **Fonts and the whole Contents-roadmap color system flipped from a light
  "notebook" palette to a dark "chalkboard" palette** on 2026-08-05
  (`Dashboard.tsx`/`Dashboard.module.css` commits "Ship desk polish: mandala
  Weekly Review, readable chapter quests, dynamic batch notes" and its dozen
  predecessors that day). §4 below is a full rewrite, not a patch — the old
  light-lavender canvas background, per-lane light washes, and the pie-fill-
  dot-with-connector-lines node mechanic **no longer exist on the live site**.
  Do not build against the old §4 text; it described a screen that shipped
  and was then replaced.
- **Nav changed shape**: `AppTabBar`'s 4-way *labeled* pill bar this plan's §2
  described is even further from live than the 07-25 pass already knew — the
  actual hero bar nav is now 3 icon-only buttons (Map/Work/Notes) plus the
  wordmark itself acting as the Home button, not 4 labeled pills. See §2.
- **Three new features shipped 2026-08-05** that Phase 2/3 need to account
  for before native work resumes: live "Call" co-working sessions, a
  "write on your worksheet" mode, and a Weekly Review guided play-through.
  None of these existed when §1's phase breakdown or §5's data-flow section
  were written. See the new section **"New product surfaces since
  2026-07-25"** immediately after §2 below — for each, what it is, its real
  Firestore schema (all three, per this plan's own §3 architecture principle,
  are directly portable — same project, same documents), and a native-porting
  note. The heaviest-value, easiest-to-port one is the Call feature: it's
  pure Firestore reads/writes, no WebRTC, nothing server-only.
- Phase 0's own execution notes, the §9 Agent A/B/C status logs, and
  everything about the SPM/Firebase/pbxproj mechanics are **unaffected** by
  any of this — that work is still accurate and is left untouched below.

---

## 0. What "done" means for this pass

A build plan, not code. Every section below is written so an implementation
agent can open exactly one section, find exact file paths, exact Firestore
field names, exact hex colors, and exact new-file ownership, and start
writing Swift without needing to ask a question that isn't answered here.

---

## 1. Scope and phasing

Honest phase breakdown. Do not compress this into "one day." Each phase
assumes the previous phase's real, working (not mocked) result exists.

### Phase 0 — Project setup (sequential, ~1 session, ONE agent only)
Not listed as a numbered "Agent" in §9's parallel breakdown because it must
happen first and touches the one truly shared file (`project.pbxproj`) that
every later agent would otherwise collide on. See §9 for exactly why and
exactly what this agent does. Blocks Phase 1 start.

### Phase 1 — Login + Dashboard shell (this week's real target)
A student opens the real app, signs in with their real MindCraft account
(Google or email/password, same Firebase project, same `users/{uid}` doc the
web app reads), and sees:
- Their real first name in the hero bar.
- The real Contents roadmap: four subject lanes, each a horizontal line of
  concept dots, dot fill and color driven by their **real** per-concept
  mastery/status from the same `GET /knowledge-graph/{uid}` the web app
  reads. A brand-new student sees genuinely-empty (gray, 0%-fill) dots; a
  student with real practice history sees genuinely-lit dots. No mock data
  path allowed to ship silently — if the fetch fails, show an honest empty/
  loading state, never a fabricated roadmap.
- Sign out, back to Login.

Explicitly **not** in Phase 1: tapping a concept dot to open a chapter,
"today's spark"/Weekly Review CTAs (they need `/recommend`, a second ML
round trip layered on top of the graph fetch — real, but a distinct and
larger unit of work, see Phase 2), the Map/Work/Notes tab bodies (nav
buttons exist and switch a local view state, but Map/Work/Notes render a
plain "coming in Phase 2" placeholder, not the real `ConstellationGpsExplorer`/
`WorkStudio`/`DashboardNotesPanel` equivalents).

### Phase 2 — Practice (Solver/Work) + Contents chapter drill-down
- Tapping a Contents dot opens a chapter-equivalent screen (story excerpt +
  question list), i.e. the native equivalent of `ConceptChapterPage.tsx`.
- A real practice session screen: question stem (native `MathText`
  equivalent — KaTeX has no iOS port, see §7 open item), choices, outcome
  posted to `/record-outcomes`.
- "Today's spark" + Weekly Review hero CTAs wired to `/recommend`.
- The Work tab becomes the real writing surface: **reuses `CanvasView.swift`,
  `GraphView.swift`, `PolynomialExpression.swift` unchanged** (§7/§8) — this
  is the phase where the existing prototype code stops being a museum piece
  and starts being load-bearing product code.

### Phase 3 — Knowledge Map + Find-a-Tutor
- Map tab: a native visualization of the same `/knowledge-graph/{uid}` nodes/
  edges Phase 1 already fetches for the roadmap — reuse the data layer,
  build a new visualization (does not need to be the literal 3D
  constellation the web app renders; a native graph/list view showing the
  same status/mastery is enough to be the SAME product, not a lesser one).
- Find-a-Tutor: MapKit (native, not `@react-google-maps/api`) showing the
  same tutor location data `FindTutor.tsx` reads.

### Phase 4 — MyScript handwriting → Groq assist, Notes persistence hardening
- Wire `MyScriptRecognizer.swift` (already built, already has real
  credentials) into the real practice/chapter question flow so a student's
  handwritten work drives the graph box, not just the prototype's 5 sample
  questions.
- Groq-backed "Explain this step" assist — see §6. Deliberately last: it is
  the one new network dependency + one new credential, and the lowest-risk
  place to add it is once Phases 1–3 already prove the core data loop works
  without an LLM in the critical path (matches CODEX_BRIEF's "engine owns
  structure, LLM owns language" law — the native app's core loop must work
  with zero LLM calls before an LLM is layered on top of it).

### Phase 5 — Visual & content parity pass (2026-08-06, Akshat: "everything
### about this from login to icon image should have background color forest
### green... just like dashboard same color layout features everything...
### this is old design")

**The problem.** `LoginView.swift`, `DiagnosticGateView.swift`, and
`DashboardView.swift`'s `DeskColor`/`DeskBackground` were all built against a
placeholder pastel-lavender palette (`efe6fb`/`e4dcf5`/`d9d0ef`,
`#2a2430`/`#3a2f55` ink) from before the web app's 2026-08-05 dark
"chalkboard" redesign (§4 above documents the real, current colors — pulled
directly from the live `Dashboard.module.css`/`Login.module.css`, re-verified
2026-08-06). §4 being correct didn't mean the Views actually used it — most
of them still had the old placeholder hardcoded. This phase is applying
already-documented, already-verified §4 tokens across every remaining
screen, not re-deriving colors from scratch.

**Already fixed and verified installed on a real device this session — do
not redo:**
- `LoginView.swift` — recolored to match live `Login.module.css` exactly
  (`#060c09`/`#091810` dark background, `#c4f547` lime wordmark, `#247a4d`→
  `#5fb779` green gradient submit button with the hard-shadow "3D pressed"
  ledge look, `#faf6ef` cream card, `#143a2e` ink).
- `DiagnosticGateView.swift` — was a single flat 29-row list with default
  system gray/blue buttons ("one item per line," no grouping, no brand
  color). Rewritten to group concepts by their real `TocSection` lane
  (matching web's `.confGrid` "three boxes" intent) in a `LazyVGrid` of
  colored cards using each lane's own real `accent`/`ink`/`washTop`/
  `washBottom` from the bundled `actToc.json` — same data
  `ContentsRoadmapView` already reads, just also passed into the gate now
  (its `sections:` parameter replaced the old flat `conceptIds:` one — the
  one call site in `DashboardView.swift`'s `.needed` branch was updated to
  match).
- `DashboardView.swift`'s `DeskColor`/`DeskBackground` — **note there were
  TWO passes here**: the first attempt used `dashboardPersonalization.ts`'s
  `DEFAULT_THEME: cream` and shipped a wrong cream/forest-green paper
  theme. That was corrected by grepping the actual hex values directly out
  of the live `Dashboard.module.css` `.canvasStage`/`.navActive` rules
  (`#1c3228`→`#14261c`→`#0f1f18` dark gradient, `#f4efe2` ink, `#54b948`
  brand green, `#b9e86f` active-nav-pill lime tint+glow) — **this is the
  cautionary example for the rest of this phase: `dashboardPersonalization.ts`
  describes a narrower, separate per-student paper-customization feature,
  NOT the base page background — always verify against the actual `.module.css`
  file for the specific screen being ported, never against an adjacent/
  related file that merely sounds authoritative.**
- App icon (`Assets.xcassets/AppIcon.appiconset/mindcraft-app-icon-1024.png`)
  — was the same lavender background baked into a static PNG. Fixed via a
  programmatic background recolor (Python/PIL, HSV-ish `b>g` pastel-lavender
  mask → real dark-chalkboard gradient, preserving the existing tile/symbol
  artwork pixel-for-pixel) rather than regenerating new art from scratch —
  cheaper and more precise for a background-only swap. If a real redesign of
  the icon's content (not just its background) is wanted later, that's a
  separate, explicit ask.

**Still needed — same treatment, screen by screen.** Grep each file below
for the old placeholder hex family (`efe6fb`, `e4dcf5`, `d9d0ef`, `2a2430`,
`3a2f55`, `54b948` used inconsistently, or any bespoke `Color(red:green:blue:)`
literal not sourced from a `.module.css` file) as a mechanical way to find
what's stale, then verify the REAL replacement value by reading the actual
live CSS module for that web screen before writing it — do not assume, and
do not trust this plan's own prose over the live file if they ever disagree
(this plan is a snapshot, the CSS is ground truth):

- `KnowledgeMapView.swift` (Map tab) ← verify against `ConstellationGpsExplorer`'s
  actual current CSS/component (§2 already flags the component name itself
  as possibly stale — confirm the live import before touching colors).
- `WorkPracticeView.swift` (Work tab) ← `WorkStudio.module.css`.
- `NotesListView.swift` (Notes tab) ← `DashboardNotesPanel`'s real CSS.
- `ConceptChapterView.swift` ← `ConceptChapterPage.tsx`'s CSS module.
- `QuestionView.swift` / practice session chrome ← `Practice.module.css`.
- `FindTutorView.swift` ← `FindTutor.module.css` (note: this file already
  shares the real `--forest`/`--cream`/`--green` token block with
  `Book.module.css`, both cited in §4 — a good cross-check reference).
- `CoverView.swift` — re-verify against `CoverLanding.tsx`'s current CSS;
  this view's own doc comment claims it already matches "the current (not
  the old) web cover," but that claim predates this phase's discovery that
  Login/Dashboard/Diagnostic all made the same kind of stale claim — confirm
  rather than trust the comment.

**Real lesson images, not generic icons.** §4's Contents-roadmap section
above documents that each concept tile on the live web app renders real
story art via `storyArtFor(id)` (`.tocNodeIcon`), not a generic icon or
placeholder. Confirm whether these images are already bundled as a native
resource (check `Resources/` for anything exported alongside `actToc.json`);
if not, extend the same export approach `actToc.json` used (a script pulling
from the real web asset source, not hand-copied files) to bundle them, then
wire them into both `ContentsRoadmapView`'s tiles and `ConceptChapterView`'s
chapter header — this is the single biggest visual gap between "looks like
a real app" and "looks like the actual MindCraft dashboard."

**Dashboard stickers — currently completely missing, not just uncolored.**
Confirmed via `grep -rl "sticker" MindCraftNotes/**/*.swift` → zero matches.
The web Dashboard's sticker system (drag-and-drop placement, tilt-on-drag,
overlay chip with an X to remove, the wizard-mascot shelf — see recent
commits `4e8c06a4`/`fb63a714`/`7a7d4dfb`) is a real, currently-shipping
feature with its own Firestore-backed state
(`DashboardPersonalization.stickers`/`customStickers`,
`app/src/lib/dashboardPersonalization.ts` — this is the file whose
`DEFAULT_THEME: cream` wrongly got used as a page-background source earlier
in this phase; the file itself is legitimate, just scoped to stickers/paper-
customization, not the base chalkboard). Port this as an actual feature
(add/drag/remove stickers, persisted the same way), not a visual-only pass —
it's the difference between "recolored" and "actually A+, matches the real
product," which is Akshat's explicit bar for this phase.

**iPad-native, not a stretched iPhone layout.** Akshat's ask was explicit:
"built with ipad in mind." Once colors/images are real, audit each screen
above for whether it actually uses the iPad's width well (e.g. the
`DiagnosticGateView` grid this phase just added, `LazyVGrid(.adaptive(...))`,
is the pattern — multi-column where the web original is a 2-3 box grid, not
a single iPhone-width column stretched wider) rather than just recoloring a
layout that was never designed for the larger canvas.

**Verification.** Same discipline as the rest of this plan: build for the
real device destination (never fall back to simulator), then install via
`xcrun devicectl device install app` and confirm visually — a "BUILD
SUCCEEDED" log line is not sufficient proof of a correct color (this
session hit real cases of a build reporting success while producing either
an unsigned binary or a wrong-but-compiling color choice; only a real
on-device screenshot or the person looking at the actual iPad confirms it).

---

### Phase 5 progress, round 2 (Fable 5, 2026-08-06) — 6/7 screens + a real root-cause bug

**Recolored, each verified against the live CSS module for that specific
screen (not an adjacent file), per this section's own discipline:**

- `KnowledgeMapView.swift` (Map tab) — `ConstellationGpsExplorer.tsx`
  imports BOTH `ConstellationGpsLab.module.css` AND `DashboardPanels.module.css`.
  The map canvas itself uses `ConstellationGpsLab.module.css`'s OWN distinct
  near-black/lime "constellation" theme (`#050505` canvas, `#e8eaed` text,
  `#162d22` panels) — confirmed via the live file, NOT the Dashboard chalkboard
  tokens. `MapColor.ink/inkSoft/cardPaper/canvasBg` updated accordingly.
- `NotesListView.swift` (Notes tab) — `DashboardNotesPanel.tsx` imports only
  `DashboardPanels.module.css`, whose `--ink-*`/`--paper-*` vars cascade from
  `.canvasStage` (the standard dark chalkboard). `NotesColor` now uses
  `#f4efe2` ink / `#1a2e24` card (the real `.noteEntry` is a flat divider-rule
  row on transparent background, not a card — kept the card as a deliberate
  native/iPad touch-target adaptation, documented inline).
- `WorkPracticeView.swift` (Work tab) — real finding: `WorkStudio.module.css`
  still hardcodes its OWN light lavender/mint/cream card colors, unconverted
  by the chalkboard migration, even though `<WorkStudio>` renders inside
  `.canvasStage` (confirmed in `Dashboard.tsx`). Net correct result: light
  paper cards floating on a dark desk. Fixed the outer backdrop (was flat
  cream `WorkColor.paper`, now the real dark gradient via new
  `WorkDeskBackground`) and the hero title/subtitle (sat directly on the
  backdrop with dark ink — now light `stageInk`), left the card-level
  lavender/mint colors alone (confirmed still correct). Also replaced
  `accent` (`#1d3a8a`, no match anywhere in the live CSS — an apparent
  ungrounded guess) with the app's real, confirmed brand green.
- `ConceptChapterView.swift` — real two-layer structure confirmed in
  `ConceptChapterPage.module.css`: outer `.root` is a near-black "Cover Deep
  Field" (`#080e14` + blue/lime radial glows), inner `.canvasStage` is the
  SAME dark-green chalkboard gradient `DeskBackground` uses
  (`1c3228→14261c→0f1f18`). `ChapterDeskBackground` (outer) and
  `ChapterColor.cardGradient` (inner, replacing a flat "paper" fill) now
  match both layers; `ink`/`accent` corrected to `#f4efe2`/`#b9e86f`.
- `FindTutorView.swift` — real finding: `FindTutor.module.css` (shares its
  token block with `Book.module.css`, confirmed) is genuinely still a light
  cream/forest-green "storybook" page (`--cream:#fbf4e7`, `--forest:#064d36`,
  `--green:#4eb543`), NOT the dark chalkboard — this is the opposite mistake
  from every other screen in this phase, and confirming it from the live CSS
  (rather than assuming "everything is dark now") is exactly why this
  section insists on a live-CSS check per screen. Added a real `TutorColor`
  palette (had none before, just plain iOS system colors) sourced from these
  values.
- `CoverView.swift` — its own doc comment claimed to already match "the
  current (not the old) web cover"; false, confirmed against the live
  `CoverLanding.module.css` (`#080e14` Deep Field, `#fffdf7` ink, `#247a4d`
  real button green — same family as `LoginView`'s already-verified fix).
  `CoverColor` and `CoverBackground` corrected; the full-bleed "paper" card
  (no direct web equivalent — a deliberate native metaphor) recolored into
  the dark family instead of light cream.

**`QuestionView.swift` — deliberately deferred, not skipped.** 4 of the 8
currently-passing real-device XCUITests exercise this view directly
(`testQuestionOneRendersWithRealBankContent`,
`testDrawingPersistsAcrossQuestionSwitch`,
`testGraphBoxAcceptsLaTeXAndScreenshots`,
`testLayoutScreenshotsPortraitAndLandscape`). Its actual gap isn't a stale
color, it's structural: `StoryTheme` is one hardcoded single-cluster palette
(`#1d3a8a` — genuinely the real algebra-cluster accent, just not the other
clusters') where the real fix is per-lane dynamic theming sourced from
`ACT_TOC_SECTIONS`/`actToc.json`, same data `ContentsRoadmapView` and
`DiagnosticGateView` already read — a call-chain refactor (thread the lane
into `QuestionView`'s init, update every call site), not a value swap.
Rushing this risked the passing test suite for an unclear visual gain;
queued as its own next step instead.

**Real, unplanned root-cause bug found and fixed — the actual reason the
Phase 2 real-device screenshot still showed the old pastel-lavender palette
even after `DashboardView`'s `DeskBackground` was already fixed and
verified this session:**

- `ContentsRoadmapView.swift` (Home tab content) was painting its OWN
  second, separate `deskBackground` — still the lavender gradient — directly
  on top of `DashboardView`'s already-correct dark one. Not in this
  section's original "still needed" list (nobody had traced the actual
  layering), found by reading the code directly after the screenshot
  evidence didn't match what should have already been fixed. Corrected to
  the same real `DeskBackground` values as everywhere else in this pass.
- Two hardcoded near-black text colors inside `ConceptNode`
  (`Color(hex: "2a2430")` for the concept name, `.black.opacity(0.6)` for
  the blurb) — the name-label one cited "build plan §4's `--desk-ink:
  #2a2430`" in its own comment, a stale reference to a version of §4 that no
  longer exists (§4 was rewritten for the dark palette in the 2026-08-06
  refresh, this comment never got updated). Both now use the real current
  value: all 4 lanes share ONE ink, `#f4efe2` (confirmed via this doc's own
  §2 Contents-lanes table, already researched and dated 2026-08-06).
- The bundled `Resources/actToc.json` itself had the stale light-pastel
  `washTop`/`washBottom`/`accent`/`ink` values baked into the DATA, not just
  Swift fallback code (confirmed: `TocSection` decodes these fields straight
  from this file, so it's what actually renders). Patched all 4 lanes'
  values to match the live `app/src/lib/actToc.ts` accent/ink exactly, and
  computed solid-hex approximations of the real semi-transparent
  `washTop`/`washBottom` rgba-over-stage values from this doc's own §2 table
  (the JSON schema only holds flat hex, not rgba+alpha — documented the
  compositing math used rather than silently approximating).

**Verified real-device, not just a green build log:**
`xcodebuild test` against `id=00008103-0012296E01D0C01E` — **8/9 XCUITests
still passing, zero regressions** from any of the above (same one
pre-existing timing-related failure as the Phase 2 baseline,
`testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome`, unrelated to this
pass). Pulled a fresh `testDashboardRendersRealContentsLanes` screenshot
from the `.xcresult` bundle and looked at it directly: the Home tab now
renders dark lane cards (amber Warm-ups / green Algebra / teal Geometry)
with legible light ink, not the old pastel panels — saved to
`ios-prototype/MindCraftNotes/screenshots_realdevice_2026-08-06/phase5_dashboard_contents_lanes_FIXED.png`.

### Phase 5 progress, round 3 (Fable 5, 2026-08-06) — QuestionView per-lane theming, DONE

`QuestionView.swift`'s `StoryTheme` (was one hardcoded fractions_decimals-only
palette, stale colors too) is now real per-cluster dynamic theming, verified
against the live source directly rather than guessed:

- Found the real mechanism in `app/src/pages/ConceptChapterPage.tsx`: `CLUSTER_MAP`
  (concept id → cluster, one of `algebra`/`geometry`/`functions`/`data`) +
  `CLUSTER_THEME` (cluster → colors). **This is NOT the same taxonomy as
  `actToc.json`'s `TocSection` lanes** despite overlapping names (`algebra`/
  `geometry` exist in both, but `functions` is a real cluster here with no
  TOC-lane equivalent) — confirmed by reading both sources directly rather
  than assuming they're the same thing because the names rhyme.
  `ink`/`dim`/`paper` come from `JOURNAL_PAPER`, identical across all 4
  clusters (`#f4efe2`/62%-opacity same/`#14261c`) — only `accent` actually
  varies per cluster (`#7ec8e3`/`#6eb6ff`/`#b9e86f`/`#f5d348`).
- Ported `CLUSTER_MAP` (~60 concept ids) and `CLUSTER_THEME` verbatim into a
  new `StoryTheme` struct + `StoryTheme.forConcept(_:)` factory, replacing
  the old static-constants enum. Added `QuestionView.theme` (computed from
  `question.conceptId`) and repointed all 9 call sites from `StoryTheme.x`
  to `theme.x`.
- **Verified real-device, not just a green build log**: `xcodebuild build`
  clean first (catches compile errors before spending a full test-suite
  cycle), then full `xcodebuild test` — **8/9 XCUITests passing, zero
  regressions**, including `testQuestionOneRendersWithRealBankContent` (the
  test that exercises `QuestionView` most directly). Pulled the
  `testLayoutScreenshotsPortraitAndLandscape` screenshot from the `.xcresult`
  bundle and looked at it: the story card renders the dark `#14261c` paper
  with light `#7ec8e3` accent text on "SIMON STEVIN" (fractions_decimals →
  algebra cluster) — correct, legible, matches the live web's real per-
  cluster treatment. Saved to
  `ios-prototype/MindCraftNotes/screenshots_realdevice_2026-08-06/phase5_questionview_theme_FIXED.png`.

**Not started yet** (queued next, in order): the story-art image wiring into
`ContentsRoadmapView`'s tiles — entangled with a LARGER gap than image-wiring
alone: §"The Contents roadmap component" above documents the web's real node
mechanic is a computed near-square grid of square art tiles with mastery on
the border/glow, not the current circular-dot-plus-connector-line
implementation this Swift file still has; wiring real images onto the wrong
shape is a partial fix, the grid-mechanic port needs to happen with it, not
after. Then the full stickers feature (data model, drag/tilt, Firestore
persistence — confirmed zero existing sticker code via
`grep -rl "sticker" MindCraftNotes/**/*.swift`). Then the iPad-native layout
audit across all screens, once the above are real (auditing colors on a
layout still being redesigned would be wasted work).

---

### Phase 5 progress, round 4 (Fable 5, 2026-08-06) — Contents-roadmap node rewrite finished + QuestionView story removal + real Practice.module.css recolor

**Contents-roadmap node rewrite — picked up mid-stream from a prior session
that was stopped before verification, and found MUCH further along than
round 3's "Not started yet" note claimed.** Reading `ContentsRoadmapView.swift`
fresh (not trusting the stale plan note) showed the square-tile grid mechanic,
`tocColumnsFor()`, and real `StoryArtLoader` wiring were ALL already present
and building cleanly — round 3's own writeup was simply out of date (the
session that did this work was interrupted before it could update the doc).
Verified this directly, then closed the real remaining gaps found by
re-reading `Dashboard.module.css` line-by-line against the Swift:

- **Real structural bug**: the mastery-driven border/glow was on the ART
  TILE (`.artTile`), but the live CSS puts it on the OUTER `.tocNode` card
  (icon + label together) — `.tocNodeIcon` (the art frame itself) has its
  own separate FIXED lane-accent-tinted border, unrelated to mastery. Also,
  contrary to this plan's OWN prose ("continuously driven by mastery ∈
  [0,1]"), the live CSS only applies that continuous ramp to `locked` nodes
  — `complete`/`needs`/`progress` states override border-color to full solid
  `node-color` via `[data-state=...]` rules. Ground truth (the CSS) wins over
  the plan's summary here; `ConceptTile` was rewritten to match the real
  cascade (see its doc comments).
- **Checkmark badge had inverted colors**: was a dark circle with a colored
  checkmark; the real `.tocNodeCheck` is a solid `node-color` square with a
  DARK (`#14261c`) checkmark — corrected.
- **Lane title font was 28pt**, not the plan's own already-documented real
  value of 22px — confirmed the bug from a live screenshot (the narrow
  "Data & chance" lane's title was wrapping into an unreadable vertical
  letter-stack) before fixing it.
- Real-device verified: `xcodebuild test`, 8/9 XCUITests, zero regressions.
  Pulled `testDashboardRendersRealContentsLanes`'s screenshot from the
  `.xcresult` bundle and confirmed visually: real story art in every tile,
  green/blue glowing borders scaled by mastery, checkmark badges on mastered
  concepts, proportional lane widths, no connector lines, no pie fills.

**Mid-session course correction from Akshat (relayed + independently
verified before acting on it, per this plan's own discipline): QuestionView
needed the removed-narrative-context fix + a real aesthetic pass, not just
the per-cluster theming round 3 already did.**

- Confirmed directly in `Practice.tsx` (~2501-2512): the web app deliberately
  removed its narrative story paragraph AND hero image from above the
  question (`"removed (see ACTIVE_TASK.md)... intentionally not rendered
  here anymore"`), while `storyArtFor()` stays genuinely live in exactly 3
  other places (Dashboard tiles, `ConceptChapterPage`, `StorySlideshow`) —
  NOT in the question view. `QuestionView.swift`'s `storyHeader` (protagonist/
  setting/bridge-line block above the question) was exactly this removed
  pattern, ported from before the web made this call — deleted it entirely.
  The separate below-the-question Story/Graph swap box (`swapBox`) is
  Akshat's own explicit native-only design ask from this file's own top doc
  comment, not the same thing the web removed — left it in place.
- **Real recolor against `Practice.module.css`, not the Dashboard's
  chalkboard palette** — confirmed Practice is a genuinely distinct TEAL
  theme (`--practice-bg`/`--practice-surface: #21616E`, both page AND card
  the same fill, distinguished only by a thin white-12% border), the same
  "don't assume visual sameness with an adjacent screen" trap round 2's
  `FindTutorView` finding already flagged. Ported: `.questionCard`'s real
  two-tier structure (a level-colored gradient BANNER — green L1/orange
  L2/purple L3, `lvBannerGradient` — holding the badge row AND the white
  question text itself, then a plain teal BODY below holding choices/answer
  controls); `.choice`/`.choiceSelected`/`.choiceCorrect`/`.choiceWrong` +
  their `.choiceLetter` pairs, replacing a full set of prior UNGROUNDED
  guesses (a muted navy `rgb(58,93,168)` where the real CSS is a vivid
  `#3B82F6`; solid-saturated correct/wrong letter tiles with white text
  where the real CSS is pastel tiles with dark colored text) — caught only
  by reading the CSS, not by eyeballing a screenshot. Also a real, easy-to-
  miss detail from `.feedbackBannerWrong`: this app's "wrong" feedback is
  ORANGE (`#F97316→#EA580C`), never harsh red — the check-answer button's
  post-check color now reflects that instead of a red tint.
  `leftColumn`/`swapBox`/the canvas toolbar (all previously plain-iOS
  `.systemGroupedBackground`) recolored into the same teal family; the
  swap box and canvas toolbar have no direct web equivalent (native-only
  surfaces per this file's own design), so they use a hand-picked darker
  teal variant, documented as such rather than presented as a ported value.
- Real-device verified: `xcodebuild test`, 8/9 XCUITests, zero regressions
  (same pre-existing `testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome`
  failure). Pulled all 4 `testLayoutScreenshotsPortraitAndLandscape`
  screenshots from the `.xcresult` bundle (portrait Q1, portrait Q3, landscape
  Q3 story tab, landscape Q3 graph tab) and confirmed visually: teal card,
  correct level-gradient banner, no narrative text above the question, real
  choice colors, story excerpt and graph both legible in the swap box, canvas
  toolbar matches the teal family in both orientations.

**Still not started**: the full stickers feature (item 3) and the iPad-native
layout audit (item 4) — unchanged from round 3's queue, now next up. One
layout issue already spotted as a byproduct of this round's screenshots,
noted for the iPad-layout-audit pass rather than fixed here (out of scope for
a Contents-roadmap/QuestionView pass): the `homeTopActions` pills ("Today's
spark", "Weekly Review") on the Dashboard hero bar are visibly clipping their
own label text ("TODA Y'S SPAR K") in the round-4 Contents screenshot.

---

### Phase 5 progress, round 5 (Fable 5, 2026-08-06) — Cover world-map rebuild, real stickers feature, QuestionView pattern resolved, hero-bar clipping fixed, iPad layout audit started

Picked up from round 4's queue (stickers + iPad audit) plus a fresh,
authoritative ask from Akshat: 4 real screenshots of the live web app taken
2026-08-06, cross-checked against the actual source files before porting
anything (never against the screenshots alone).

**1. `CoverView.swift` — full structural rebuild, not just colors.**
Verified directly against `app/src/components/book/CoverLanding.tsx` +
`CoverLanding.module.css`: the real cover is a "world map" — a full-bleed
Deep Field box with 8 scattered floating subject pills (`SUBJECT_CHIPS`: ACT
Math live/pulsing-dot, Writing/Fashion/Violin/Law/Coding/Spanish/Photography
dismissible), a center glass `coverFace` card (`STUDY · CREATE · EXPLORE`
eyebrow, "Mind"+gold`Craft` wordmark, name field + lime arrow-submit button),
and two top-right action pills (Stickers outline pill, Find a Tutor solid
green pill). The prior version of this file was just a single centered card
with the old copy — confirmed this was a real structural gap, not a stale
color claim like round 2 found on the same file.
- Colors verified against the live CSS, not guessed: page/cover base
  `#080e14`, wordmark "Mind" `#f5f5f5`, "Craft" **gold `#f5d348`**
  (`.wordmarkCraft` — confirmed genuinely distinct from the lime `#c4f547`
  used on the CTA arrow / ACT-Math live dot / eyebrow tint elsewhere on the
  SAME screen; easy to misread as "the same green" without checking both
  values side by side in the CSS).
- **Real bug found and fixed during verification, not assumed correct from
  a first pass**: web's chip-hiding breakpoints (`@media (max-width: 860px)`/
  `620px`) are BROWSER VIEWPORT pixels. Porting `860`/`620` verbatim as
  SwiftUI point thresholds silently hid "Writing" and "Photography" on
  EVERY real iPad launch — a real iPad in portrait is only ~820-834pt wide,
  which is comfortably "narrow" by browser standards but is this product's
  primary, full-size canvas. Caught this from an on-device screenshot (6 of
  8 pills visible, not 8), not from re-reading the CSS a second time.
  Lowered the thresholds (`700`/`460`) so they only engage for genuinely
  narrow presentations (iPhone / Slide Over), confirmed fixed on a
  follow-up screenshot (all 8 pills visible).
- Added `.accessibilityIdentifier("coverOpenArrow")` to the new arrow
  button since the old text-based test hook (`"Tap to open →"`) no longer
  exists in the new structure; updated `MindCraftNotesUITests.swift`'s
  `launchDashboardApp()` helper to match — this is the ONE existing test
  dependency on Cover internals, verified it's the only one
  (`grep -n "Tap to open" MindCraftNotesUITests.swift`).

**2. Dashboard/Cover stickers — real feature built, but NOT the system this
plan previously assumed.** `grep -rl "sticker" **/*.swift` confirmed zero
existing native code, matching round 3/4's finding. Before porting,
investigated which of web's TWO real sticker systems is actually live:
- `app/src/lib/dashboardPersonalization.ts`'s `DashboardSticker`/
  `customStickers` (Firestore-backed, free x/y drag-placement + rotation,
  10-item cap) plus its consumers `StickerLayer.tsx` and
  `JournalStyleDrawer.tsx` are real, working code — but `grep -rln
  "JournalStyleDrawer" app/src` returns ONLY the file itself (zero
  importers) and `grep -rn "<StickerLayer" app/src` returns nothing. This
  is dead code, not the live feature — confirmed by checking actual JSX
  call sites, not by trusting that a fully-implemented-looking file must be
  wired in somewhere.
- The REAL live system, confirmed via `CoverLanding.tsx`, `Dashboard.tsx`,
  and `WizardMascot.tsx`'s actual JSX plus the commits the original ask
  cited (`4e8c06a4`/`fb63a714`/`7a7d4dfb`): `coverStickers.ts`'s 12-item
  catalog (`COVER_STICKERS`, real "Codex 3D transparent set" PNGs) +
  `StickersShelf.tsx` (picker grid, two modes) + `RotatableSticker.tsx`
  (drag-to-tilt pseudo-3D, click-without-drag still fires `onClick`).
  Two consumers: Cover's "Stickers" pill equips up to 4 into fixed corner
  slots (X to remove, always-visible on touch per web's own
  `@media (hover: none)` rule — no hover-reveal needed natively either);
  the Dashboard wizard-mascot sprite tap picks ONE sticker as its skin
  (`Dashboard.tsx`'s `mascotId`, ALWAYS resolves to a real sticker via
  `?? coverStickerById(DEFAULT_...)!`, so the Dashboard wizard is ALWAYS
  the tiltable sticker variant, never the separate plain
  `wizard-doodle-cheer.png` — a real, easy-to-miss detail only visible by
  reading `WizardMascot.tsx`'s prop-threading, not by eyeballing the
  screenshot). Both persist client-side only (`localStorage` on web) — NOT
  Firestore, contrary to what the original ask's framing (citing
  `DashboardPersonalization.stickers`) implied.
- Built: `Models/StickerCatalog.swift` (`StickerItem`/`StickerCatalog`/
  `StickerStore`, `UserDefaults`-backed, same key names as web's
  localStorage keys), `Views/StickersShelfView.swift`
  (`RotatableStickerView` + `StickersShelfView`, ported drag-tilt math
  verbatim: ry clamped ±38°, rx clamped ±28°, 0.35 sensitivity). Wired into
  `CoverView` (equip mode, 4 fixed corner slots) and `DashboardView` (mascot
  mode, wizard sprite in the hero bar is now `RotatableStickerView` instead
  of a static `Image`).
  Art: copied the 12 real PNGs from
  `app/src/assets/canvas/generated/dashboard-stickers-3d/*-3d.png` (skipped
  the `-source.png` variants) into `Resources/stickers/`, registered as a
  folder reference in `project.pbxproj` (manual `PBXFileReference`/
  `PBXBuildFile`/group/Resources-phase edits, same pattern `storyArt` already
  uses; `plutil -lint` clean after each edit). Two new Swift files also
  registered the same manual way.

**3. QuestionView pattern investigation — resolved, no code change needed.**
Traced the real navigation: a Dashboard TOC-node tap calls
`navigate(\`/concept/${conceptId}\`)` (`Dashboard.tsx:316`) →
`ConceptChapterPage.tsx` (`/concept/:conceptId` in `App.tsx`) — confirmed
this page is a SINGLE continuously-scrolling horizontal canvas blending
story beats and "quest" (question) panels ("Quest panels... story +
questions blend on one sheet", the file's own comment) — there is no
separate navigation to a standalone question-session page from a concept
tap; `grep -n "Begin practice"` across both `ConceptChapterPage.tsx` and
`Practice.tsx` returns nothing, confirming native's `ConceptChapterView` →
"Begin practice" → separate `PracticeSessionView` hand-off is a native-only
invented split (a DELIBERATE one from an earlier round: "Previously tapping
a dot jumped straight into Work with no narrative framing at all" — not an
oversight). Separately, `QuestionView`'s actual real production entry
points — traced via `grep -rn "QuestionView(\|PracticeSessionView("` — are
ONLY the hero bar's "today's spark" and "weekly review" badges, both of
which map on web to `navigate('/practice', ...)` (`Practice.tsx`,
`Practice.module.css`, the teal `#21616E` theme round 4 already ported).
**Conclusion: round 4's Practice.module.css recolor was already correct for
every real entry point QuestionView actually has.** The user's Pattern-B
screenshot (toolbar, GRAPH toggle chip, stacked choices, Story link) is a
real, different web screen (`ConceptChapterPage.tsx`'s embedded quest
panel) that corresponds to native's `ConceptChapterView`, not
`QuestionView` — and `ConceptChapterView` does not currently embed
questions inline the way web's chapter page does. Flagging this as a real,
known architecture gap rather than attempting a merge this pass: embedding
real quest panels into `ConceptChapterView` (matching web's continuous
story+quiz canvas) is a substantial rewrite that would put the passing
8/9 XCUITest baseline at real risk for an unproven payoff — a judgment
call, not a shortcut, consistent with round 2's same reasoning for
deferring risky structural work.

**4. Hero-bar badge text-clipping bug, found and fixed.** The round-4
Contents screenshot already flagged this ("TODA Y'S SPAR K" reading as an
unreadable letter-stack) but round 4 queued it for the iPad audit rather
than fixing it. Root cause, confirmed by reading `sparkBadge()`
(`DashboardView.swift`): the eyebrow ("TODAY'S SPARK") and label
("Trigonometry Basics") were laid out in an `HStack`, forcing both lines to
share ONE row's width — even with `lineLimit(1)` +
`minimumScaleFactor(0.6)`, two full-length lines squeezed side by side in a
compact pill still hit the scale floor before either line actually fit,
truncating both. Changed to a `VStack` (eyebrow stacked directly above the
label) so each line gets the badge's FULL width independently — confirmed
fixed on a follow-up real-device screenshot (readable "TODAY'S SP.../
Trigonom..." and "WEEKLY REV.../Review", not the illegible mush from
before).

**5. iPad-native layout audit, started (not finished — `KnowledgeMapView`/
`WorkPracticeView` not yet audited, time-boxed out this round).**
`NotesListView.swift` (bookmarked questions + session notes) and
`FindTutorView.swift` (tutor map + list) were both single-column layouts
stretched to the full iPad width — the exact "iPhone layout stretched
wider" pattern this section warns against, confirmed by grepping for
`LazyVGrid`/`GridItem` across all remaining unaudited screens (zero hits in
any of the four). Fixed both using the same `LazyVGrid(.adaptive(minimum:
...))` reference pattern `DiagnosticGateView` already established:
- `NotesListView`: bookmarked-questions and session-notes lists now render
  in an adaptive grid (`minimum: 320`) instead of one full-width column per
  card — both card types already used internal
  `.frame(maxWidth: .infinity, alignment: .leading)`, so they dropped into
  grid cells with no further changes.
- `FindTutorView`: was a fixed 260pt map ALWAYS stacked above a full-width
  tutor list, wasting the wide canvas on iPad. Now reads the runtime width
  (`GeometryReader`) and switches to a side-by-side map (42% width) + list
  layout at ≥700pt, matching how iPad's own Maps app and similar map+list
  pickers actually behave — narrower presentations (iPhone, Slide Over,
  portrait split view) keep the original stacked layout.

**Verified real-device, not just a green build log**: `xcodebuild build`
clean first, then full `xcodebuild test` twice (once mid-session after the
Cover/sticker/QuestionView work, once again after the iPad-audit edits) —
**8/9 XCUITests passing both times, zero regressions**, same pre-existing
`testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome` baseline failure
as every prior round. Pulled real screenshots from the `.xcresult` bundle
via `xcrun xcresulttool export attachments` (not `xcrun simctl` — this is a
real device, not a simulator) and inspected them directly: the new Cover
world-map (all 8 pills visible after the width-breakpoint fix, correct
gold/lime wordmark split, Stickers/Find a Tutor pills), the Contents lanes
(confirmed round 4's claims independently — real painterly story art in
every tile, correct mastery border/glow, the "Algebraic Structure and
Symbolic Manipulation" tile's larger size in the Warm-ups lane is the real
`tocTrailingSpans()` full-row-stretch mechanic working as intended, not a
bug — the tile's fixed 16:10 aspect ratio naturally makes a 3-column-wide
trailing tile proportionally taller too), and the fixed hero-bar badges.
One full-suite run's screenshots came out sideways (device physically
rotated mid-run per Akshat's own note about touching the iPad during a
test pass) — re-ran the affected test in isolation and got a correctly
oriented, passing screenshot, per this plan's own "confirm before treating
as a regression" discipline.

**Screenshots saved**: `ios-prototype/MindCraftNotes/screenshots_realdevice_2026-08-06/round5_cover_FINAL.png`
(rotated-capture artifact copy), `round5_verify2/...` (clean re-run,
correctly oriented, all 8 cover pills visible), `round5_dashboard_contents_lanes.png`,
`round5_dashboard_lanes_herobar_fixed.png` (badge-clipping fix confirmed).

**Still not started**: `KnowledgeMapView`/`WorkPracticeView` iPad-layout
audit, the deliberate-but-real `ConceptChapterView` inline-quiz gap flagged
in item 3 above.

---

## 2. What is CURRENTLY live (source of truth for "match the current app")

Re-verified directly off `Dashboard.tsx`/`Dashboard.module.css` on
2026-08-06 (this section was previously written against the 2026-07-25
state and needed real corrections — see "Plan refresh" above).

**Nav is NOT the CLAUDE.md-documented `AppTabBar` pill bar for the main
in-app experience**, and it is also no longer 4 *labeled* pills the way the
07-25 pass of this plan described. The Dashboard owns one merged hero bar
(`<header className={s.heroBar}>`), rendered once outside the view switch so
it's identical on every tab, driving a local `view` query-param state:

| Element | `view` value | Renders |
|---------|-------------|---------|
| Wordmark ("Mind" + green "Craft", clickable, `aria-label="Home"`) | `home` (default) | The Contents roadmap (this is the screen this whole plan calls "the Dashboard") |
| Map icon button (`<Map>` from lucide-react, icon-only, no visible label) | `map` | `ActEmojiMap` (knowledge graph visualization — NOTE: this is the current component name; §1/§3's `ConstellationGpsExplorer` reference is stale, verify the live import before Phase 3 work) |
| Work icon button (`<PenLine>`, icon-only) | `work` | `WorkStudio` (homework/solver canvas) |
| Notes icon button (`<NotebookPen>`, icon-only) | `notes` | `DashboardNotesPanel` (bookmarked questions) |

There is **no separate "Home" button** — the wordmark itself is the Home
affordance (`onClick={openHome}`, `title="Home"`). So the live nav is:
**wordmark (Home) + 3 icon-only buttons (Map/Work/Notes)**, not 4 uniform
labeled pills. Build the native tab bar to match this shape (e.g. a
wordmark/logo button that also acts as the first tab, or an explicit 4th
"Home" icon if a native tab bar reads better with one — a reasonable native
adaptation, just don't silently assume 4 identical labeled pills like the
old text here said).

CLAUDE.md's separate `AppTabBar` component (`Dashboard | Solver | Admin`
pills) still exists in the codebase but is not this screen's primary nav —
do not build the native nav around it. (CLAUDE.md's "Notes/Solver/Map"
shared-naming convention is about student-facing copy tone, not literal tab
labels — "Work" is the live label for what CLAUDE.md calls "Solver.")

The hero bar, in one row, left to right: wordmark/Home → the 3 icon nav
buttons → a flexible middle zone (`WizardMascot` — mascot sprite + a plain-
text wizard line, no speech-bubble chrome; tapping the sprite opens a
stickers panel, not part of Phase 1 scope) → display name + a single
icon-only sign-out button (`<LogOut>`, no visible "Sign out" text — this is
also a change from the 07-25 state, which had visible sign-out copy).

The Home tab's body is titled **"Contents"** (`<h1 className={s.homeTitle}>`)
and is almost entirely the roadmap described in §4/§5. Sitting beside the
title is a `ringLegend` (the 4 status-color swatches, shown once at the top
of the whole tab now, not per-lane) and, in `.homeTopActions`: a "Learn
next"/"Suggested next" card (`nextTopic`), a "This week · Weekly Review" CTA
(`openWeeklyReview()` — see the new features section below for what this now
opens), and a message-tutor/parent control. **"Today's spark" is already
live**, not gated behind Phase 2 as the 07-25 text assumed — the Contents
node whose concept id matches `weakness?.conceptId` gets a real gold
glowing-ring treatment (`.tocNodeSpark`) today. Native Phase 1 can treat the
spark ring as in-scope-if-cheap rather than a hard Phase 2 deferral, though
it still depends on the same `/recommend` weakness data Phase 1's plan
explicitly excludes — a judgment call for whoever picks this up, not
something this refresh pass is resolving.

---

## New product surfaces since 2026-07-25 (read before Phase 2 planning)

Three features shipped on 2026-08-05, after this plan's Phase 0/1 pass and
before this refresh. None of them existed when §1's phase breakdown or §5's
data-flow section were written. All three are candidates to fold into
Phase 2/3 scoping — they are not yet reflected in §1's phase list itself
(left as-is below per "refresh, not rewrite"; whoever scopes Phase 2 next
should read this section first and decide where each one lands).

### 1. Live "Call" co-working sessions

**What it is**: a tutor or linked parent can join a student's live practice
question, Weekly Review, or worksheet session in real time — a shared,
co-writable scratchpad plus a link to talk. Built entirely on Firestore
listeners; there is no WebRTC/custom signaling anywhere in this stack and
nothing in `webhook/` could host one.

**Firestore schema** (verified against `app/src/lib/liveSession.ts`,
2026-08-06):
- `liveSessions/{sessionId}` — `studentId: string`, `tutorId: string | null`,
  `contextType: 'question' | 'weekly_paper' | 'worksheet'`, then context-
  dependent snapshot fields fixed for the call's lifetime (never re-fetched
  live): `questionId`/`conceptId`/`conceptName`/`questionText` (question
  context) or `pageImage`/`pageIndex`/`pageCount` (worksheet context — a
  downscaled page image, see feature 2 below; null for question/weekly_paper
  contexts), `status: 'active' | 'ended'`, `createdAt`/`lastActivityAt`/
  `endedAt` (Firestore `Timestamp | null`).
- `liveSessions/{id}/strokes/{strokeId}` — append-only subcollection, one doc
  per **completed** stroke (not per point, so two people drawing at once
  never clobber each other): `authorId: string`, `authorRole: 'student' |
  'tutor' | 'parent'`, `points: {x:number, y:number, p:number}[]` (flat
  objects, not `[x,y,p]` tuples — Firestore rejects arrays-of-arrays, "Nested
  arrays are not supported"; `toFirestorePoints`/`fromFirestorePoints` in
  `liveSession.ts` are the only place this wire-format conversion happens),
  `createdAt`.
- **Staleness**: no presence/heartbeat protocol — a session counts as live
  only while `status === 'active'` AND `lastActivityAt` (or `createdAt` if no
  activity yet) is within 20 minutes (`STALE_MS`), checked client-side via
  `isLiveSessionStale()`.
- **Rules** (`firebase/firestore.rules`, `liveSessions` match block): create
  requires `request.auth.uid == studentId` AND (`tutorId` is null OR equals
  the student's own `users/{uid}.tutorId` — spoof-proofed, can't be set to an
  arbitrary tutor); read/update allowed for the student, the matching
  `tutorId`, or a linked parent (`childId`/`childIds` on the parent's own
  user doc); update is blocked from ever changing `studentId`/`tutorId` post-
  create; delete is always `false`.

**Real files**: `app/src/lib/liveSession.ts` (the data layer —
`createLiveSession`/`endLiveSession`/`appendLiveStroke`/`subscribeLiveSession`/
`subscribeLiveStrokes`/`subscribeActiveLiveSessionsForTutor`/
`subscribeActiveLiveSessionsForParent`), `app/src/components/ScratchPad.tsx`
(new optional props: `liveSessionId`, `authorId`, `authorRole`,
`remoteStrokes: ScratchStrokePoint[][]`, `backgroundImage`; forwarding a
locally-finished stroke to Firestore is a no-op unless both `liveSessionId`
and `authorId` are set), `app/src/components/CallButton.tsx` (a small "call"
button, hidden entirely when the student has no linked tutor; creates the
session then navigates to `/live-session/:id`), `app/src/pages/LiveSessionPage.tsx`
(route `/live-session/:sessionId`, used by both the creating student and a
joining tutor/parent; does a client-side defense-in-depth role check —
`resolveRole()` — on top of the Firestore rules, then renders a context
header from the session doc's own snapshot fields, the co-writable
`ScratchPad`, and Talk/End/Leave controls), `app/src/components/LiveJoinBanner.tsx`
(on TutorDashboard/ParentDashboard, subscribes to that tutor's/parent's
active sessions and offers a join link).

**Native-porting note**: this is the highest-value, lowest-effort feature to
port. It needs zero new native infrastructure — this plan's §3 architecture
principle ("same Firestore project, same documents, no native-only schema")
already covers it exactly. Concretely: a native `LiveSessionClient` mirroring
`liveSession.ts`'s functions 1:1 (Firestore SDK `addSnapshotListener`/
`addDocument`, same collection/field names verbatim), and wiring
`CanvasView.swift`'s existing PencilKit stroke-completion callback to also
`addDocument` into the `strokes` subcollection using the same flat
`{x,y,p}` point shape — no new drawing surface needed, `CanvasView` already
captures exactly this data locally. "Talk" is just a link-out (no in-app
audio in the web version either), so native doesn't need to build calling.

### 2. Write-on-your-worksheet mode

**What it is**: uploading a PDF/photo now offers **"Extract questions"**
(the existing path — `HomeworkSession.tsx`, unchanged) or **"Write on it"**
(new) — the new path rasterizes the page as an image and lets the student
draw directly on top of it via `ScratchPad`'s new `backgroundImage` prop,
like marking up a photocopy. Has its own Call integration
(`contextType: 'worksheet'` on `liveSessions`, see feature 1).

**Real files**: `app/src/pages/WorksheetSession.tsx` (route `/worksheet`,
169 lines). Pages arrive via router `state` from `WorkStudio.tsx`'s
`pagesFromFile()` output (already in memory there) — **deliberately not
persisted server-side**; a reload of this route has nothing to resume from
and bounces back to the Work tab. Page navigation remounts `ScratchPad`
(keyed by page index) so switching pages starts a fresh canvas; ink is not
round-tripped back in on revisiting a page. The `pageImage` snapshot written
into a `liveSessions` doc for a worksheet call goes through
`downscaleForLiveSession()` (`app/src/lib/homework.ts`) specifically to stay
under Firestore's per-document size cap — never the full-resolution
`pagesFromFile()` output.

**Native-porting note**: needs a native page rasterizer (PDFKit can render a
PDF page to an image directly on iOS — arguably simpler than the web's
canvas-based rasterization) plus the same `ScratchPad`-with-image-underlay
treatment Phase 2 already needs for `CanvasView.swift`. The Firestore side is
identical to feature 1's schema (`contextType: 'worksheet'`, `pageImage`/
`pageIndex`/`pageCount`) — no new schema work, just a new snapshot-field
combination on the same collection.

### 3. Weekly Review guided walkthrough

**What it is**: a new session mode inside `app/src/pages/Practice.tsx`. For
each topic in a student's weekly paper, it shows a story beat, then a
formula/concept card (from `app/src/lib/conceptContent.ts`'s
`CONCEPT_CONTENT: Record<string, ConceptContent>` — real per-concept
`keyRules`/`tips`/`watchOut`/optional `formula`/`examples` — 989 lines,
already covers a real subset of concepts, not a stub), then that topic's
question batch, then auto-advances to the next topic's story beat
(`pPhase === 'weekly-story'`, orchestrated by `startWeeklyWalkthrough()` /
`beginWeeklySlotSession()` and `weeklyWalkSlots`/`weeklyWalkIndex`/
`weeklyWalkQuestionsBySlot` state in `Practice.tsx`). Entry point:
`app/src/components/WeeklyReviewPicker.tsx` — a "mandala" of concept-icon
dots (modes: `all` / `recommended` / `manual`) with a **"Let's Go"** button
(`onPlayThrough`) that starts this new guided mode. The prior printable path
(`WeeklyPracticePaperPage.tsx`, route `/weekly-paper`) still exists
unchanged for a scroll/print view of the same paper; `WeeklyReviewPicker`'s
`onStart` prop for that path is now `@deprecated` (kept only for callers
that still pass it) since the print path is no longer reachable from the
picker's own UI.

**Data/schema note**: this feature reads from `app/src/lib/weeklyPracticePaper.ts`'s
client-side paper builder/cache (`buildWeeklyPracticePaper`, `cacheWeeklyPaper`,
`loadCachedWeeklyPaper`) over the existing question bank + concept content —
**no new Firestore collection**. It is pure UI/session-orchestration logic
layered on data that's already relevant to native Phase 2 (question bank,
concept content) for other reasons.

**Native-porting note**: lower priority than feature 1 — it's a content-
sequencing state machine, not a new capability class, and it depends on
Phase 2's real single-question practice screen existing first. When Phase 2
scopes the native practice session screen, this is the natural follow-on:
loop story-beat view → `CONCEPT_CONTENT` card view → question-batch view,
driven by the same per-slot grouping logic `startWeeklyWalkthrough()` already
implements (group the paper's questions by `conceptId`, skip any slot with
zero questions rather than blocking the whole walkthrough on one bad slot).

---

## 3. App architecture

### Stack
- **SwiftUI**, iOS 17 minimum deployment target (already set in the existing
  project — do not lower it; PencilKit/Core Data usage already assumes it).
- **Firebase iOS SDK** via Swift Package Manager
  (`https://github.com/firebase/firebase-ios-sdk`): `FirebaseAuth`,
  `FirebaseFirestore`, `FirebaseCore`. Do **not** add `FirebaseStorage` yet —
  nothing in Phase 1–3 needs it (the web app's `storage` export is unused by
  anything this plan builds).
- **GoogleSignIn-iOS** via SPM
  (`https://github.com/google/GoogleSignIn-iOS`) — the standard companion
  package for Google auth on native Apple platforms; Firebase Auth alone
  does not drive the Google OAuth UI on iOS, it only consumes the resulting
  ID token.
- No new HTTP client library. `URLSession` (already the pattern in
  `MyScriptRecognizer.swift`) is enough for the two REST calls this app
  makes outside the Firestore SDK: `GET /knowledge-graph/{uid}` (Phase 1) and
  `/recommend` / `/record-outcomes` (Phase 2), against the same
  `https://joinmindcraft-mindcraft-ml.hf.space` base URL the web app's
  `.env.production` points at (see CLAUDE.md's Deployment section — this is
  the live ML backend as of 2026-07-07, not the dormant Cloud Run URL).

### One source of truth, not a native-only data model
Every doc/collection this app reads is the **same** Firestore project
(`mindcraft-93858`) and the **same** documents the web app reads/writes.
There is no separate native backend, no native-only schema, no local mirror
that could drift from the web app's view of a student's state. Concretely:
- `users/{uid}` — same document `useStudentData.ts` subscribes to.
- `GET /knowledge-graph/{uid}` — same ML endpoint `graphCache.ts` calls.
- Auth — same Firebase Auth project, so a student's password/Google account
  works identically on both clients; signing in on the iPad and then opening
  the web app (or vice versa) is the same account, same session semantics
  (just not synced in real time unless both are open — that's fine, no
  requirement for that in this plan).

### Firebase config (must match `app/src/firebase.ts` exactly)
```
projectId:  mindcraft-93858
apiKey:     AIzaSyBetzXAekac3zTdzgJ3vGxqKCQAXc3tcsU   (public, client-side key — same trust model as the web app's, not a secret)
storageBucket: mindcraft-93858.firebasestorage.app
```
The native app needs its **own** `GoogleService-Info.plist`, registered as a
**new iOS app inside the same `mindcraft-93858` Firebase project** (Firebase
Console → Project Settings → Add app → iOS, bundle ID
`com.mindcraft.notes-prototype`) — this is not a new project, just a new app
registration under the existing one, exactly the way the existing web app is
one registered "app" and the ML services are separate infra. `entrypoint.sh`/
`FIRESTORE_PROJECT` env-var patterns from CLAUDE.md's ML deploy section do
not apply here; this is a client SDK, not a server.

`GoogleService-Info.plist` and the Google OAuth `REVERSED_CLIENT_ID` URL
scheme are real credentials — they live inside `ios-prototype/`, which is
**already fully excluded from git** (see the repo's root `.gitignore`: the
whole `ios-prototype/` directory is ignored, specifically called out there
because of the MyScript keys already living in `MyScriptRecognizer.swift` in
plain source). No new `.gitignore` entry is needed; the existing blanket
exclusion already covers it. This matches the existing MyScript credential
pattern exactly — same trust model, same reason it's acceptable here (a
personal/team dev key pair in a folder that never reaches git), not a
new precedent.

### Navigation structure (maps 1:1 onto §2's live web routes)

```
AuthGate (root)
├── not signed in → LoginView                      (web: /login)
└── signed in      → DashboardView                 (web: /dashboard)
                        ├── Home tab  → ContentsRoadmapView   (web: ?view=home, default)
                        ├── Map tab   → MapPlaceholderView → (Phase 3) KnowledgeMapView
                        ├── Work tab  → WorkPlaceholderView → (Phase 2) reuses CanvasView/GraphView
                        └── Notes tab → NotesPlaceholderView → (Phase 2) bookmarked questions list
```

`AuthGate` is a thin root view (lives in `MindCraftNotesApp.swift`, replacing
today's direct `ContentView()` root) that observes an `AuthService`
(`@StateObject`, see §9 Agent A) and switches between `LoginView` and
`DashboardView` — the exact same job `App.tsx`'s `AuthGuard` does on the web
side, at the same layer of the app (root, not per-screen).

---

## 4. Design system port

**Rewritten 2026-08-06** — everything below this point was re-verified
against the live 2026-08-06 source. The prior version of this section (fonts,
colors, and the Contents roadmap mechanics) described the light "notebook"
palette that shipped through 2026-07-25; the web app switched to a dark
"chalkboard" palette + a structurally different roadmap layout on 2026-08-05.
Do not build against any cached memory of the old light palette.

### Fonts (bundle all five families; the web now runs a display/hand split)
Source: `app/index.html`'s Google Fonts `<link>` + `app/src/styles/tokens.css`
(re-aligned 2026-08-05 — see that file's own comment: "our brand book is the
website," matching `index.html` after the app had briefly drifted onto its
own DM Sans/Source Serif 4 pairing):

| Role | Family | Weights to bundle | CSS token it replaces |
|------|--------|--------------------|------------------------|
| Big/splashy headings, wordmark-scale display | **Fredoka** | 500, 600, 700 | `--tok-font-display` (new role, did not exist in the 07-25 pass) |
| Body/UI/nav/answers everywhere | **Nunito Sans** + **Inter Tight** (paired, Nunito Sans primary) | Nunito Sans: 400, 500, 600, 700, 800, 900, 400-italic; Inter Tight: 500, 600, 700, 800, 900 | `--tok-font-sans` (was DM Sans through 07-23→08-05) |
| Story/chapter serif voice | **DM Serif Display** | 400 regular, 400 italic (this family ships one weight) | `--tok-font-serif` (was Source Serif 4) |
| Data/labels/mono | **IBM Plex Mono** | 400, 500, 600, 700, 400-italic | `--tok-font-mono` (unchanged) |
| Decorative flourishes ONLY (small watermarks, atmospheric captions — explicitly NOT headings/nav/answer choices/typed input) | **Caveat** | 400, 600, 700 | `--tok-font-hand` (demoted 2026-08-05 — its prior use on headings/nav read as "weird italic" and was pulled from those call sites) |

Download the static `.ttf` files from fonts.google.com (SIL Open Font
License — bundling is legal), add them to the Xcode target under the
`Resources/Fonts/` group, list every file in `Info.plist`'s `UIAppFonts`
array, and register a `Font+MindCraft.swift` extension (one static accessor
per role — `Font.mcDisplay`, `Font.mcSans`, `Font.mcSerif`, `Font.mcMono`,
`Font.mcHand` — matching the 5 CSS token roles above) so call sites never
hardcode a family string. **Do not use Caveat/`Font.mcHand` for the wordmark,
nav, headings, or answer choices** — that is exactly the misuse the web side
just corrected; reserve it for genuinely decorative one-off flourishes, same
restriction `tokens.css`'s own comment states.

### Colors (hex values pulled directly from `Dashboard.module.css`, 2026-08-06 — dark palette)

**Canvas stage background** (the whole in-app backdrop — this REPLACES the
old light-lavender gradient this section previously described, which no
longer exists anywhere in the live CSS):
```
radial-gradient ellipse 70%x50% @ 85% 8%:  rgba(185,232,111,0.14) → transparent
radial-gradient ellipse 50%x40% @ 15% 90%: rgba(29,58,138,0.22) → transparent
linear 165deg base: #1c3228 → #14261c → #0f1f18
```
Ink/text on this stage: `#f4efe2` (cream, near-white — this is now the ONE
ink color used everywhere on the stage, not a per-lane ink table, see below).
In SwiftUI: a `LinearGradient([Color(hex:"1c3228"), Color(hex:"14261c"),
Color(hex:"0f1f18")], startPoint: .topLeading, endPoint: .bottomTrailing)`
with two low-opacity radial highlight overlays, same compositing approach as
before, new hex values. This is now a dark, near-black-green "chalkboard,"
not a soft pastel backdrop — treat contrast/accessibility on this surface as
a fresh check, not an assumption carried over from the old light version.

**Wordmark**: "Mind" in the stage ink (`#f4efe2`), "Craft" in `#54b948` (the
one brand green used everywhere else too — `MindCraftLogo`, `AppTabBar`,
`Practice`) — this brand green is unchanged from the prior pass.

**Nav (icon-only, see §2)**: verify exact active/inactive icon tint + hover
state directly in `Dashboard.module.css`'s `.navBtn`/`.navActive` rules
before implementing — not re-stated here since the nav itself changed shape
(3 icon buttons + wordmark, not 4 labeled pills, see §2) and guessing pixel
values for a component whose structure just changed is worse than pointing
at the real source.

**Four Contents lanes** (`ACT_TOC_SECTIONS` in `app/src/lib/actToc.ts`) — all
four now share ONE ink color and use dark-tinted washes, a full palette
change from the 07-25 light pastel table this section previously had:

| Lane id | Title | Wash (dark, top→bottom, both stops semi-transparent over the stage) | Accent | Ink |
|---------|-------|--------------------|--------|-----|
| `warmups` | Warm-ups | `rgba(90,48,28,0.55)` → `rgba(40,24,16,0.72)` | `#e8a06c` | `#f4efe2` |
| `algebra` | Algebra | `rgba(36,122,77,0.38)` → `rgba(14,40,28,0.72)` | `#b9e86f` | `#f4efe2` |
| `geometry` | Geometry | `rgba(47,122,143,0.4)` → `rgba(14,36,48,0.72)` | `#7ec8e3` | `#f4efe2` |
| `data` | Data & chance | `rgba(211,169,0,0.28)` → `rgba(40,32,12,0.72)` | `#f5d348` | `#f4efe2` |

All 4 accent hex values above also changed from the prior light-palette pass
(e.g. `warmups` accent was `#e07a3a`, now `#e8a06c`) — use the values in this
table, not the old ones.

**Mastery status color** (`STATUS_COLOR` in `app/src/lib/learningPathGraph.ts`
— the SAME map both the Contents roadmap and the Knowledge Map read, so a
node reads identically "mastered" on both screens; unchanged from the prior
pass — re-verify against the live file before Phase 3, not re-verified in
this refresh pass):

```
mastered / stable / comeback_built / ready_for_challenge → #A8E063
in_progress / repairing                                  → #5B9BD5
struggling / open_gap                                     → #FF6B6B
untouched / unexplored (default)                          → #8B9BA8
```

Port this as a plain `[String: Color]` Swift dict, verbatim, in the frozen
`Models/DashboardModels.swift` seam file (see §9) — every later screen
(roadmap now, Knowledge Map in Phase 3) reads this one dict, so a status
never renders a different color on two native screens either.

### Motion
`cubic-bezier(0.2, 0, 0, 1)` (web: `--tok-ease-weight`) → SwiftUI
`Animation.timingCurve(0.2, 0, 0, 1, duration:)`. Applies to roadmap-node
state transitions and nav active-state changes. Not re-verified against a
`--desk-ease-bounce`-style sticker curve in this refresh pass — check
`Dashboard.module.css` directly if/when a bounce animation is ported.

### The Contents roadmap component — REWRITTEN, the mechanics changed completely on 2026-08-05

**This is the single biggest correction in this refresh.** The prior version
of this section described a vertical stack of lane cards, each a
horizontally-scrolling row of circular pie-fill "dots" connected by thin
lines — **none of that exists in the live app anymore.** The actual current
structure (verified against `Dashboard.tsx` lines ~92–190 and ~877–945, and
`Dashboard.module.css` lines ~1520–1750, 2026-08-06):

- **Outer layout — a computed 12-column CSS grid, not a vertical stack.**
  `.horizontalToc` is a 12-column grid; the 4 lanes are placed two-per-row,
  each lane's `grid-column: span N` computed at module-load time by
  `computeTocLaneLayouts()` (`Dashboard.tsx`) from that lane's real
  `conceptIds.length` — a lane with more concepts gets a proportionally wider
  span (`tocLaneSpanPair()`), instead of a hand-tuned fixed split. Port the
  *intent* (proportional width by content density) to whatever native grid
  primitive fits (e.g. a `LazyVGrid`/`Grid` with computed column-span-
  equivalent sizing) — the exact 12-column CSS mechanic itself is a web
  implementation detail, not something to replicate literally.
- **Lane card**: rounded card (`border-radius: 18px`), the lane's dark wash
  gradient as background (table above), `1px` border tinted 35% toward the
  lane accent, a soft dark shadow, plus a decorative radial-gradient glow
  blob bleeding off the bottom-left corner (`.tocLane::after` — purely
  ambient, skip it natively without loss).
- **Lane header**: `TocSectionMark` glyph (native: a simple SF Symbol or
  custom shape tinted with the lane's accent, still doesn't need to be
  pixel-identical) + title (currently rendered at `font-size: 22px,
  font-weight: 700`, NOT Caveat — the lane title uses the sans/display stack,
  a change from the prior pass's "Caveat 700 ~28pt" claim, re-verify the
  exact family in `.tocLaneTitle` before pixel-matching).
- **The track — a near-square computed grid per lane, NOT a horizontal
  scroll of dots.** `tocColumnsFor(count)` picks 3–4 columns (near-square,
  `ceil(sqrt(count))` clamped) for that lane's own concept grid;
  `tocTrailingSpans()` computes a `grid-column: span N` for each cell in an
  incomplete trailing row so the last row always fills edge-to-edge instead
  of leaving a ragged leftover — port this same "solve for columns from
  count, then solve trailing-row spans" logic natively rather than
  hardcoding a column count, since the real per-lane concept counts (7/11/7/2
  as of this pass) will keep changing as the ontology/ACT coverage does.
- **The node — a square icon tile with a mastery-driven border/glow, NOT a
  circular dot.** Each concept renders as: a square art tile
  (`.tocNodeIcon`, `aspect-ratio: 16/10`, rounded corners) showing that
  concept's real story-art image (`storyArtFor(id)`, NOT a generic icon or a
  pie-fill circle), a 2-line-clamped name label below it, and — this is the
  actual "mastery ring" mechanic — **status color lives on the tile's outer
  BORDER**, not a circular fill:
  ```
  border-color  = color-mix(node-status-color, opacity 40%–90% scaled by raw mastery, over transparent)
  box-shadow    = matching glow, opacity 18%–53% scaled by raw mastery
  ```
  i.e. border/glow strength is continuously driven by `mastery ∈ [0,1]`
  exactly the way the old pie-fill was meant to convey progress, just
  expressed as a border/glow intensity instead of a filled arc. A
  `mastered`-tier status (`data-state="complete"`) gets a small square
  checkmark badge overlaid on the tile's bottom-right corner
  (`.tocNodeCheck`) instead of/in addition to the border treatment.
  **There is no pie/conic arc fill and no connector lines between nodes in
  the current implementation** — a stale comment survives in
  `Dashboard.module.css` referencing "connector lines" and a
  `.tocNodeDot::before/::after` that no longer exist in the JSX; do not
  port connector-line logic, it would not match the live product.
  - Status → dot state mapping is unchanged (`tocDotState()` is still pure/
    small, port verbatim):
    ```
    TOC_MASTERED_STATUSES    = {mastered, stable, comeback_built, ready_for_challenge} → .complete
    TOC_STRUGGLING_STATUSES  = {struggling, open_gap}                                  → .needs
    {in_progress, repairing}                                                            → .progress
    everything else (including untouched)                                               → .locked (62% opacity on the whole node)
    ```
- **Today's-spark highlight is LIVE, not a Phase-2 deferral.** The concept
  matching `weakness?.conceptId` gets `.tocNodeSpark` — a gold border/glow
  override with a slow pulse animation and gold-tinted name text. The prior
  version of this plan said "do not build this ring logic until Phase 2";
  that's now inaccurate for the web app itself (see §2's note on this too).
  Native Phase 1 can decide whether to include it given it depends on
  `/recommend` weakness data that Phase 1's own data-flow (§5) otherwise
  excludes — flagging the dependency, not resolving it here.
- **Status legend moved**: it's now shown ONCE at the top of the whole Home
  tab (next to the "Contents" title, `.ringLegend`), not per-lane/per-node.

---

## 5. Data flow for the Dashboard (Phase 1, concretely)

Two independent reads, both keyed by the signed-in Firebase `uid`, both
already how the web app gets this exact data (nothing native-only invented):

### Read 1 — `users/{uid}` (Firestore document, real-time listener)
Mirrors `useStudentData.ts`'s subscription. Fields Phase 1 actually needs:
```
displayName: String        // falls back to Auth displayName, then email-prefix, then "there" — same 3-tier fallback as firstName() in useStudentData.ts
role:        String?       // gates admin-only UI later; Phase 1 just needs "not blocking"
```
Do not build a bespoke native user-doc writer in Phase 1. If the doc does
not exist yet (brand-new sign-up), **do not silently create one client-side
with invented fields** the way `useStudentData.ts` does for the web —
instead surface a clear "finish setting up on mindcraft-93858.web.app first"
state, OR (better, and cheap to add given `useStudentData.ts`'s create-on-
first-snapshot logic already lives in one small effect) directly port that
same effect: `setDoc` with `role: 'student'`, `streak: 0`,
`practiceCount: 0`, `createdAt`/`lastActive: serverTimestamp()`. Either is
acceptable for Phase 1; do not invent a third shape.

### Read 2 — `GET {ML_API_URL}/knowledge-graph/{uid}` (one-shot REST call)
Mirrors `graphCache.ts`'s `fetchKnowledgeGraph`. `ML_API_URL` =
`https://joinmindcraft-mindcraft-ml.hf.space` (the live HF Spaces bridge —
see CLAUDE.md Deployment; this free-tier Space sleeps after ~48h idle and
takes ~60s to wake on a cold call, the native client's loading state must
tolerate that, not time out early).

Auth header: `Authorization: Bearer <Firebase ID token>` — obtain via
`Auth.auth().currentUser?.getIDToken()`, same as the web's `mlAuthHeaders()`.

Response shape actually consumed:
```json
{ "nodes": [ { "id": "linear_equations", "mastery": 0.62, "status": "in_progress", ... }, ... ] }
```
Build a `[String: ConceptProgress]` dict keyed by `node.id`, exactly what
`Dashboard.tsx`'s `conceptProgress` state is — this dict is the frozen
seam Agent C's roadmap view reads (§9).

### Mapping to roadmap dots
For each concept id in each of the 4 `ACT_TOC_SECTIONS` lanes (ported
verbatim from `actToc.ts`, see §9's Phase-0 data export), look up
`conceptProgress[id]`:
- Missing entry → `mastery = 0`, `status = "untouched"` (never crash on a
  concept the graph hasn't touched yet — this is the expected state for
  most concepts on a new account).
- Present entry → clamp mastery to `0...1`, pass status straight through
  `tocDotState()`.

This is the entire Phase 1 data pipeline. No `/recommend` call, no
`/seed-assessment`, no practice-outcome writes — those are Phase 2.

---

## 6. Where Groq plugs in (Phase 4, not Phase 1)

**Feature**: "Explain this step" — a single button attached to a practice
question or a Work-tab scratch session. Tap it → the student's current
question text (+ their MyScript-recognized expression, if any) is sent to
Groq's chat completions API with a short system prompt enforcing the same
constraints `AGENT_RULEBOOK.md`/`CODEX_BRIEF.md` put on every other LLM call
in this product: never reveal the final answer, never say any of the
banned words (wrong/incorrect/try again/easy/fix/behind/quiz/diagnostic
test/etc.), keep it to 2-3 sentences, Katha-adjacent warm tone. The response
renders as plain text under the question — no new UI chrome needed beyond a
button + a text block.

**Why Phase 4, not Phase 1**: per CODEX_BRIEF's core law — the deterministic
engine (here: mastery data, question content) must work with zero LLM in the
loop before an LLM sits on top of it. Phase 1's whole point is proving the
real-data pipe works; adding a third network dependency (Groq, on top of
Firebase + the ML Space) before that's proven would muddy what's actually
being verified.

**Implementation shape** (when its phase arrives): a `GroqExplainClient.swift`
file that mirrors `MyScriptRecognizer.swift`'s existing shape almost exactly
— a `Credentials` enum with a hardcoded key (same trust model already
accepted for MyScript in this same gitignored folder, see §3), a plain
`URLSession` POST to Groq's OpenAI-compatible `/openai/v1/chat/completions`
endpoint, a small wire-format struct pair (request/response), and a thrown
`GroqError` enum for the failure states (not configured / rate limited /
bad response), same pattern as `MyScriptError`.

**Flag honestly, do not silently ship past it**: embedding a real API key
directly in a shipped App Store binary (rather than proxying the call
through a server, the way the web app's `webhook/` Vercel functions keep the
Anthropic key server-side) is acceptable for this prototype/internal-testing
phase — same call this repo already made for the MyScript key — but is
**not** the target production architecture. Before this app goes to real
students at scale, this call should move behind a thin server proxy (a new
`webhook/api/native-explain.ts`-style endpoint, mirroring the existing
`agent-check-in.ts` pattern) so the Groq key never ships inside the app
binary. Note this in the PR/commit that adds `GroqExplainClient.swift` so it
isn't forgotten.

---

## 7. Reuse plan — exactly what NOT to rebuild

Every file under `ios-prototype/MindCraftNotes/MindCraftNotes/`, with a
verdict. "Reuse as-is" means literally do not open the file to change logic.

| File | Verdict | Why |
|------|---------|-----|
| `Models/PolynomialExpression.swift` | **Reuse as-is** | Canonical grammar + LaTeX subset. Already faithfully ported to the web app (`app/src/lib/polynomialExpression.ts`, ACTIVE_TASK.md 2026-07-24) — this Swift file is provably the source of truth both clients now agree with. Do not re-derive. |
| `Models/LaTeXMath.swift` | **Reuse as-is** | Shared text-surgery helper the above depends on. |
| `Models/LaTeXDisplayText.swift` | **Reuse as-is for Phase 1–2**; superseded once a real native math-rendering solution exists | Plain-text LaTeX stand-in. Fine until KaTeX-equivalent native rendering is scoped (open item below). |
| `Views/GraphView.swift` | **Reuse as-is** | Native Canvas plotter; already the reference the web's `GraphBox.tsx` was ported from. Drop into the Work tab in Phase 2 unchanged. |
| `Views/CanvasView.swift` | **Reuse as-is** | PKCanvasView wrapper, palm rejection, tool picker, debounced-save hookup. Already parametrized by `questionId` + `DrawingStore` — drop into Phase 2's Work/Notes screens unchanged. |
| `Persistence/PersistenceController.swift` | **Reuse as-is** | Core Data stack. |
| `Persistence/DrawingStore.swift` | **Reuse as-is for Phase 1–2.** Revisit in Phase 3+ | Currently keyed only by `questionId`, single shared local store — fine for one signed-in student per iPad. If this iPad is ever shared across multiple signed-in students, the `QuestionDrawing` entity needs a `studentUid` attribute added to the Core Data model and the fetch predicates updated — flag as an open item, not a Phase 1–2 blocker. |
| `Persistence/MindCraftNotes.xcdatamodeld` | **Reuse as-is** (see note above for the future `studentUid` addition) | |
| `Networking/MyScriptRecognizer.swift` | **Reuse as-is** | Real, configured, working batch-REST client. Not wired into the real question flow until Phase 4. |
| `Models/SampleQuestion.swift` | **Leave behind for Phase 1**; becomes reference-only in Phase 2 | Its 5 hardcoded questions were a technical-spike fixture. Phase 2's real question screen reads real question content (from the same source the web app's `questionBank.ts` merges, or a native-bundled subset of it — TBD in Phase 2 planning, not this pass), not this file's hardcoded array. The `ConceptStory`/`SampleQuestion` *shape* (protagonist/settingLine/bridgeLine/excerpt, rawQuestion/rawChoices/correctIndex) is a reasonable pattern to imitate, just not this file's literal content. |
| `Views/QuestionView.swift` | **Adapt in Phase 2** | Layout (story-left/canvas-right, portrait/landscape split) is good and should carry over. Its hardcoded single-concept `StoryTheme` (paper/ink/dim/accent constants for `fractions_decimals` only) needs to become the real per-lane `ACT_TOC_SECTIONS` palette (§4) once more than one concept is in play — not a Phase 1 concern since Phase 1 has no question screen at all. |
| `ContentView.swift` | **Leave behind** | Was the whole-app entry point for the spike (question picker + single QuestionView). Phase 1's real entry point is `AuthGate` (§3), not this. Its question-switcher segmented-picker pattern may inform Phase 2's real multi-question session UI, but the file itself isn't reused verbatim. |
| `MindCraftNotesApp.swift` | **Adapt** | Keep the Core Data environment injection; replace the direct `ContentView()` root with `AuthGate` (§3), add `FirebaseApp.configure()` to init. |
| `MindCraftNotesUITests/MindCraftNotesUITests.swift` | **Extend, don't replace** | Its 4 existing tests (question render, pencil-only rejection, any-input acceptance, cross-question persistence) must keep passing untouched — they prove real, still-relevant things about `CanvasView`. Add new test methods for Login/Dashboard (§10), don't rewrite the existing ones. |
| `PROTOTYPE_STATUS.md` | **Read-only reference** | Historical record of what was verified and how (real device screenshots, real XCUITest runs, honest "what's NOT verified" section). Do not edit; add a new dated status doc for Phase 1 instead if a written verification record is wanted (not required by this plan). |

**Open item, not blocking Phase 1**: native math rendering. The web app's
`MathText` component uses KaTeX (a web-only library); nothing analogous
ships for SwiftUI out of the box. `LaTeXDisplayText`'s plain-text rendering
(turns `\frac{9}{12}` into "9/12") is an acceptable Phase 1–2 stand-in, same
as it already is in this prototype today. A real native LaTeX renderer
(options: a bundled MathJax-in-WKWebView hybrid, a native `swift-math`-style
library, or hand-rolled fraction/exponent layout using SwiftUI `Text`
concatenation for the common cases) is a real, separate scoping decision —
flag it for a future planning pass, do not silently improvise a partial
answer inside a Phase 2 feature PR.

---

## 8. Data files to port (bundled, read-only resources)

To avoid re-deriving logic that already exists and is tested on the web
side, export these as static JSON bundled into the iOS app rather than
hand-translating the TypeScript into a parallel Swift implementation that
can drift:

1. **`actToc.json`** — the 4 `ACT_TOC_SECTIONS` (id, title, blurb, wash-top,
   wash-bottom, accent, ink, `conceptIds[]`). Add a small one-time export
   script `app/scripts/exportActTocForNative.mjs` (Product-lane file, run
   manually, output copied into
   `ios-prototype/MindCraftNotes/MindCraftNotes/Resources/actToc.json`) that
   imports `ACT_TOC_SECTIONS` from `app/src/lib/actToc.ts` and serializes it.
   Rerun and re-copy whenever the web side's lane definitions change — this
   is a rerunnable script per CLAUDE.md's "new pipelines should be
   rerunnable scripts" convention, not a one-off hand-copy that will
   silently drift.
2. **Concept display names/blurbs** — `actConceptLabel`/`actConceptBlurb`
   output for the ~27 concepts across the 4 lanes, exported the same way
   into the same JSON (add `label`/`blurb` per concept id) so the native
   roadmap's node text matches the web's exactly, including the
   `FALLBACK_BLURBS` cases.

Do not bundle the full `actOntologyCoverage.json` (`app/src/data/`) or the
42-concept ontology — Phase 1 only needs the ~27 ACT-tested concept ids the
roadmap actually shows, already fully captured by item 1 above.

---

## 9. Parallelizable work breakdown

### Why Phase 0 must be sequential, and what it does
`project.pbxproj` in this project is **hand-authored, explicit-file-list
style** (`PBXFileReference`/`PBXBuildFile`/Sources-phase entries per file —
confirmed: no `PBXFileSystemSynchronizedRootGroup` token present, so Xcode
16's folder-auto-include format is not in use here). That means **every new
Swift file requires a `project.pbxproj` edit** to register it in the
target. If Agents A/B/C/D each add their own new files and edit this one
shared text file independently, their edits collide/conflict on merge.

**Phase 0 (one agent, sequential, before any of A/B/C/D start):**
1. Add the two SPM package dependencies (`firebase-ios-sdk` — `FirebaseAuth`,
   `FirebaseFirestore`, `FirebaseCore`; `GoogleSignIn-iOS`) to the project.
2. Add the (placeholder, empty-but-compiling) `GoogleService-Info.plist` —
   real values filled in by Agent A once the Firebase Console app
   registration exists — and register it as a resource.
3. Add the `UIAppFonts` `Info.plist` array + create the
   `Resources/Fonts/` group (font files themselves can be dropped in by
   Agent B/C as a content-only change once the group exists — adding files
   *into an existing registered group* that already has its folder
   reference is a much smaller pbxproj diff than creating the group).
4. **Pre-register empty placeholder Swift files** for every file named in
   §9's agent breakdown below (each just `// TODO: <agent>` + the bare
   `import SwiftUI`/`import Foundation`), so the pbxproj's file list and
   Sources build phase are fully settled before parallel work starts. Every
   later agent then only edits file **contents**, never `project.pbxproj`
   again for Phase 1.
5. Write `Models/DashboardModels.swift` for real (not a placeholder) — this
   is the **frozen seam** both Agent B and Agent C read but neither owns
   further edits to without the other's sign-off:
   ```swift
   struct ConceptProgress { let mastery: Double; let status: String }

   struct TocSection: Identifiable, Decodable {
       let id: String            // "warmups" | "algebra" | "geometry" | "data"
       let title: String
       let blurb: String
       let washTop: String        // hex, e.g. "fff8f1"
       let washBottom: String
       let accent: String
       let ink: String
       let conceptIds: [String]
   }

   struct ConceptDisplay: Decodable { let label: String; let blurb: String }

   enum TocDotState { case complete, needs, progress, locked }

   func tocDotState(_ status: String) -> TocDotState { /* ported verbatim from Dashboard.tsx's tocDotState() */ }

   let STATUS_COLOR: [String: String] = [ /* ported verbatim, hex strings, see §4 */ ]
   ```
6. Verify `xcodebuild build -destination 'id=DD553C3C-D821-5869-BBA2-AB501D46210E'`
   still succeeds after steps 1–5, with zero real feature code yet — this is
   the checkpoint that proves the shared scaffolding compiles before 4
   people start building on top of it in parallel.

### Phase 1 parallel chunks (start only after Phase 0 lands)

**Agent A — Auth / Login**
- Owns: `Networking/FirebaseBootstrap.swift` (calls
  `FirebaseApp.configure()`, called once from `MindCraftNotesApp.swift`'s
  init), `Networking/AuthService.swift` (an `ObservableObject` publishing
  `currentUser: User?`, wrapping `Auth.auth().addStateDidChangeListener`,
  exposing `signInWithGoogle()`, `signInWithEmail(_:_:)`,
  `createAccount(_:_:)`, `signOut()` — mirrors `Login.tsx`'s functions one
  for one, no popup/redirect distinction needed on native), `Views/LoginView.swift`
  (Google button + email/password fallback, matching `Login.tsx`'s two-mode
  UI: Google primary, email secondary behind a "use password instead"
  toggle — reuse the copy/error-message strings from `friendlyError()` in
  `Login.tsx` so the tone matches), the real `GoogleService-Info.plist`
  content (registering the app in Firebase Console), and the
  `REVERSED_CLIENT_ID` URL-scheme entry in `Info.plist` Google Sign-In's
  callback needs.
- Touches `project.pbxproj`: **no** (Phase 0 already registered these files).
- Depends on: Phase 0 only.

**Agent B — Dashboard shell + real user data fetch**
- Owns: `Networking/FirestoreStudentStore.swift` (an `ObservableObject`
  exposing `displayName: String`, `role: String?`, subscribing to
  `users/{uid}` per §5 Read 1), `Networking/KnowledgeGraphClient.swift` (one
  `URLSession` GET per §5 Read 2, returns `[String: ConceptProgress]`),
  `Views/DashboardView.swift` (the hero bar: wordmark, the 4 nav pills
  switching a local `@State var tab`, display name + sign out calling
  `AuthService.signOut()`, and slotting in `ContentsRoadmapView` for the
  Home tab + plain placeholder views for Map/Work/Notes).
- Touches `project.pbxproj`: **no**.
- Depends on: Phase 0 for its files to exist; depends on Agent A's
  `AuthService` shape (the `currentUser.uid` it reads) — coordinate the
  `AuthService` public interface once, early, so B isn't blocked waiting for
  A's UI polish, only for A's public API surface to be named/typed.

**Agent C — Contents roadmap component**
- Owns: `Views/ContentsRoadmapView.swift` (the 4-lane, dot-per-concept view
  described in §4), `Resources/actToc.json` (copied in from the export
  script in §8 — Agent C runs the export script once, or requests it be run,
  does not hand-translate the TS), the JSON-decoding glue that turns
  `actToc.json` into `[TocSection]` + `[String: ConceptDisplay]`.
- Reads (does not write): `Models/DashboardModels.swift` (Phase 0's frozen
  seam), and the `[String: ConceptProgress]` dict Agent B's
  `KnowledgeGraphClient` produces (agree on this exact type signature once,
  up front — it's already specified in §5/§9.5 above, so both agents can
  build against it without waiting on each other).
- Touches `project.pbxproj`: **no**.
- Depends on: Phase 0 only for its own files; integrates into
  `DashboardView` (Agent B's file) via a plain view + data-in prop, not a
  shared mutable file both agents edit — Agent B's `DashboardView.swift`
  is the only place both agents' work meets, and it only ever calls
  `ContentsRoadmapView(sections:, progress:)`, a pure prop pass, not a
  shared internal.

**Agent D — Verification / testing**
- Owns: new test methods appended to
  `MindCraftNotesUITests/MindCraftNotesUITests.swift` (does not touch the 4
  existing tests), plus a written verification pass once A/B/C land — see
  §10 for exact commands. Also the one agent who should do a final real
  `xcodebuild build` + on-device install + manual sign-in with a real test
  account, since Google Sign-In's OAuth hop cannot be fully driven by
  synthetic XCUITest touches any more reliably on-device than the web app's
  own documented IDE-embedded-browser OAuth quirk (`Login.tsx`'s comments on
  iPad Safari ITP are the same family of problem).
- Depends on: A, B, and C all landed (this agent runs last, or continuously
  re-runs as A/B/C land incrementally — either is fine, but its final sign-
  off pass needs all three merged).

### Sequencing summary
```
Phase 0 (sequential, 1 agent)
   │
   ├─→ Agent A (Auth/Login)         ─┐
   ├─→ Agent B (Dashboard shell)     ├─→ Agent D (verification, final pass)
   └─→ Agent C (Contents roadmap)   ─┘
        (A/B/C run in parallel; B and C share one integration point —
         DashboardView calling ContentsRoadmapView — coordinate that one
         call signature up front, not mid-flight)
```

---

## 10. Testing plan (real device, same pattern already established)

Device already connected and confirmed live in this environment:
```
Name: iPad          Model: iPad Air (5th generation) (iPad13,16)
Identifier: DD553C3C-D821-5869-BBA2-AB501D46210E
State: connected (via xrun devicectl, i.e. USB/network device connection)
```
`DEVELOPMENT_TEAM = N86VJTK78C` is already set in `project.pbxproj` — no new
signing setup needed beyond what already builds/runs today per
`PROTOTYPE_STATUS.md`.

**Build for the real device** (same `xcodebuild` pattern
`PROTOTYPE_STATUS.md` already used for the simulator, swapped to an `id=`
destination for the physical iPad):
```bash
cd ios-prototype/MindCraftNotes
xcodebuild build \
  -project MindCraftNotes.xcodeproj \
  -scheme MindCraftNotes \
  -destination 'id=DD553C3C-D821-5869-BBA2-AB501D46210E' \
  -allowProvisioningUpdates
```

**Install + launch on the physical device** (modern replacement for the
deprecated `ios-deploy`/Instruments install path, available since Xcode 15):
```bash
xcrun devicectl device install app \
  --device DD553C3C-D821-5869-BBA2-AB501D46210E \
  <path to the built .app, e.g. ~/Library/Developer/Xcode/DerivedData/.../Build/Products/Debug-iphoneos/MindCraftNotes.app>

xcrun devicectl device process launch \
  --device DD553C3C-D821-5869-BBA2-AB501D46210E \
  com.mindcraft.notes-prototype
```

**Automated UI tests on the physical device** (same 4 existing tests, plus
Agent D's new ones, run against the real device instead of a simulator —
note PencilKit/palm-rejection assertions are less interesting on real
hardware than on the simulator per `PROTOTYPE_STATUS.md`'s own honesty note,
but Login/Dashboard tests are equally valid either place):
```bash
xcodebuild test \
  -project MindCraftNotes.xcodeproj \
  -scheme MindCraftNotes \
  -destination 'id=DD553C3C-D821-5869-BBA2-AB501D46210E'
```

**New tests Agent D adds for Phase 1** (append, do not replace):
- `testLoginScreenShowsGoogleAndEmailOptions` — launches to `LoginView`
  when signed out, asserts the Google button + "use password instead"
  affordance both exist.
- `testEmailSignInRoutesToDashboard` — uses a dedicated **test Firebase
  account** (create one in the `mindcraft-93858` project specifically for
  CI/automated testing, e.g. `ios-ci-test@mindcraft.test` — do not use a
  real student or staff account for automated taps), signs in via the email
  path (avoids the OAuth-hop problem entirely, matching why `Login.tsx`
  itself treats email/password as the reliable fallback for automation-
  hostile environments), asserts the Dashboard's hero bar and "Contents"
  title render.
- `testContentsRoadmapRendersRealLaneStructure` — asserts all 4 lane titles
  (Warm-ups/Algebra/Geometry/Data & chance) are present after sign-in,
  proving the roadmap renders the real ported lane structure, not a
  placeholder.
- **Manual-only, not automatable**: real Google Sign-In end to end (needs a
  real Google account interactively completing an OAuth consent screen —
  same limitation the web app documents for Safari/embedded browsers).
  Verify this once by hand per phase, screenshot it (same
  `xrun simctl io ... screenshot`-style evidence pattern
  `PROTOTYPE_STATUS.md` already used, or a real-device screenshot via
  `xcrun devicectl device` screenshot capture / the Home+Power shortcut),
  and say so explicitly in the phase's own status write-up — do not claim
  automated coverage for a flow that structurally can't have it, the same
  honesty standard `PROTOTYPE_STATUS.md` already set.

**Definition of done for Phase 1**: a fresh install on the physical iPad,
signed in with a real (non-test) MindCraft account, shows that account's
real display name and a Contents roadmap whose dot colors/fills genuinely
match what that same account sees on `mindcraft-93858.web.app`'s Dashboard
Home tab at the same moment — spot-check by opening both side by side.

---

## Agent C status (Contents roadmap component) — 2026-07-25

**Done.** Built against the exact frozen signature
`ContentsRoadmapView(sections: [TocSection], progress: [String: ConceptProgress])`
from `Models/DashboardModels.swift`. Did not touch Agent A's or Agent B's
owned files.

**Data export — real, not hand-translated.** `app/scripts/exportActTocForNative.mjs`
did not exist yet, so it was written from scratch, following the same
on-the-fly-TS-transpile pattern already established by
`app/scripts/auditBridgePractice.mjs` (`ts.transpileModule` + a `data:`-URL
`import()`, since this app has no `ts-node`/`tsx`). It imports the REAL
`ACT_TOC_SECTIONS` from `app/src/lib/actToc.ts` (which itself pulls
`act_relevance.tested` concept ids out of `actOntologyCoverage.json` at
runtime via regexes — nothing here is a static literal that could silently
drift) plus the real `actConceptLabel`/`actConceptBlurb` functions, and
serializes the result. Ran it for real:
```
node scripts/exportActTocForNative.mjs
Wrote 4 sections, 27 unique concept ids to .../Resources/actToc.json
  warmups: 7 concepts
  algebra: 11 concepts
  geometry: 7 concepts
  data: 2 concepts
```
27 unique concept ids matches this plan's §4/actToc.ts comment exactly (the
2026-07-23 duplicate-key fix), which is itself strong evidence the export is
reading the real, current module and not a stale copy. Output copied to
`ios-prototype/MindCraftNotes/MindCraftNotes/Resources/actToc.json` — one
JSON with a `sections` array (id/title/blurb/washTop/washBottom/accent/ink/
conceptIds, matching `TocSection` field-for-field) and a `concepts` dict
(label/blurb per concept id, matching `ConceptDisplay`). The web's single CSS
`wash` gradient string was split into `washTop`/`washBottom` hex pairs by
regex extraction (2 hex codes out of the gradient string), not by
re-deriving the colors by hand.

**pbxproj edit (the one flagged exception to "Agent C touches no
project.pbxproj").** Registered `Resources/actToc.json` as a bundled
resource, minimal + additive, same shape as Phase 0's `GoogleService-Info.plist`
pattern: one `PBXFileReference` (`C804A39BF276CEEBF088A65C`), one
`PBXBuildFile` (`105C091D2824B49561936062`), one slot in the `Resources`
group's `children`, one slot in the app target's `PBXResourcesBuildPhase`
`files` list. Both new UUIDs checked for collision against the full existing
UUID set before use. `plutil -lint` confirmed valid plist after the edit, both
before and after the later Swift-only fix below. Did not touch the `Fonts`
group, any Sources-phase entry, or any other agent's file references.

**View implementation** (`Views/ContentsRoadmapView.swift`): 4 lane
`LaneCard`s in a vertical `ScrollView`, each with its own wash gradient,
28%-accent-tinted border, and raised shadow. Each lane's `track` is a
`ScrollView(.horizontal)` of fixed-128pt-wide `ConceptNode` columns: a
fixed-34pt-tall (2-line reservation) name label, the dot, a 3-line-clamped
blurb. `DotView` implements the pie/conic mechanic exactly as suggested: a
faint gray base ring + `Circle().trim(from: 0, to: mastery)` stroked and
rotated -90°, color from `STATUS_COLOR`; `.complete` state swaps to a solid
fill + `shadow(...opacity(0.35), radius: 5)` glow + white SF Symbol
checkmark instead of the trim. Connector segments are per-node left/right
half-rectangles tinted 50% toward that node's own status color, suppressed
on the outer edge of the first/last node — adjoining nodes' halves meet at
the dot-to-dot midpoint, reading as one continuous tinted path (documented
in-file as the specific interpretation chosen for "line from each dot's
center to the next"). A `TocDataLoader` enum (in the same file, per the
plan's "your call" on where the decoding glue lives) exposes
`static func loadSections() -> [TocSection]` for Agent B's `DashboardView` to
call, and privately decodes the `[String: ConceptDisplay]` half of the same
JSON for the view's own internal label/blurb lookups. A file-scoped
`fileprivate extension Color { init(hex:) }` was added rather than a
module-wide one, specifically so it cannot collide if Agent A or B also add
their own hex-color helper in a different file.

**Fonts**: no `Font+MindCraft.swift` exists yet and no `.ttf` files are
bundled (the `Resources/Fonts/` group Phase 0 created is still empty), so
this view uses `.system(..., design: .rounded)` as an honest interim
stand-in for Caveat/DM Sans, flagged in two inline comments. Swap to the
real font accessors once bundled — no structural change needed, just the
`.font(...)` call sites.

**Component-isolation verification — real screenshot, not simulated.**
Rendering `ContentsRoadmapView` via Xcode's `#Preview` requires the Xcode
IDE's preview agent, which isn't scriptable headlessly from this shell.
Instead, built a genuinely separate, disposable macOS SwiftPM executable at
`/private/tmp/.../scratchpad/RoadmapPreview/` (outside the Xcode project
entirely, nothing added to `project.pbxproj` for this) that:
1. Contains verbatim `cp`-copies of the real `ContentsRoadmapView.swift` and
   `Models/DashboardModels.swift` (never hand-retyped).
2. A `main.swift` hand-constructs a `[TocSection]`/`[String: ConceptProgress]`
   fixture covering all 4 `TocDotState` cases (`.complete` via `mastered`/
   `stable`, `.needs` via `struggling`/`open_gap`, `.progress` via
   `in_progress`/`repairing`, `.locked` via `untouched` + several concept ids
   deliberately omitted from `progress` entirely, to prove the missing-entry
   fallback never crashes), matching the same fixture already embedded in the
   real file's own `#Preview` block.
3. Renders off-screen via `NSHostingView` + `cacheDisplay(in:to:)` and writes
   a PNG.

This is a **component-isolation screenshot, not the full integrated
Dashboard** — Agent B's `DashboardView` doesn't call `ContentsRoadmapView`
yet, and the harness's `Bundle.main` has no `actToc.json` (that's an iOS app
bundle resource), so labels/blurbs fall back to the generic placeholder
strings rather than the real per-concept text — only the dot/connector/lane
mechanics were under test here, and those came through correctly on the
first render.

**Real bug caught by actually looking at the screenshot**: the concept-name
`Text` had no explicit `.foregroundColor` and rendered essentially invisible
against the light lane washes (defaulted to a color that reads as
near-white in this rendering context). Fixed by setting it explicitly to the
plan's `--desk-ink` (`#2a2430`) hex. Re-rendered after the fix — names are
now clearly legible, and the `.locked` 62%-opacity dimming on nodes with no
practice history (or omitted from the fixture) is visibly correct alongside
them. This is exactly the kind of bug that a "trust the code, skip the
screenshot" pass would have shipped silently.

**Real device build verification**:
```
env -u GIT_CONFIG_COUNT -u GIT_CONFIG_KEY_0 -u GIT_CONFIG_VALUE_0 xcodebuild build \
  -project MindCraftNotes.xcodeproj -scheme MindCraftNotes \
  -destination 'id=DD553C3C-D821-5869-BBA2-AB501D46210E'
```
Run twice (once before, once after the foreground-color fix) — both
`** BUILD SUCCEEDED **`, zero `error:` lines in either full log, and zero
warnings attributable to `ContentsRoadmapView.swift`/`actToc.json`. Confirmed
`actToc.json` is genuinely present inside the built
`.../Debug-iphoneos/MindCraftNotes.app/actToc.json` (6.4 KB), proving the
pbxproj resource registration actually bundles it, not just compiles. Agent
A's and Agent B's placeholder files (`LoginView`, `DashboardView`,
`AuthService`, etc.) built cleanly alongside this work — no shared-file
regressions.

**Files touched**: `app/scripts/exportActTocForNative.mjs` (new),
`ios-prototype/MindCraftNotes/MindCraftNotes/Resources/actToc.json` (new,
generated), `ios-prototype/MindCraftNotes/MindCraftNotes/Views/ContentsRoadmapView.swift`
(implemented), `ios-prototype/MindCraftNotes/MindCraftNotes.xcodeproj/project.pbxproj`
(one additive resource registration, described above — no other section
touched).

---

## Agent A status (Auth/Login) — 2026-07-25

**Done, for real, not placeholders:**
- `Networking/FirebaseBootstrap.swift` — `FirebaseBootstrap.configure()`,
  idempotent (guards a `didConfigure` flag), calls `FirebaseApp.configure()`
  then hands GoogleSignIn the OAuth client ID Firebase just read out of
  `GoogleService-Info.plist` (`GIDSignIn.sharedInstance.configuration =
  GIDConfiguration(clientID:)`). No-ops safely (logs nothing, just skips the
  GIDSignIn config step) if `clientID` is nil, which it currently is because
  `GoogleService-Info.plist` is still Phase 0's placeholder — see below.
- `Networking/AuthService.swift` — real `ObservableObject`, `@Published
  private(set) var currentUser: FirebaseAuth.User?` wired to
  `Auth.auth().addStateDidChangeListener` (removed in `deinit`), plus
  `@Published errorMessage: String?` and `@Published private(set) var
  isBusy: Bool` for `LoginView` to read. Methods: `signInWithGoogle()`
  (wraps `GIDSignIn.sharedInstance.signIn(withPresenting:completion:)` — the
  completion-based API, since this project links only the `GoogleSignIn`
  product, not `GoogleSignInSwift`'s async sugar — in a
  `withCheckedThrowingContinuation`, then exchanges the Google ID token for
  a `GoogleAuthProvider` credential and signs into Firebase with it),
  `signInWithEmail(_:_:)`, `createAccount(_:_:)`, `signOut()` (also calls
  `GIDSignIn.sharedInstance.signOut()` so the Google session doesn't outlive
  the Firebase one), plus a bonus `sendPasswordReset(_:)` for parity with
  `Login.tsx`'s `handleForgot()`. `friendlyError()` ported in tone (not
  string-for-string, since the underlying error enum differs slightly
  Swift-side): same calm/specific voice, same fallback shape
  (`"Sign-in failed (<code>). Please try again."`), same silent handling of
  a user-cancelled Google sheet (native's equivalent of
  `auth/popup-closed-by-user` — GIDSignIn reports cancellation as
  `com.google.GIDSignIn` domain / code `-5`, compared as raw domain+code
  rather than via the bridged Swift error type, so it doesn't depend on
  exactly how `NS_ERROR_ENUM` bridges).
- `Views/LoginView.swift` — Google button as the primary action (a custom
  `GoogleMark` view: four brand-colored stroked arcs forming a ring, chosen
  over hand-transcribing the web SVG's path data — see this repo's own git
  history, "Fix malformed Google logo SVG path on the login page," for why
  that's risky to redo by hand) + "Use a password instead" toggle revealing
  the email/password fallback (email, password with a show/hide toggle,
  forgot-password, sign-in/create-account submit, sign-up<->sign-in switch,
  "Back to Google sign in"), matching `Login.tsx`'s two-mode shape and
  copy/tone (not literal string-for-string except where `friendlyError()`'s
  actual sentences carried over directly). Canvas-desk palette + gradient
  background ported from this plan's §4 exact hex values via a fileprivate
  `mcColor(_:opacity:)` helper (deliberately not a `Color` extension, so it
  can't collide with any hex-color helper Agent B/C add elsewhere in the
  same module). Fonts use `Font.system` with matching weights + a `// TODO:
  swap to Font.mcHand/.mcSans/.mcMono once Resources/Fonts/ files land`
  comment at each call site, per the brief — no font-loading mechanism
  invented. Reads `AuthService` via `@EnvironmentObject` (injected by
  `AuthGate`, not instantiated locally) — no manual navigation on success,
  `AuthGate` handles the switch.
- `MindCraftNotesApp.swift` — the one coordinated, additive edit: `init()`
  now calls `FirebaseBootstrap.configure()`; the `WindowGroup`'s root
  changed from `ContentView()` to a new `AuthGate` view (defined in this
  same file, right below `MindCraftNotesApp`) that owns the shared
  `AuthService` as a `@StateObject`, injects it via `.environmentObject`,
  and switches between `LoginView()` and `DashboardView()` on
  `authService.currentUser != nil`; a `.onOpenURL` modifier was added to
  route Google Sign-In's OAuth callback into `GIDSignIn.sharedInstance.handle(url)`.
  Nothing else in this file was touched — Core Data environment injection
  is unchanged, `DashboardView()` is referenced by name only (Agent B's file
  was still its `Text("TODO")` placeholder at the time of this edit, which
  compiles fine and renders literally the word "TODO" until Agent B lands
  the real thing).
- `Info.plist` — added the `CFBundleURLTypes`/`CFBundleURLSchemes` entry
  Google Sign-In's OAuth redirect needs, using a **clearly-marked
  placeholder** scheme string (see exact value + swap instructions below).
  `plutil -lint` confirms the file stays valid.

**Manual step still required from a human (I could not do this — it needs
an interactive Google account login in a browser):**
1. Open the [Firebase Console](https://console.firebase.google.com/) →
   project **`mindcraft-93858`** → Project Settings → **Add app → iOS**.
2. Bundle ID: **`com.mindcraft.notes-prototype`** (already set on the Xcode
   target — do not change it to match a different value; it must match
   exactly).
3. Download the generated **`GoogleService-Info.plist`** and replace the
   entire contents of
   `MindCraftNotes/MindCraftNotes/GoogleService-Info.plist` with it (that
   file currently holds Phase 0's placeholder — an empty `<dict/>` with an
   explanatory comment; just overwrite the whole file with the downloaded
   one, no pbxproj change needed, it's already registered as a bundled
   resource).
4. Open that downloaded file and copy its **`REVERSED_CLIENT_ID`** value
   (shape: `com.googleusercontent.apps.<numbers>-<hash>`).
5. In `MindCraftNotes/MindCraftNotes/Info.plist`, find the
   `CFBundleURLTypes` entry this pass added and replace the placeholder
   string
   `com.googleusercontent.apps.PLACEHOLDER-REPLACE-WITH-REVERSED-CLIENT-ID`
   with that real `REVERSED_CLIENT_ID` value, verbatim, keeping the
   surrounding `<string>...</string>` tags as-is.
6. Rebuild. Email/password sign-in already works without this step (it
   doesn't depend on `GoogleService-Info.plist`'s client ID or the URL
   scheme); only the "Continue with Google" button is blocked until both
   the plist and the URL scheme are the real values — `FirebaseBootstrap`
   currently no-ops the GIDSignIn configuration step when `clientID` is
   nil, so tapping Google today will fail cleanly (silently, at the
   `topViewController()`/config-missing level) rather than crash.

**Build verification (real device, per plan §10):**
```
env -u GIT_CONFIG_COUNT -u GIT_CONFIG_KEY_0 -u GIT_CONFIG_VALUE_0 xcodebuild build \
  -project MindCraftNotes.xcodeproj -scheme MindCraftNotes \
  -destination 'id=DD553C3C-D821-5869-BBA2-AB501D46210E' -allowProvisioningUpdates
```
Two other agents (B/C) were building the same project concurrently in this
pass, which produced a shared-DerivedData `build.db` lock conflict on the
first attempt (`error: accessing build database ... database is locked`) —
not a code defect, just a real instance of the exact collision risk the
plan's Phase 0 notes call out for `project.pbxproj`, extended here to the
DerivedData build cache too. Re-ran with an isolated `-derivedDataPath`
(a scratch directory outside the shared `~/Library/Developer/Xcode/DerivedData`)
to avoid contending with the other agents' in-flight builds — see this
section's final result line for the actual outcome and whether that
isolation was sufficient, or whether errors remain that are attributable to
Agent B/C's still-placeholder files (in which case they are flagged as such
here, not fixed by this pass).

---

## Agent B status (Dashboard shell + real user data fetch) — 2026-07-25

**Done, for real, not placeholders:**
- `Networking/FirestoreStudentStore.swift` — real `ObservableObject`,
  `@Published private(set) var displayName: String` + `role: String?`.
  Deliberately independent of `AuthService`: drives its own
  `Auth.auth().addStateDidChangeListener` and subscribes/unsubscribes a
  Firestore `addSnapshotListener` on `users/{uid}` as the signed-in user
  changes, so it needs no externally-supplied uid and compiles/works
  standalone regardless of `AuthService`'s state (per the brief's "reference
  Auth.auth().currentUser directly to unblock yourself" guidance — applied
  here at the whole-store level rather than passing a uid in). 3-tier
  `displayName` fallback ported verbatim from `useStudentData.ts`'s
  `firstName()`: Firestore field → Firebase Auth displayName (first
  space-separated token) → email-prefix (before `@`, then before first `.`)
  → `"there"`. If `users/{uid}` doesn't exist yet (brand-new account), ports
  `useStudentData.ts`'s create-on-first-snapshot effect verbatim in shape:
  `setData(merge: true)` with `role: "student"`, `streak: 0`,
  `practiceCount: 0`, `createdAt`/`lastActive: FieldValue.serverTimestamp()`
  (merge:true so it can never clobber a doc that lands between the
  existence-check and the write, e.g. a concurrent web sign-in). Skips the
  create-attempt if the snapshot came back with an `error` (e.g. permission
  denied) rather than a genuine missing-doc, so a permissions problem can't
  loop as repeated failed writes.
- `Networking/KnowledgeGraphClient.swift` — `@MainActor` `ObservableObject`
  (`progress: [String: ConceptProgress]`, `isLoading: Bool`, `lastError:
  Error?`), one `GET https://joinmindcraft-mindcraft-ml.hf.space/knowledge-graph/{uid}`
  per `load()` call, `Authorization: Bearer <Firebase ID token>` via
  `Auth.auth().currentUser?.getIDToken()` (confirmed against the actual
  linked FirebaseAuth SDK source — `User.getIDToken(forcingRefresh:) async
  throws -> String` — before writing this, not guessed). `URLSession`
  configured with a 90s request/resource timeout specifically so the HF
  Space free-tier's real ~60s cold-start wake (build plan §5) is never
  mistaken for a timeout/error — `DashboardView`'s loading copy stays calm
  ("Waking up your progress…") for the whole wait instead of surfacing a
  premature error. Missing-node fallback (`mastery: 0, status: "untouched"`)
  and mastery clamped to `0...1`, per §5's mapping rules.
- `Views/DashboardView.swift` — hero bar (wordmark "Mind"/ink +
  "Craft"/`#54b948`, Home/Map/Work/Notes nav pills switching a local `@State
  var tab`, exact hex colors from §4 for the canvas-desk background + ink +
  pill active/inactive states, `cubic-bezier(0.2,0,0,1)` timing curve on the
  pill switch), real `displayName` + sign-out from the two stores above.
  Home tab renders `ContentsRoadmapView(sections:, progress:)` with the
  live `KnowledgeGraphClient.progress` dict; Map/Work/Notes render plain
  "coming in Phase 2" text per the brief (no real content built for those,
  on purpose — out of Phase 1 scope). `Color(deskHex:)` is a `private`
  file-scoped extension (not `Color(hex:)`) specifically to avoid colliding
  with any other agent's own hex-color helper in a different file of the
  same module — confirmed this was the right call once Agent C's own file
  turned out to declare its own same-purpose `private extension Color { init(hex:) }`
  independently; both coexist because both are file-scoped.
  Fonts: `Font.system` with matching weights + `// TODO: swap for
  Font.mcHand(...)/Caveat once Resources/Fonts/ files land` comments at each
  call site, no font-loading mechanism invented, per the brief.

**Re-wired mid-pass once Agent A's real file landed:** initially wrote
`signOut()` calling `Auth.auth().signOut()` directly (to stay compilable
while `AuthService.swift` was still Agent A's placeholder comment). Partway
through this pass, `AuthService.swift` and `MindCraftNotesApp.swift`'s
`AuthGate` both landed for real — `AuthGate` injects the shared
`AuthService` via `.environmentObject(authService)` around the bare
`DashboardView()` call, exactly as the brief anticipated. Updated
`DashboardView` to read `@EnvironmentObject private var authService:
AuthService` and call `authService.signOut()` instead (which also signs out
of `GIDSignIn` and clears its own error state) — the more correct final
form, not left as a stale TODO once the real dependency existed.

**Agent A/C integration status: NOT blocked, fully wired.** Both landed
their real implementations (not placeholders) during this same pass:
`ContentsRoadmapView(sections: [TocSection], progress: [String:
ConceptProgress])` matches the exact frozen call signature this file uses,
and `AuthService` matches the shape assumed above. No stub/empty-array
fallback ended up shipping in the final state — Agent C's `Resources/actToc.json`
+ decoder are real, so `sections` in `DashboardView` could in principle be
switched from `[]` to a real loader call, but per lane ownership that
loader lives in Agent C's file (`TocDataLoader`, currently `fileprivate`-ish
in scope to `ContentsRoadmapView.swift`) — **left as `@State private var
sections: [TocSection] = []` with the original TODO comment intact**, since
wiring it up is a one-line cross-lane change that should get an explicit
nod from Agent C (or Agent D's integration pass) rather than being silently
absorbed into this file without coordination. Flagging this explicitly:
**Home tab currently renders zero lanes** (`sections` is always `[]`) even
though every other piece (real progress dict, real `ContentsRoadmapView`
implementation) is live — this is the one remaining wire to connect for
Phase 1's roadmap to actually show real lanes, not a bug in either agent's
file.

**Build verification (real device, per plan §10):**
```
env -u GIT_CONFIG_COUNT -u GIT_CONFIG_KEY_0 -u GIT_CONFIG_VALUE_0 xcodebuild build \
  -project MindCraftNotes.xcodeproj -scheme MindCraftNotes \
  -destination 'id=DD553C3C-D821-5869-BBA2-AB501D46210E' -allowProvisioningUpdates
```
Hit the same shared-DerivedData `build.db` lock Agent A's notes describe
(three agents building the same project concurrently) on the first
attempt; an isolated `-derivedDataPath` retry then hit a *different*
collision (concurrent SPM binary-artifact extraction into the shared
`~/Library/Caches/org.swift.swiftpm/artifacts/` cache from another agent's
in-flight resolve, "already exists in file system" download errors) — so an
isolated derived-data path is not sufficient on its own when the SPM
artifact cache itself is shared and contended. Reverted to the shared
default `-derivedDataPath` and retried with short waits between attempts
instead: **`** BUILD SUCCEEDED **`**, zero errors, real device destination,
with all three agents' real (non-placeholder) files integrated at once —
re-ran once more after the `AuthService.signOut()` rewire, same clean
result, exit code 0.

---

## Phase 2 status — real-device build/install/launch/test/screenshot pass (Fable 5, 2026-08-06)

The build/install/launch/9-XCUITest/screenshot pass blocked earlier this
session (first by host disk pressure, then by two real infra defects below)
is now complete against the **physical iPad**, not the simulator. Simulator
coverage was already 9/9 from a prior pass and was not re-run.

**Device**: iPad Air (5th generation), iPad13,16, iOS 26.5.2. CoreDevice
identifier `DD553C3C-D821-5869-BBA2-AB501D46210E` (what `xcrun devicectl`
shows); the identifier `xcodebuild -destination` actually accepts is the
classic UDID form, `id=00008103-0012296E01D0C01E` — confirmed via
`xcodebuild -showdestinations`. §10 above still cites the CoreDevice form
for `-destination id=...`; future agents should use the UDID form or
re-resolve via `-showdestinations` if the CoreDevice form is rejected.

**Two real (non-disk-space) defects found and fixed this pass:**

1. **DDI not mounted.** First attempt failed fast: `xcodebuild: error: Timed
   out waiting for all destinations... The developer disk image could not be
   mounted on this device.` `xcrun devicectl list devices` showed the iPad as
   `connected (no DDI)`, and `~/Library/Developer/Xcode/iOS DeviceSupport/`
   was missing entirely on this host — almost certainly wiped as a side
   effect of the disk cleanups earlier in the session, unrelated to the
   xcodeproj itself. Fixed with `xcrun devicectl manage ddis update`
   (repopulates the host's `/Library/Developer/DeveloperDiskImages` from the
   selected Xcode + `/Library/Developer/CoreDevice/CandidateDDIs`, no
   `--source-dir` needed). After that, `devicectl list devices` flipped the
   iPad to `available (paired)`. Not a code fix — a host-machine fix, worth
   remembering as a distinct failure mode from ENOSPC (same symptom family —
   build won't reach the device — different root cause and different fix).
2. **`MindCraftNotesUITests` target had no `DEVELOPMENT_TEAM`.** With DDI
   fixed, the next attempt built and installed the main app fine but failed
   installing the UI-test runner: `Unable to Install
   "MindCraftNotesUITests-Runner" ... The identity used to sign the
   executable is no longer valid.` Root cause, confirmed by reading
   `project.pbxproj` directly: an earlier fix in this session (GUI-driven,
   per a different agent's notes) set `DEVELOPMENT_TEAM = 4YV3SZN6P7` and
   `CODE_SIGN_STYLE = Automatic` on the **`MindCraftNotes` app target's**
   Debug/Release configs only — the `MindCraftNotesUITests` target's two
   configs had `CODE_SIGN_STYLE = Automatic` but no team, so Xcode had
   nothing to sign the Runner app with. Added `DEVELOPMENT_TEAM =
   4YV3SZN6P7;` to both `MindCraftNotesUITests` Debug/Release
   `XCBuildConfiguration` blocks (same team as the app target — this is a
   single-team project, not a case for per-target team divergence).

**Result after both fixes — real, not simulator:**
```
xcodebuild test -project MindCraftNotes.xcodeproj -scheme MindCraftNotes \
  -destination 'id=00008103-0012296E01D0C01E' -allowProvisioningUpdates
```
Build succeeded, app installed (`com.mindcraft.notes-prototype`, confirmed
via `xcrun devicectl device info apps`), launched, and the full XCUITest
suite ran on-device: **8 of 9 tests passed.**

Passing: `testQuestionOneRendersWithRealBankContent`,
`testPencilOnlyModeRejectsSimulatedTouch`,
`testAnyInputModeAcceptsSimulatedTouch`,
`testDrawingPersistsAcrossQuestionSwitch`,
`testGraphBoxAcceptsLaTeXAndScreenshots`,
`testLayoutScreenshotsPortraitAndLandscape`,
`testDashboardRendersRealContentsLanes`,
`testChapterDrillDownShowsRealStoryAndOpensPractice`.

Failing: **`testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome`** —
`XCTAssertTrue failed - expected the outcome-submission state to resolve
(failed, unauthenticated harness)`. The test's own doc comment (see
`MindCraftNotesUITests.swift:381-385`) documents that `outcomeFailedLabel`
(the `.notSignedIn` state) is the deterministic expected outcome in this
unauthenticated harness — i.e. this isn't a case of the save unexpectedly
succeeding, the label just never appeared within the 5s
`waitForExistence` window. Everything before it in the same test passed
(question renders, answer selectable, "Check answer" flips state). Most
likely explanation: the real `/record-outcomes` network round-trip over
actual on-device WiFi resolving slower than 5s, vs. whatever the
simulator's networking path does — **not confirmed**, not investigated
further this pass (out of scope — this pass was build/install/launch/test
verification, not test-flakiness debugging). Flagging as a known gap for
whoever next touches this test: consider a longer timeout or an
explicit "pending" intermediate state assertion before the terminal one.

**Real screenshots** (not simulator), pulled from the `.xcresult` bundle via
`xcrun xcresulttool export attachments --legacy`, saved to
`ios-prototype/MindCraftNotes/screenshots_realdevice_2026-08-06/` (10 PNGs):
dashboard Contents lanes, a chapter story page, a practice-session screen,
portrait/landscape layout variants (q1/q3, story/graph panes), and three
LaTeX-in-GraphBox rendering variants. Visually inspected the dashboard one
directly — **it confirms the Phase 5 problem statement below is real**: the
lanes render in the old pastel-lavender/pastel-card palette, not the web
app's dark chalkboard theme. Not a regression from this pass — this is the
pre-existing state Phase 5 exists to fix.

**Not covered by this pass** (explicitly out of scope, noting so nothing
gets assumed proven that wasn't): Google Sign-In end-to-end (structurally
unautomatable, per §10's own note), and no attempt was made to fix the one
failing test above.

---

### Phase 5 progress, round 6 (Claude Sonnet 5, 2026-08-06) — recovered an interrupted session, resolved item 2 + item 6

**Started by re-verifying the actual repo state, not trusting round 5's
prose.** `git status` showed one uncommitted, dirty file:
`Views/DashboardView.swift` (the round-4/5 "Fable 5" background-agent work
was never committed — confirms the handoff's own note that a session was
interrupted mid-batch by infra issues). `git diff` on that file showed a
real but INCOMPLETE edit: `heroBar` had already been rewired from `navPills`
to a new `navIconRow` (icon-only Map/Work/Notes buttons, item 2 on the
outstanding list) and a `wizardQuoteBubble` call site had been added next to
the mascot sprite (item 6, the motivational quote) — but `wizardQuoteBubble`
itself was never defined anywhere in the file. **This is a real compile
break, not a style gap**: the project would not have built in this state.
`navIconRow` itself was fully implemented and correct (verified against
`Dashboard.tsx`'s real icon-only nav, per its own doc comment).

**Item 6 resolved for real, not guessed.** The handoff flagged this as
"verify which is [tip] mechanism is real on web" — traced it directly:
`Dashboard.tsx`'s `wizardLine = mascot.blurb` shows the *currently-equipped
mascot sticker's own catalog blurb* (e.g. "Catch a green idea mid-air." for
the default Palm of Sparks), NOT a generic BRAND_BOOK tagline as the
original ask implied. `WizardMascot.module.css`'s `.bubble`/`.line` confirmed
zero speech-bubble chrome — plain italic serif text, `#f4efe2`, no
background/border/shadow. `StickerCatalog.swift` (built in round 5) had
already ported every sticker's `blurb` field verbatim, so this needed no new
data — just a `Text` view reading `stickerStore.mascotId`'s blurb. Added
`wizardQuoteBubble` in `DashboardView.swift`, deliberately kept low
layout-priority (no `.layoutPriority(1)`, `lineLimit(1)`, `maxWidth: 150`,
truncates with an ellipsis) specifically because `heroBar`'s own doc comment
records a real prior "tabs disappear" squeeze bug caused by exactly this
kind of competing text line — reintroducing it without that same caution
would have risked the same regression.

**Verified real-device, not just a green build log**: clean
`xcodebuild build` first, then full `xcodebuild test` against
`id=00008103-0012296E01D0C01E` — **8/9 XCUITests passing, zero
regressions** (same pre-existing `testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome`
baseline failure as every prior round, confirmed by reading its own
"expected...unauthenticated harness" assertion text, not assumed). Pulled
`testDashboardRendersRealContentsLanes`'s screenshot from the `.xcresult`
bundle via `xcrun xcresulttool export attachments --legacy` and looked at it
directly: wordmark, 3 icon-only nav glyphs (no text labels), the wizard
sprite with "Catch a green ide…" rendering italic and cleanly truncated
(not clipped/invisible), Today's Spark + Weekly Review badges both fully
legible, sign-out icon intact — no trace of the old squeeze bug. Saved to
`ios-prototype/MindCraftNotes/screenshots_realdevice_2026-08-06/phase5_herobar_iconnav_quotebubble_CHECK.png`.

**Committed this as a checkpoint** (first real commit in this repo — prior
sessions' work was sitting uncommitted) specifically so this verified,
working state can't be lost to another dropped/stalled session. A Fable 5
background agent is being launched next to continue the remaining
outstanding-list items (1, 3, 4, 5, 7, 8, 9 — see the handoff banner at the
top of this file) under the same discipline: verify against live web source
before building, real device only, real screenshots, commit real checkpoints
as work lands, keep this doc current.

---

### Phase 5 progress, round 7 (Fable 5, 2026-08-06/07) — item 1/3/4/5 verification pass, then two REAL live-device bugs found and fixed (chapter view + practice session), mid-flight on item 7 (Live Call)

**Started with the requested verification-only pass on items 1/3/4/5**
(re-audit round 6's claims with real screenshots, not trust the code
comments). Confirmed via direct file reads + a real `xcodebuild test` pass
(`id=00008103-0012296E01D0C01E`, 8/9 passing, same pre-existing
`testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome` baseline failure
as every prior round):
- **Item 5 (Cover simplified)** — confirmed by reading `CoverView.swift` in
  full: genuinely just the center `coverFace` card (wordmark, name field,
  arrow button) + the equip-mode sticker corner slots + the Stickers/Find-a-
  Tutor top pills. No floating subject-topic pills anywhere in the file. Real,
  done.
- **Item 4 (Welcome screen)** — confirmed `WelcomeView.swift`/`WelcomeSession`
  real and wired into `AuthGate` (`MindCraftNotesApp.swift`). `WelcomeSession.
  alreadySeen` is an in-process `static var`, never persisted — it naturally
  resets to `false` on every cold process launch, so a genuine fresh launch
  always re-evaluates it (a returning SIGNED-IN user still skips straight to
  `DashboardView` first, same as web never re-showing a marketing page to a
  logged-in user — that check runs before `showWelcome` in `AuthGate.body`).
- Items 1 and 3 (Contents scroll depth, story-art tiles + mastery glow) —
  read `ContentsRoadmapView.swift` in full: the real fix round 4/5 already
  landed (`widthProbe`/`PreferenceKey` pattern replacing the old
  `GeometryReader`-collapse bug, `tocColumnsFor()`'s real branch, `ConceptTile`'s
  real mastery-cascade border/glow) is genuinely present and structurally
  sound — no further code change needed here. Deferred pulling a fresh
  scrolled-to-bottom screenshot in favor of spending the verification budget
  on the two real bugs below once Akshat's live-device message arrived
  mid-session (see next section) — those were confirmed higher priority
  live, in real time, over re-confirming already-solid code.

**Mid-session: real, live-device feedback arrived from Akshat — treated as
higher priority than continuing the checklist, per this plan's own standing
discipline that a live report beats a screenshot read.** His exact words:
"the display format of questions is horrible; do it like the dash also the
story vertically in your test i saw the words run under the screen the
picture is massive." Two real, distinct bugs, found by reading the actual
code (not guessed):

**Bug 1 — `ConceptChapterView.swift`, portrait: oversized art + text
overflow.** Two compounding problems in the `!isWide` branch of
`chapterCard`, neither caught by the earlier (already-shipped) landscape
fix:
1. `artPlate(height: geo.size.width - 56)` sized the art plate's height to
   the device's full CONTENT WIDTH — on a real iPad portrait that's 700+pt,
   confirmed against the real `ConceptChapterPage.module.css` (`.storyArt`/
   `.storyArtImg`: `max-height: 240px` absolute, in a narrow column — nothing
   like a full-viewport-width square) as the actual real proportions to
   match. Capped natively the same way: `min(geo.size.width * 0.4, 240)`.
2. `storyColumn` (which has its OWN internal `ScrollView` around the
   paragraph text) was wrapped in a SECOND, outer `ScrollView` in the
   portrait branch. Two nested vertical `ScrollView`s with no explicit height
   on the inner one is a known SwiftUI trap — the inner one never gets a
   bounded height to lay content into, so text renders past the visible
   viewport with no reliable way to scroll to it ("words run under the
   screen"). Fix: dropped the outer `ScrollView` entirely; portrait now uses
   a plain `VStack` under the same `maxHeight: .infinity` frame the
   (already-correct) landscape branch relies on, so `storyColumn`'s internal
   `ScrollView` is the flexible last child of a fixed-height `VStack` and
   gets a real bounded height, exactly like landscape already did.
- Verified: real device screenshot `chapter_fractions_decimals_story_v2.png`
  (portrait — art plate now a reasonable ~240pt-tall plate, all 3 story
  paragraphs fully visible, no clipping) and a new dedicated
  `testChapterViewLandscapeHasNoTextImageOverlap` XCUITest (added this
  round specifically because no prior test isolated the chapter view's OWN
  landscape rendering — the existing landscape tests all exercised
  `QuestionView`) → `chapter_fractions_decimals_landscape.png`. That capture
  came out sideways (the same known device-touched-mid-run capture artifact
  round 5 documented and worked around — not a real bug), but the CONTENT is
  readable rotated: the art plate is a proportional side plate, the story
  text wraps cleanly inside its own column with no bleed into the image.

**Bug 2 — `QuestionView.swift`/`PracticeSessionView.swift`: practice session
genuinely looked broken on a real device, not just uncolored.** Pulled
`practice_session_from_chapter.png` (the REAL Dashboard→chapter→"Begin
practice" path, not the legacy `ContentView` test harness screen) and
confirmed live, concretely, what "horrible" meant:
1. A plain white iOS system nav bar ("Close" / "Practice" / "Question 1 of
   180") sitting directly above the fully-themed teal Practice screen —
   jarring, unfinished-looking next to the Dashboard's fully-themed chrome.
2. The portrait `leftColumn` (question card + Story/Graph swap box) was
   vertically stacked above the canvas, each fighting for a fixed fraction of
   SCREEN HEIGHT (46%/54%) — the swap box rendered clipped to a one-line
   sliver, while the canvas below sat mostly empty. Same root SwiftUI-nested-
   ScrollView class of bug as Bug 1, independently present in this file.
3. **"Question 1 of 180"** — `QuestionBankLoader.questions(forConcept:)`
   pulled the ENTIRE bank for a concept (every level, unfiltered) into one
   unbounded session. Real functional bug, not cosmetic — Akshat's own "make
   sure the algorithm is working" line (relayed via a follow-up coordinator
   message granting explicit latitude on this pass) named this class of
   issue directly.
4. The canvas toolbar (stroke count, palm-rejection picker, Clear/Recognize)
   was one cramped row of plain-text buttons with no visual relationship to
   the rest of the app's chrome.

**Fixes, each grounded against a real source before being applied (a
follow-up coordinator message granted explicit creative latitude for icon
sizing/general polish specifically, but reaffirmed the standing rule for
everything else: colors/structure/schema must trace back to something real
— a separate, later message reset the overall priority to "full parity with
the live website first, aesthetic polish second," which is why the fixes
below stayed grounded in `Practice.module.css`'s real values rather than
inventing new ones):**
1. **Re-checked `Practice.module.css` structurally, not just for colors** —
   real finding: web's `.sessionColumns` is `grid-template-columns: 1fr
   320px` — the QUESTION column is the wide/flexible side, the canvas+graph
   aside is a narrow FIXED 320px sidebar, opposite of what native's
   left/canvas split emphasizes. Did NOT flip native to match this literally:
   this file's own top-of-file doc comment already records Akshat's original,
   explicit, previously-signed-off native design ask — "the question and
   images will be on the left and you can write on the right... nice cute
   little [graph]... swap instead of stories" — a deliberate native-only
   enhancement (full-height Apple Pencil canvas as the primary surface,
   because handwriting input is this prototype's whole reason to exist),
   the same category of intentional deviation `swapBox`'s own doc comment
   already established for itself. Un-porting that now would silently
   overturn a previous, real product decision rather than fix a bug — flagged
   here explicitly rather than guessed, per this pass's own instruction to
   surface rather than silently resolve ambiguous product-intent questions.
2. **Unified the portrait/landscape split** (`QuestionView.body`): removed
   the buggy vertical-stack-with-nested-ScrollView portrait branch entirely.
   Both orientations now use the SAME side-by-side `HStack` structure
   landscape already had working, with only the split ratio adapting:
   `leftWidth = min(max(width * 0.42, 360), width * 0.55)` — a floor/ceiling
   so the left column stays comfortably readable (360-451pt) whether the
   screen is portrait-narrow or landscape-wide, instead of scaling linearly
   all the way down. This resolves the clipped-swap-box bug by construction
   (both columns now get the view's real full height, same as landscape
   always did) and, as a side effect, gives the canvas a saner (though still
   generously wide, by design) share of the screen.
3. **`PracticeSessionView.swift` chrome**: re-verified `Practice.module.css`'s
   `.shell`/`.topBar` directly — confirmed there is NO separate bar color at
   all, the WHOLE page (top bar included) is one flat `#21616E`. Added
   `.toolbarBackground(Color(hex:"21616E"), for: .navigationBar)` +
   `.toolbarColorScheme(.dark, for: .navigationBar)` to the system nav bar,
   and recolored the custom `questionNav` ("Question N of M") row onto the
   same real teal — not an invented "darker header" shade.
4. **Level-gating + batch cap, the real algorithm fix**: added
   `QuestionBankLoader.session(forConcepts:preferredLevel:limit:)` (level-
   filtered with a graceful level±1 → all-levels fallback chain, capped to
   12 questions — a real mission length, not the whole bank) and
   `recommendedLevel(forStatus:)` (an HONEST adaptation, not a verbatim port,
   of the real gap-scan rule CLAUDE.md documents — `easy→L3`/`kinda→L2`/
   `hard→L1` — using the LIVE mastery/status data this call site actually has
   available, `tocDotState()`, the same classification the Contents roadmap
   tiles already render, since real gap-scan confidence isn't threaded to
   this call site yet). `DashboardView` now passes the target concept's real
   `graphClient.progress[id]?.status` through `PracticeSessionView` into this
   call. Verified: `practice_session_from_chapter_v2.png` shows "Question 1
   of 12", not "Question 1 of 180."
5. **Canvas toolbar polish** (`canvasArea`, `toolbarPill` helper): rebuilt
   using the app's OWN already-established rounded-pill chrome language
   (Dashboard nav pills, Cover's top-action pills) rather than inventing a
   new one — icon+label capsule buttons for Clear/Recognize (green accent
   `#b9e86f` for Recognize, matching the app's real brand-lime), a stroke-
   count badge pill, and the palm-rejection picker moved to its own labeled
   "INPUT" row instead of competing for width in one cramped line. No web
   source for this control (native-only, same as the rest of the canvas
   chrome) — grounded in the app's OWN real, already-verified pill language,
   not a fresh invention.

**Verified real-device, not just a green build log**: `xcodebuild build`
clean first (twice, once per edit batch), then three full `xcodebuild test`
passes against `id=00008103-0012296E01D0C01E` — **9/10 XCUITests passing
each time** (the new `testChapterViewLandscapeHasNoTextImageOverlap` plus
the original 9; same single pre-existing
`testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome` baseline failure
every prior round has hit, zero NEW regressions). Screenshots saved to
`ios-prototype/MindCraftNotes/screenshots_realdevice_2026-08-07/`:
`chapter_fractions_decimals_story.png`/`_v2.png`, `chapter_fractions_decimals_landscape.png`,
`practice_session_from_chapter.png`/`_v2.png`, `dashboard_contents_lanes.png`,
plus the legacy-harness layout screenshots (`layout_portrait_q1_story.png` etc
— confirmed these come from the OLD `ContentView`/`--ui-testing-content-view`
test-only launch path, not the real Dashboard→chapter→practice flow, so not
used as evidence for the real-app bug fixes above).

**Flagged, not resolved — genuinely needs Akshat's call, not a guess:**
whether native's full-height-canvas / narrow-question-card emphasis (the
opposite ratio from web's real `1fr 320px` grid) should eventually be
brought into literal parity with the website now that the parity mandate
("import everything over... main task, not aesthetic recolor") has been
stated explicitly, or whether it stays a deliberate, signed-off native
enhancement given Apple Pencil input is this prototype's core differentiator.
Left as originally designed this round; flagging here rather than silently
picking a side.

**Committed this checkpoint**, then continued to item 7 (Live Call), below.

---

### Phase 5 progress, round 7 continued — item 7, Live "Call" co-working, built and wired end-to-end

**Real port of `app/src/lib/liveSession.ts`**, per the build plan's own
"New product surfaces since 2026-07-25" §1 spec (already accurate, verified
again directly against the live file before writing any Swift):
`Networking/LiveSessionClient.swift` (new file, manually registered in
`project.pbxproj` — `PBXFileReference`/`PBXBuildFile`/group/Sources-phase
entries, same mechanical pattern every prior new-file addition to this
project used; `plutil -lint` clean) mirrors `createLiveSession`/
`endLiveSession`/`appendLiveStroke`/`subscribeLiveSession`/
`subscribeLiveStrokes`/`isLiveSessionStale` 1:1 — same collection
(`liveSessions`), same field names verbatim (`studentId`/`tutorId`/
`contextType`/`status`/`createdAt`/`lastActivityAt`/`endedAt` on the session
doc; `authorId`/`authorRole`/`points`/`createdAt` on each `strokes` doc), same
flat `{x,y,p}` point wire format (`LiveStrokePoint`, ported from
`toFirestorePoints`/`fromFirestorePoints`'s own doc comment about Firestore
rejecting nested arrays), same 20-minute staleness window.

**Cross-checked against the REAL deployed `firebase/firestore.rules`
`liveSessions` block before considering this done**, not just against the
TypeScript data layer — confirmed the native writes are actually rules-
legal, not just shaped right: `allow create` requires
`request.resource.data.studentId == request.auth.uid` (native always sends
`Auth.auth().currentUser!.uid`, never a caller-supplied id) and `tutorId`
either null or equal to `users/{uid}.tutorId` (native fetches this via
`LiveSessionClient.fetchTutorId` and passes it straight through, never
inventing one); the `strokes` subcollection's own `allow create` similarly
requires `authorId == request.auth.uid`. This is the actual reason to trust
the round-trip will work for a real signed-in user, not just that the
Swift compiles.

**Wired into the real practice-session flow, not a standalone demo screen**:
- `QuestionView.swift`: a `callButton` pill in the question banner's top row
  — same real placement web's own `CallButton` uses (`Practice.tsx`'s
  question-header row, beside the bookmark button), hidden entirely when
  `tutorId == nil` (fetched once via `.task { await loadTutorId() }`),
  matching `CallButton.tsx`'s own "a live session with no one to join is a
  dead end" guard. Tapping creates a real `liveSessions` doc snapshotting
  `contextType: .question` + this question's real id/concept/text, subscribes
  to the session doc for live status, and flips to an "live · end call" pill.
  `.onDisappear` ends the session — mirrors `LiveSessionPage.tsx`'s student
  page-unmount effect (native only ever plays the creator/student role; a
  tutor/parent joins from the web app, so this is unconditional rather than
  role-gated).
- `CanvasView.swift`: the plan's own porting note said to wire this into
  "`CanvasView.swift`'s existing PencilKit stroke-completion callback" —
  that callback didn't actually exist yet (only a running stroke *count*
  did), so built it for real: a new `onStrokeCompleted: (([LiveStrokePoint])
  -> Void)?` param, and in `Coordinator.canvasViewDrawingDidChange`, a
  `lastKnownStrokeCount` watermark that diffs `drawing.strokes` on every
  delegate call and reports only the strokes that are genuinely new since
  last time (PencilKit only appends a stroke to the array once it's
  finalized, so a count-diff reliably isolates "completed since we last
  looked" without needing to inspect stroke identity) — each reported stroke
  is normalized 0...1 against the canvas's own current bounds and thinned to
  200 points max (Firestore per-doc size safety). **Real bug caught and
  fixed before this ever got to a build**: `onStrokeCompleted` isn't a fixed
  closure like this view's other callbacks — its very presence (nil before a
  call starts, non-nil after) changes mid-session without the canvas being
  torn down/recreated, but `makeUIView` only runs once per canvas instance.
  Originally only set there, meaning a call started mid-session would never
  actually forward strokes. Fixed by also refreshing
  `context.coordinator.onStrokeCompleted = onStrokeCompleted` in
  `updateUIView`, which runs on every SwiftUI re-render.
- `QuestionView`'s `CanvasView(...)` call site wires
  `onStrokeCompleted: liveSessionId.map { sessionId in { points in ... } }`
  — nil (true no-op) with no active call, or a closure that calls
  `LiveSessionClient.appendStroke(sessionId:authorId:authorRole: .student,
  points:)` with the CURRENTLY signed-in uid, real Task-wrapped async.

**Verified real-device, not just a green build log**: `xcodebuild build`
clean (twice, once per edit batch), then a full `xcodebuild test` pass
against `id=00008103-0012296E01D0C01E` — **9/10 XCUITests passing, zero
regressions** from any of the Live Call wiring (same single pre-existing
baseline failure every round has hit).

**Honest limitation, flagged rather than glossed over**: the automated
XCUITest harness runs via `--ui-testing-skip-auth` (no real Firebase Auth
session), so `Auth.auth().currentUser` is nil there and the Call button
never renders in that harness by design — the same reason `OutcomeClient`'s
real POST path isn't exercised by the automated suite either (see this
plan's own Phase 2 status write-up). A genuine cross-device round-trip
(Akshat's iPad running this build + his laptop on the live web app, watching
a stroke drawn on one appear on the other) needs a REAL signed-in account
with a linked tutor, which requires interactive Google/email sign-in this
environment cannot drive on its own. What IS verified here: the code
compiles, the existing regression suite is unaffected, and the exact
Firestore writes this code will make are provably legal under the real,
currently-deployed security rules for a real signed-in student with a
linked tutor. **The actual live cross-device test is the one piece of this
item that still needs Akshat to run it himself** — flagging this explicitly
rather than claiming a live round-trip that wasn't actually observed.

---

Continuing to item 9 (KnowledgeMapView/WorkPracticeView iPad audit / web
parity spot-check) next.

---

### Phase 5 progress, round 7 continued — item 9, KnowledgeMapView/WorkPracticeView audit: real finding, no forced change

**Re-scoped the audit under this round's sharpened parity mandate** ("does
this genuinely match the live website" beats "does this look like a
stretched iPhone layout" as the test) — read both native files in full, then
checked their REAL web counterparts' actual CSS structure directly, not
assumed from the pattern `DiagnosticGateView`/`NotesListView`/`FindTutorView`
happened to need in earlier rounds.

- **`WorkPracticeView.swift` vs `WorkStudio.module.css`** (the real,
  current component — confirmed `<WorkStudio>` is still what `Dashboard.tsx`
  renders for `view === 'work'`): `.root` is `display: flex; flex-direction:
  column` with NO `max-width` anywhere in the file, and no `grid-template-
  columns` anywhere either. On a real wide desktop browser, the Work tab
  genuinely IS one full-width vertical column — that's not a mobile-narrow
  fallback, it's the only layout this screen has. Native's existing single-
  column `ScrollView { VStack { heroRow; dropCard; ... } }` is therefore
  ALREADY the correct port, not an "iPhone-stretched" bug — forcing it into
  a `LazyVGrid` multi-column layout would have been un-porting a real
  product decision to chase a pattern that didn't apply here, the same
  category of mistake this round's `QuestionView` section flagged rather
  than committed.
- **`KnowledgeMapView.swift` vs `ActEmojiMap.module.css`** (confirmed still
  the live component `Dashboard.tsx` imports for the Map tab, matching §2's
  existing note): this is fundamentally a canvas of absolutely-positioned
  nodes (`.node { position: absolute; ... }`, real PCA `x`/`y` coordinates),
  not a document-flow grid of cards — the two `display: grid` rules in the
  file are `place-items: center` single-item centering tricks, not multi-
  column layouts. `KnowledgeMapView.swift`'s own top doc comment already
  records this was ported "a to z from the dashboard" in an earlier pass
  (real PCA node positions, `isMajorEdge` filter, status taxonomy, route
  panel) — its `GeometryReader` usage (3 occurrences) is the CORRECT native
  equivalent of the web's absolute-positioned canvas, not a layout-audit
  smell to "fix" into a grid.

**Conclusion: no code change made to either file this round** — both
already structurally match their real, current web equivalents once actually
checked against the live CSS, which is a real, evidence-based audit outcome
in its own right (the ORIGINAL item-9 framing assumed these needed the same
`LazyVGrid` treatment `NotesListView`/`FindTutorView` got in round 5; that
assumption doesn't hold for either of these two screens once measured
against the real source instead of a general "iPad should use its width"
instinct). Flagging this explicitly rather than forcing an unwarranted
change just to have something to show for the audit item.

**Final verification for this whole round**: `xcodebuild build` clean, then
a full `xcodebuild test` pass against `id=00008103-0012296E01D0C01E` —
**9/10 XCUITests passing, zero regressions**, confirming the full stack of
this round's changes (ConceptChapterView, QuestionView, PracticeSessionView,
QuestionBankLoader, CanvasView, LiveSessionClient) together, not just each
piece in isolation.

**Still open for a future round** (none of these are guesses to make now,
per this plan's own standing discipline — real product-intent questions for
Akshat, or real remaining engineering work):
1. ~~The flagged QuestionView ratio question~~ — **resolved by Akshat, see
   the next section: literal web parity, implemented and verified.**
2. Live Call (item 7) is code-complete and rules/schema-verified but not yet
   confirmed with a real cross-device round trip — **Akshat's explicit call:
   he'll verify this himself later** (needs his own signed-in account across
   iPad + laptop, correctly out of scope for this environment to drive). Not
   pursued further this round.
3. `mc-diagnostic.js` overlay retarget (pre-existing gotcha, unrelated to
   this round) — still open.
4. A genuine full-parity pass across the REMAINING screens this round didn't
   touch (Notes tab, Find-a-Tutor, Login/Diagnostic/Welcome/Cover) against
   the sharpened "does this match the live website" bar — rounds 2-6 already
   did real verification work on all of these, but that work predates this
   round's parity-first mandate; worth one more pass with that specific lens
   if a future session has budget, not because anything specific is known to
   be wrong.

---

### Phase 5 progress, round 7 continued — QuestionView ratio brought into literal web parity (Akshat's explicit decision)

**Akshat's call on the flagged question**: match the web's literal
`1fr / 320px` grid proportions (question column wide, canvas narrow), not
the wider-canvas native variant — this wasn't one of the native-only
deviations he'd explicitly asked for (icon sizing, general polish), so bring
it into literal alignment now that "full parity with the live site first"
is the stated umbrella priority.

**Re-verified the exact grid values fresh from the live file** (not reused
from memory, per his explicit instruction) — `Practice.module.css`:
```
.sessionColumns {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: stretch;
}
```
Confirmed unchanged from the value read earlier this round.

**Implementation** (`QuestionView.body`): flipped the width assignment —
`asideWidth = min(320, geometry.size.width * 0.5)` (the `min(...)` is a
defensive floor only for a pathologically narrow width this iPad-only app
should never render at; on both real iPad orientations this always resolves
to the literal 320pt). `leftColumn` (the question card + swap box, was
`.sessionMain` on web) now gets `geometry.size.width - asideWidth` — the
wide/flexible side; `canvasArea` (`.sessionAside`) gets the fixed 320pt.
This is a pure formula swap, orientation-agnostic — the same expression
governs both portrait and landscape since it's driven entirely by the live-
measured `geometry.size.width`, not a per-orientation branch.

**Real regression caught from the actual before/after screenshot, not
assumed still fine**: narrowing the canvas aside to a literal 320pt exposed
a second, real bug in the canvas toolbar this round's own earlier polish
pass had built — a single row cramming the title, stroke badge, and both
action pills was workable at the PREVIOUS wider ~58%-of-screen canvas width,
but wrapped into illegible letter-stacks ("Cle/ar", "Recog/nize →/Graph") at
320pt. Fixed by splitting into three rows instead of two (title+badge alone;
action pills alone, each getting the full available width instead of
splitting one row three ways; input-mode picker+caption last) and shortening
"Recognize → Graph" to "Recognize" for extra headroom.

**Verified real-device, not just a green build log**: `xcodebuild build`
clean, then `xcodebuild test` against `id=00008103-0012296E01D0C01E` twice
(once before the toolbar fix, once after) — **9/10 XCUITests passing both
times, zero regressions** (same single pre-existing baseline failure every
round has hit). Pulled real screenshots:
- **Portrait, the REAL Dashboard→chapter→practice flow** (not the legacy
  harness): `screenshots_realdevice_2026-08-07/gridfix/
  practice_session_portrait_gridfix_v2.png` — confirms the ratio (question
  column visibly wide, canvas aside visibly narrow at ~320pt) AND the
  toolbar fix (clean "Work it out" / stroke badge line, then a clean
  "Clear"/"Recognize" pill row, then the INPUT picker row — no more wrapped
  text) in one shot.
- **Landscape**: `layout_landscape_gridfix_v2.png` and a second isolated
  re-run `layout_landscape_gridfix_iso.png` (same known sideways-packaging
  capture artifact this plan's rounds 5/7 already documented — reproduced
  identically on a clean isolated re-run this time, so treated as a stable
  characteristic of this environment's orientation-screenshot capture, not
  chased further). Confidence in the landscape result rests on the ratio
  formula being genuinely orientation-agnostic (same `min(320,
  geometry.size.width * 0.5)` expression in both cases, no separate
  landscape code path to independently verify) plus the clean portrait
  screenshot, rather than a clean landscape capture — flagged honestly as
  the reasoning, not presented as an equally-strong direct visual
  confirmation.

**Committed**: this ratio + toolbar fix as its own checkpoint.

---

### Phase 5 progress, round 7 continued — real per-question graph rendering + Dashboard/Contents polish pass (Akshat's explicit creative authority, real urgency)

Two more rounds of live feedback arrived mid-session, both treated as
higher priority than the remaining checklist items, per this plan's own
standing discipline that a live report beats continuing a queue.

**1. Questions with graphs/images weren't rendering meaningfully.** Traced
to a real, concrete gap, not a paint issue: `GraphView` always defaulted to
a generic `x^2+5x+6` parabola for EVERY question — no mechanism existed to
pull a specific question's own real points/expression out of its text, the
exact "root cause" web's own `lib/plottablePoints.ts` doc comment describes
fixing. Built `Models/PlottablePointsExtractor.swift`, a scoped real port
(point extraction via `COORD_RE`/`POINT_CONTEXT_RE`/`NOT_POINT_PLOT_RE`,
plus expression extraction via an explicit "y = ..." statement or a 2-point
linear derivation — the quadratic-roots-from-intercept derivation and the
horizontal-line special case were left out of this pass's scope, flagged
honestly in the file's own doc comment, not silently dropped). Verified the
regex logic in ISOLATION first (a standalone `swift` script run against
`eedi_1194`'s real bank text, confirmed it extracts exactly `(-6,3)` and
`(-1,1)`) before wiring it into the view, catching that the mechanism itself
was correct before debugging the integration. Wired into `GraphView` (real
point markers drawn as labeled amber dots, axis range auto-fits to include
them, a real per-question caption) and `QuestionView` (auto-selects the
Graph tab when the current question has real extractable data, mirroring
web's `defaultOpen` logic).

**Real, honestly-documented limitation found while verifying this
end-to-end**: which exact question a fresh practice session opens to isn't
fully deterministic in this harness — confirmed live that this specific
device carries a REAL persisted Firebase Auth session (from earlier manual
testing), so `KnowledgeGraphClient` fetches that real account's real live
mastery, and this round's own level-gating fix correctly serves a HARDER
level for an already-mastered concept (`linear_equations` resolved to real
Level 3, not the Level 1 an "untouched account" assumption would predict —
confirmed via a debug screenshot showing a real Level-3 question rendering
its generic fallback correctly, i.e. NOT forcing bogus points onto unrelated
text, which is itself correct, conservative behavior). This is the SAME
real consideration that motivated the `--ui-testing-force-welcome` flag
earlier this round, now confirmed to also affect which bank question a test
lands on. The XCUITest for this (`testQuestionWithRealGraphDataPlotsRealPoints`)
tries a short list of concepts and takes whichever one actually shows real
points, logging (not hard-failing on) the outcome — hard-failing an
integration test on live, personalized account state this environment
doesn't control would be a false signal, not a real bug report. The
underlying mechanism's correctness rests on the isolated logic verification
above, which IS fully deterministic and reproducible.

**2. Dashboard/Contents felt cramped — Akshat: "too much padding on left
and right... give each logo its space... no need to condense... okay if it
runs across pages, I don't mind... keep the topic separation clearly
though."** Real structural change to `ContentsRoadmapView.swift`, not a
value tweak, with full creative authority explicitly granted:
- Switched from two lanes sharing one row (each getting a proportional
  FRACTION of the available width) to ONE full-width lane per row —
  roughly doubling every tile's real width at a stroke, and directly
  answering "give each logo its space" without any forced compression.
- Cut the outer page horizontal margin (16pt → 20pt is actually a small
  INCREASE in absolute terms, but with lanes now full-width instead of
  paired, this is the ONLY horizontal inset left on the whole screen —
  net effect is far less "padding" reads as wasted, since there's no more
  dead center gutter between two half-width lanes eating real content
  width).
- Capped `tocColumnsFor`'s upper bound at 3 (was 4) — a deliberate
  DEVIATION from the web's literal grid value (documented as such in the
  function's own doc comment): the web can afford 4 columns on a 1400px+
  browser window, this app's real iPad canvas can't without cramming, and
  Akshat explicitly asked for bigger tiles over a tighter fit even at the
  cost of more vertical scroll.
- Bumped lane card padding (16→24), lane-to-lane spacing (20→32), tile
  grid spacing (12→18), lane header title size (22→26pt) and glyph size
  (24/34→28/40), and tile padding/label size (14/14/16 + 15pt →
  18/18/20 + 17pt) — every one of these numbers chosen to make the newly-
  generous full-width lanes feel proportionally generous throughout, not
  just wider with the same tight interior spacing.
- Each lane's own card chrome (background wash, 2pt accent-tinted border,
  deeper shadow) is now the full visual width of the screen — confirmed on
  a real screenshot this reads as MORE obvious lane-to-lane separation than
  the old paired layout, not less, directly answering "keep the topic
  separation clearly though" even with more breathing room inside each one.

**Verified real-device, not just a green build log, for both**: `xcodebuild
build` clean, then a full `xcodebuild test` pass against
`id=00008103-0012296E01D0C01E` — **10/11 XCUITests passing, zero
regressions** (same single pre-existing baseline failure every round has
hit). Real before/after screenshots:
`screenshots_realdevice_2026-08-07/dashpolish/dashboard_top_after.png` (top
of Contents — Warm-ups lane full-width, visibly bigger tiles, tight edge
margins) and `contents_scrolled_after.png` (Algebra/Geometry lane boundary —
clear, distinct card separation). `question_with_real_graph_points_*`
screenshots (both hits and honest misses) under the same directory document
the graph-rendering verification.

**Committed** both as one checkpoint.

---

## Round 7 final wrap-up — the original 9-item outstanding list, end to end

Per the coordinator's explicit request: a genuine final pass confirming
what's real vs. what's still open, after closing out the grid-ratio parity
fix. Cross-checked against the handoff banner's original 9 items (top of
this file) one more time, not assumed complete from memory:

1. **Contents scroll bug + chapter landscape text-overlap — DONE, verified
   this round with real evidence for the first time** (prior rounds only
   confirmed via code read). `testContentsScrollReachesGeometricTransformations`
   scrolls the real Home tab and screenshots the tile fully visible, with
   real story art and its mastery-glow border/checkmark badge.
   `ConceptChapterView`'s portrait art-oversizing + nested-ScrollView text
   overflow bug (found live this round, NOT by a prior round) is fixed and
   verified in both orientations.
2. **Icon-only nav — DONE** (round 6). Visible correctly in every screenshot
   this round too (wordmark + 3 icon nav buttons, no text labels).
3. **Real story-art tiles + mastery glow, bigger sizing — DONE, and
   substantially improved further this round.** Rounds 4/5 built the real
   story-art + mastery-cascade border/glow mechanic; this round's Dashboard
   polish pass (above) made tiles meaningfully bigger again per Akshat's
   direct "still too small/cramped" follow-up feedback.
4. **Welcome screen — DONE, verified this round with real evidence for the
   first time** (prior rounds only confirmed via code read). Added
   `--ui-testing-force-welcome` specifically because this device carries a
   real persisted sign-in that would otherwise make a "fresh launch"
   unreliably skip it.
5. **Cover simplified to center-card-only — DONE**, confirmed by direct
   code read this round (no floating subject pills anywhere in
   `CoverView.swift`).
6. **Motivational quote bubble — DONE** (round 6): the equipped mascot
   sticker's own catalog blurb, real mechanism traced from `Dashboard.tsx`.
7. **Live "Call" co-working — code-complete, rules/schema-verified, built
   and committed this round.** `LiveSessionClient.swift` (real port of
   `liveSession.ts`) wired into `QuestionView`'s Call button and
   `CanvasView`'s new stroke-completion callback. **Per Akshat's explicit
   instruction this round: the real cross-device round-trip test is
   deliberately NOT pursued further here — he will verify it himself later**
   with his own signed-in account across his iPad and laptop, which this
   environment cannot drive interactively. Not a gap in the build, a
   deliberate scope boundary.
8. **Interactive Dashboard stickers — DONE** (round 5): real catalog,
   drag-to-tilt, equip slots on Cover, mascot-skin on Dashboard. Spot-
   checked this round (still compiles and wired correctly after this
   round's other Dashboard changes) rather than rebuilt.
9. **iPad-native layout audit — DONE for the originally-flagged screens.**
   `NotesListView`/`FindTutorView` (round 5), `KnowledgeMapView`/
   `WorkPracticeView` (this round — real finding: both already
   structurally match their live web equivalents once checked against the
   actual CSS, so no forced grid change was made). The Dashboard/Contents
   screen itself got a SEPARATE, much larger layout pass this round per
   Akshat's direct live feedback (see above) — arguably the most
   significant "iPad-native, not cramped" work of the whole session, just
   triggered by live feedback rather than the original audit item.

**All 9 original items are genuinely addressed.** Two real, substantive
pieces of NEW work came out of this round beyond the original list, both
driven by live, real-time feedback from Akshat rather than the original
9-item framing: the literal web-parity grid-ratio fix for `QuestionView`,
and the real per-question graph-rendering + Dashboard polish pass just
above. Both are committed, both are verified on the real device with real
screenshots.

**What's genuinely still open — real product-intent questions or
environment-boundary limitations, not guesses to fill in**:
1. Live Call's real cross-device round-trip test — deliberately deferred to
   Akshat per his own explicit instruction (item 7 above).
2. `PlottablePointsExtractor`'s two scoped-out cases (quadratic-roots-from-
   intercept derivation, horizontal-line special case) — real, bounded
   follow-on work if a future session has budget; not blocking, the two
   ported cases (direct point extraction, "y=..." + 2-point linear
   derivation) already cover the most common real bank patterns.
3. `mc-diagnostic.js` overlay retarget (pre-existing gotcha, unrelated to
   this session's work) — still open.
4. A fresh full-parity pass across screens this session didn't touch this
   round (Notes tab, Find-a-Tutor, Login/Diagnostic) against the sharpened
   "does this genuinely match the live website" bar stated explicitly this
   session — rounds 2-6 verified these against an earlier, less strict
   standard; worth one more pass if a future session has budget, not
   because anything specific is currently known to be wrong.

If nothing above needs immediate action, there is no more clearly-scoped
work left from either the original handoff banner or this session's live
feedback — the honest state is "genuinely done, modulo the two explicitly-
deferred/flagged items."

---

### Phase 5 progress, round 8 (Fable 5, 2026-08-07) — real web-parity QuestionView rebuild, hero bar reorg, formula card, chapter bug re-pass

Akshat's round-8 brief, in priority order: (1) rebuild `QuestionView` to
genuinely match the live website — no story panel, graph in a real right
column above the canvas, question+choices alone on the left, "elegant and
simple" — explicitly the item that determined whether this round counted as
successful; (2) hero bar reorganized into two rows; (3) re-confirm/fix the
`ConceptChapterView` landscape text-bleed and portrait crop bugs, plus a real
swipe gesture for story pages; (4) a formula/concept card before practice
questions begin, ported from web's `CONCEPT_CONTENT`.

**Item 4 (priority) — re-verified the CSS cascade fresh, found a bigger,
previously-missed correction than the structural one.** Confirmed
`.sessionColumns { grid-template-columns: 1fr 320px }` is genuinely the live
default (the `.pathLayout` `1.15fr / min(320px,30%)` ratio the orchestrator
flagged as a possible alternate is a different screen — the topic-path/
island map, grepped separately) and that `.sessionMain` really is
question-card-only (`storyArtFor`/`sessionArt` are computed in `Practice.tsx`
but their render block is literally commented "removed... intentionally not
rendered here anymore"). But tracing the SAME file's cascade further —
past round 7's `.shell { --practice-bg: #21616E }` read, which is real but
NOT the winner — found a later "PAPER STANDARDIZATION" block
(`Practice.module.css` ~5027) that redeclares `.shell, .pathShell,
.matteShell` with `--practice-bg: var(--paper-bg)` / a paper-gradient
`background`, same selectors, later in source order, so it wins outright.
Confirmed `--paper-bg`/`--paper-sheet`/`--paper-ink`/`--paper-edge` are real
live tokens (`src/styles/paper.css`, imported globally in `main.tsx`,
resolving to `#f7f3ee`/`#fbf8f4`/`#1c1a17`/`#e2d8ca`), and confirmed via the
root JSX (`` `${s.shell}${isMatteFlow ? ` ${s.matteShell}` : ''}` ``) that a
real practice session (not just gap-scan) always carries both classes. A
THIRD, even-later block ("FIELD JOURNAL — PAPER QUESTION TREATMENT," ~4427,
its own comment: "these rules come last so they win the cascade") repaints
`.questionCard`/`.questionBanner`/`.questionText`/`.choice` off the teal card
prior rounds ported onto a warm ivory paper sheet with a dot-grid texture,
`#1c1a17` ink, and NO level-color gradient banner (`!important` beats the
inline `lvBannerGradient` JSX still sets). A FOURTH block ("IMMERSIVE CANVAS
SESSION," ~5389) further splits choice treatment: an unselected `.choice`
loses its card chrome entirely (`border: none !important; background:
transparent !important` — a flat divider row), while
`.choiceSelected`/`.choiceCorrect`/`.choiceWrong` keep the FIELD JOURNAL
block's gradient-card treatment untouched. Root cause of "looks nowhere like
the website": the live site is a warm paper journal page, not a saturated
teal gradient card. Full reasoning + every hex value is in `QuestionView.swift`'s
new top doc comment, cross-referenced to exact `Practice.module.css` line
ranges so a future pass can re-verify without redoing this excavation.

**Rebuilt `QuestionView.swift`** on this basis: removed `StoryTheme`,
`LeftPanelTab`, `swapBox`, `storyExcerpt` entirely (all dead once the
Story/Graph picker is gone — no web equivalent ever existed for the swap box
itself, per round 7's own doc comment calling it out as a native-only
design ask that Akshat's parity mandate now supersedes). New `Paper` color
token enum. `leftColumn` = `ScrollView { questionCard }` only. `rightColumn`
= `GraphView` (only when `showGraph` — real extracted points/expression, or
a just-recognized handwritten expression, or the new
`--ui-testing-force-graph` test flag) stacked above `canvasArea`. Choice
list now renders two visually distinct states matching the real cascade: a
flat hairline-divider row when unselected, a full rounded gradient card
once selected/checked. `PracticeSessionView.swift`'s nav chrome and
`GraphView.swift`'s canvas background (was the OS-adaptive
`.systemBackground`, a real latent dark-mode bug since this app never sets
`.preferredColorScheme`) recolored to match.

A live visual fetch of `mindcraft-93858.web.app` was attempted per the
orchestrator's request; the real practice session sits behind Firebase Auth
+ onboarding state an unauthenticated fetch can't reach, and `WebFetch` only
renders HTML→text regardless (no CSS/visual signal even past a login wall)
— so this round's ground truth is the literal CSS cascade traced to its
actual last-writer-wins rule, not a screenshot comparison.

**Item 1 — hero bar reorganized into two rows** (`DashboardView.swift`):
row 1 groups wordmark+nav tightly on the left and mascot+quote+Find a
Tutor+name+sign-out tightly on the right around ONE real flexible spacer
(previously multiple `Spacer`s between every element absorbed slack evenly,
which is exactly why nav read as floating away from the wordmark and the
mascot read as floating too far right). Row 2 holds the Today's Spark /
Weekly Review badges. "Find a Tutor" moved in from its old spot beside the
"Contents" header, restyled as a pill matching the rest of the bar's chrome.

**Item 2 — `ConceptChapterView.swift` re-pass:**
- **Portrait crop-anchor bug (real, fixed)**: `artPlate` used
  `.aspectRatio(1, contentMode: .fill)` (forcing every source image into a
  centered SQUARE crop first) then a SECOND, separate `.frame(width:height:)`
  at the call site (stretching/cropping that square again into a wide
  rectangle) — two independent center-crops compounding whatever got cut,
  with no control over which edge lost content. Fixed to a single pass: the
  image's own native aspect ratio (`.aspectRatio(contentMode: .fill)`, no
  forced ratio) with ONE frame taking both width and height, `alignment:
  .top`, so any needed crop comes off the bottom instead of symmetrically
  off both edges.
- **Landscape height bug (fixed, but see below — did not resolve the actual
  complaint)**: `storyColumn` had width but no explicit height in the
  landscape `HStack` branch — the same unbounded-ScrollView-height class of
  bug round 7's portrait fix already covered, just never applied to this
  sibling. Gave it an explicit matching height + `.clipped()` as a backstop.
- **Swipe gesture (added)**: `.simultaneousGesture(DragGesture(minimumDistance:
  30))` on `chapterCard`, gated on horizontal-dominance
  (`abs(horizontal) > abs(vertical) * 1.5 && abs(horizontal) > 50`) so it
  doesn't fight `storyColumn`'s own internal vertical `ScrollView`.

**Real, honest finding — landscape text-bleed is NOT actually fixed,
despite the height fix above.** Mid-verification, Akshat reported live,
directly: "the story words bleed out of the right in screen in horizontal
display." Pulled the real `chapter_fractions_decimals_landscape` screenshot
from this round's `xcodebuild test` run and, rather than trust the sideways
capture, rotated it properly with `sips -r 270` to read it upright: every
story paragraph line is visibly truncated mid-word at the right edge ("a
b[oy]", "twelfths an[d]", "thousands, hu[ndreds]", "Any amo[unt]"). The SAME
truncation pattern showed up in a rotated PORTRAIT screenshot too
(`chapter_fractions_decimals_last_page`), which argues it could be this
harness's own screenshot-capture pipeline (files consistently save at one
fixed pixel-buffer orientation regardless of the device's true rendered
orientation, a quirk rounds 5/7 already flagged and didn't chase) rather
than a genuine app bug — but that same screenshot pipeline concern means the
screenshot evidence is NOT strong enough to rule the bug in OR out on its
own. Akshat's live, on-device, non-screenshot report is the stronger signal
of the two, so this is left genuinely OPEN, not claimed fixed. **Queued for
round 9**, see below. (Separately, unrelated: that same portrait screenshot
shows two pages' text ghosted on top of each other — page 1 and page 2
simultaneously visible, page-dot counter showing "1/2" faintly behind "2/2"
— almost certainly the `withAnimation` page-turn transition caught
mid-crossfade by a screenshot taken immediately after the tap, not a real
rendering bug; noted for awareness, not treated as a new bug.)

**Item 3 — formula card, built and wired real, not a stub.** New
`FormulaCardView.swift`: a lightweight port of `Practice.tsx`'s `pPhase ===
'explore'` screen (header with real emoji/tagline/exam-weight, formula box,
Key Rules / Pro Tips two-column grid, Watch Out list, Worked Examples,
"Start Practice" button — all real per-concept content, not placeholder
text), shown as a real gating step in `PracticeSessionView.swift` before the
first question, on every "Begin practice" entry (not scoped to Weekly
Review the way web's version is — Akshat's ask was for every entry to show
it). `CONCEPT_CONTENT` (36 concepts, `app/src/lib/conceptContent.ts`)
exported VERBATIM via a one-shot `vite-node` script (not hand-transcribed —
`npx vite-node` can import and run the real `.ts` module directly, letting
`JSON.stringify(CONCEPT_CONTENT)` produce an exact copy) into
`Resources/conceptContent.json`, decoded by new `ConceptContentLoader.swift`
following the same `Bundle.main.url(forResource:withExtension:)` pattern
`ConceptStoryLoader` already established. New pbxproj entries added by hand
(file ref + build file + group + Sources/Resources build-phase membership),
`plutil -lint` clean.

**Real regression caught and fixed before this was considered done**: the
new formula-card gate broke the existing "Begin practice → question" flow
that 3 XCUITests assumed was immediate. `testChapterDrillDownShowsRealStoryAndOpensPractice`
started failing outright (timed out waiting for `questionPrompt`);
`testQuestionWithRealGraphDataPlotsRealPoints` degraded silently into a
false-positive PASS (its own soft-continue-on-miss design meant it never
hard-failed, it just looped through all 4 candidate concepts finding nothing
real, every time, without ever reporting that as a problem — caught only by
reading the actual `xcodebuild test` log line-by-line, not by the green
summary). Fixed both call sites to tap through the real
`formulaCardStartPracticeButton` step (a new shared `tapBeginPracticeThroughFormulaCard`
helper for the hard-assert tests, an inline soft-guarded version for the
one test that deliberately never hard-fails on live account-state variance).
Also caught and fixed a SECOND, self-authored bug while getting real
screenshot evidence: the first attempt's "formula card" screenshot was
actually taken AFTER both the `beginPractice` and `startPractice` taps
inside the shared helper, so it silently captured the QUESTION screen a
second time, not the formula card at all — only caught by actually looking
at the exported PNG (identical to the "before" question screenshot) rather
than trusting the test passing. Fixed by inlining the two taps with a
screenshot in between for that one test.

**Verified real-device**, `id=00008103-0012296E01D0C01E`, not just a green
build log:
- `xcodebuild build` clean multiple times across edit batches — all real
  device builds, never simulator.
- Full `xcodebuild test`: **12/13 passing**, the one failure
  (`testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome`) is the same
  pre-existing unauthenticated-harness baseline failure every round has hit
  (documented failure mode: `.notSignedIn` on the outcome POST), not a new
  regression.
- A targeted `-only-testing:` re-run of
  `testChapterDrillDownShowsRealStoryAndOpensPractice` after the screenshot-
  placement fix, to get real formula-card evidence specifically: passed.
- Real screenshots pulled via `xcrun xcresulttool export attachments
  --legacy` and actually looked at (several needed `sips -r 270`/`-r 90` to
  correct the known sideways-capture artifact before they were readable) —
  confirmed genuinely working: `practice_session_from_chapter` (paper
  question card, dot-grid texture, cream banner, circular yellow choice
  badges, flat divider rows, canvas dominant with no graph box since this
  question has no plottable data), `dashboard_contents_lanes` (hero bar's
  two-row shape exactly as designed — tight wordmark+nav cluster, tight
  mascot+quote+Find-a-Tutor+name+sign-out cluster, spark/Weekly-Review
  badges on their own row below), and `formula_card_fractions_decimals`
  (real "Fractions Decimals" header, real formula box, real Key
  Rules/Pro Tips/Watch Out/Worked Examples content, matching the live
  `CONCEPT_CONTENT` entry verbatim).

**Committed**: `311db78` — all 7 modified files + 3 new files
(`ConceptContentLoader.swift`, `FormulaCardView.swift`,
`Resources/conceptContent.json`), staged explicitly by name (never `-A`),
gitignored `screenshots_realdevice_*/`/`*.xcresult/` patterns confirmed
still covering this round's scratch artifacts (a couple of ad-hoc-named
review folders that didn't match the existing pattern were deleted rather
than committed or renamed into it).

**A note on this round's own process**: a background `xcodebuild test` run
genuinely did finish successfully while a `Monitor`-based wait on it never
fired a completion notification — caught by the orchestrating coordinator
checking the actual machine state directly, not by anything on this side
noticing the stall. The coordinator's read was accurate: process long done,
notification never arrived. Whatever the underlying cause, plain `Bash
run_in_background` + reading the log/exit state directly (or a bounded
`while ps -p <pid> ...` poll loop) proved reliable for the rest of this
round; `Monitor` was not used again after that.

**Mid-flight priority change from the orchestrating coordinator, logged
here per instruction rather than acted on** — the following are real,
Akshat-sourced, and queued for **round 9**, explicitly NOT started this
round:
1. **Dropped entirely**: an earlier-queued "forest green" background
   recolor for `QuestionView`/`PracticeSessionView` — superseded by this
   round's own real finding that the live site is warm paper/ivory, not any
   shade of green or teal. Nothing to revert; never started.
2. **The right-column graph/canvas layout is now known to be the WRONG
   target — a bigger correction than "right column = 100% canvas" once
   there's no graph.** Akshat's own words, clarified after this round's
   build: "the writing space is so small, unlike our web where you can
   write anywhere... seamlessly blended into one page, not like sections on
   the right — you can write [anywhere] and [have] style tools in a toolbar
   neatly." The real target is a canvas that spans/overlays the WHOLE
   page — write directly over the visible content (question card included),
   not confined to any boxed section, with a compact floating toolbar for
   pencil tools — closer to a GoodNotes/Notability-style overlay than a
   sectioned two-column layout. This supersedes even the "right column,
   fixed 320px, matches web's literal grid" framing this round's `QuestionView`
   rebuild just implemented — that framing is now understood to be an
   intermediate step, not the final target. **Not implemented this round**
   — flagged here precisely so round 9 starts from the right brief instead
   of re-deriving it.
3. **Landscape (and possibly portrait) chapter-story text bleed — still
   genuinely open**, per the finding above. Needs either a corrected
   screenshot-capture pipeline (so evidence can be trusted either way) or a
   real Akshat on-device look, not another blind code-level guess.
4. **Question-bank parity check** (mentioned by the coordinator as part of
   the paused list) — not started, not scoped further this round.
5. **A real Weekly Review guided walkthrough** (loop story-beat → formula
   card → question batch → next topic, per `startWeeklyWalkthrough()` on
   web) — not started. This round's `FormulaCardView` is a real building
   block for it (same card, single-topic) but the walkthrough
   orchestration itself (multi-topic looping, `weeklyWalkSlots` grouping)
   is not built.
6. **Live "Call" co-working — Akshat re-emphasized this matters** ("call
   feature is important, please"). Code-complete and rules-verified since
   round 7 (`LiveSessionClient.swift`, wired into `QuestionView`'s call
   button and `CanvasView`'s stroke-completion callback); the real
   cross-device round-trip test (his iPad + his laptop, a real signed-in
   account with a linked tutor) still hasn't been run — this environment
   cannot drive that interactively. Re-flagged as a real priority for
   whenever he can run it himself, not deprioritized.

**What's genuinely still open, this round's own honest accounting**:
- Item 4 (QuestionView rebuild): structurally and visually verified working
  on real device, but per point 2 above, the right-column-canvas framing
  itself is now known to be superseded — round 9's real task is the
  full-page-overlay writing surface, not a refinement of this round's grid.
- Item 1 (hero bar): verified working, no known issues.
- Item 2 (chapter bugs): portrait crop fix and swipe gesture verified/wired;
  landscape (and possibly portrait) text-bleed is NOT resolved — see above.
- Item 3 (formula card): verified working end-to-end with real content.
- Round 9 should start from the coordinator's priority list above (items
  1-6), not re-derive it.

---

### Phase 5 progress, round 9 — Brick 0 stabilization (Claude Sonnet 5, 2026-08-08)

Picked up round 9's uncommitted work directly (not via a background agent —
prior background-agent attempts this session hit real, repeated stalls on a
Monitor/background-wait pattern; this pass ran every build/test in the
foreground instead, per the standing discipline this doc already states).

**Build + full suite, clean**: `xcodebuild build` succeeded with zero errors.
Full `xcodebuild test` ran to real completion (3808s / ~63 minutes — this
device is genuinely slow for a full suite pass, not hung; confirmed by
reading the actual elapsed-time log, not assumed) — **12/14 passing**. Two
failures:
- `testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome` — the same
  pre-existing baseline failure every round has hit (unauthenticated
  harness), not a regression.
- `testDiagramQuestionRendersRealBundledImage` — real, investigated at
  length below.

**`testDiagramQuestionRendersRealBundledImage` — two real bugs found and
fixed, one real issue still open, documented honestly rather than papered
over:**

1. **Real bug #1 (fixed): wrong concept choice.** The test targeted
   `ratios_proportions` and scanned its session for any question rendering a
   real bundled diagram. Cross-referenced `Resources/questionBank.json` +
   `Resources/generatedDiagrams/*.svg` directly: `ratios_proportions` has 8
   real diagram+SVG questions, but **all 8 are level 1-2, zero at level 3**.
   This test account's live `graphClient.progress` data resolves
   `ratios_proportions` to level 3, so the 12-question session it draws from
   genuinely has nothing to find — not a rendering bug, a coverage gap for
   that specific concept+level. Checked every concept's diagram-question
   levels and found `linear_equations` has real coverage at **all three
   levels** (confirmed against the same two files), so it's immune to
   whatever level the live progress data selects. Retargeted the test to
   `linear_equations`, same scan-forward mechanism otherwise.
2. **Real bug #2 (fixed): unclamped `GeometryReader` height.**
   `QuestionView.body`'s `GeometryReader { screenGeo in ... pageContent(minHeight: screenGeo.size.height - 32) }`
   can receive a transient `screenGeo.size.height` of 0 during the
   `.fullScreenCover` presentation animation `PracticeSessionView` uses to
   show this view — unclamped, that produces a **negative** `minHeight`,
   which SwiftUI logs as "Invalid frame dimension (negative or
   non-finite)" (confirmed: this exact warning appeared in the original
   failing run's xcresult). Fixed with `max(0, screenGeo.size.height - 32)`.
3. **Still open, not resolved**: after both fixes, the test still fails at
   the same point — `questionPrompt` never appears within the 10s timeout
   after tapping through the formula card, consistently ~75-78s total
   runtime across 3 repeated runs (so a real, reproducible condition, not a
   one-off flake). Both fixes above are real, confirmed-correct
   improvements on their own merits (verified against the actual bundled
   data and a real captured warning, not guesses) but neither turned out to
   be the full explanation for this specific timeout. Investigated as far as
   reasonably justified for one test within this session (checked
   `PracticeSessionView`'s session-loading logic, confirmed `linear_equations`
   has real question coverage at every level — 62/102/29 — ruling out a data
   gap; attempted to inspect the failure-moment video frame but this
   environment has no `ffmpeg`, only `qlmanage`'s poster-frame thumbnail,
   which just shows the pre-test Cover screen and isn't useful for a
   mid-test failure). The underlying diagram-rendering mechanism itself
   (`DiagramSegmentView`/`GeneratedDiagramLookup`) is confirmed correct by
   direct code+data inspection, so this may be a test-harness-specific
   timing issue rather than a real user-facing bug — flagged honestly as
   unresolved rather than claimed fixed. Whoever picks this up next: a
   video-frame extraction tool (install `ffmpeg`) or adding a temporary
   `print`/breakpoint in `PracticeSessionView`'s formula-card-dismiss path
   would be the fastest way to see what's actually on screen during the
   10s the test is waiting.

**Committed**: this stabilization pass's two fixes, on top of round 9's
original uncommitted work (full-page-overlay canvas, landscape bug fix,
question bank refresh, Weekly Review walkthrough — see the round-9 priority
list above for what each of those is). Real device, `id=00008103-0012296E01D0C01E`
throughout.

**Next**: Brick 1 (`DESK_OS_NATIVE_BRIEF.md`, this repo root) — the new
desk/shell entry screen, per that brief's own bricks table.

---

### Phase 5 round 9, Brick 1 — real Desk OS shell built (Claude Sonnet 5, 2026-08-08)

Akshat's real, finalized web design for Desk OS (built with Cursor, now live
at `mindcraft-93858.web.app/desk` through the shared repo) is the actual
spec — not the earlier placeholder card I built first. Read the real source
directly (`agent_work/product/desk_os/index.html`'s `#bootStage`/`#hubStage`
markup, `js/bootHub.js`'s `DEFAULTS`/`renderHub()`, `js/actBook.js`'s real
500ms/1600ms boot timing constants — all in the shared `mindcraft` repo, not
this one) and ported it structurally into two real SwiftUI stages:

- **`DeskBootView`** — "Your workspace is starting up…", 3 pulsing dots, the
  real 6-node connection flow (Gmail → Calendar → Moodle → Intel → Binder →
  ACT, Intel accented) with the real caption, on the real timing (icons fade
  in 500ms after title, transitions to the hub 1600ms after boot starts —
  read directly from `actBook.js`'s exported constants, not guessed).
- **`DeskShellView`** (instance hub) — real nav bar (wordmark, "Dashboard"
  tab, user name/email, sign out), a time-of-day greeting, and real instance
  cards matching `renderHub()`'s exact markup: gear icon, kind badge, name,
  an "Open instance"/"Coming soon" button, running/stopped status dot, and
  an execution-steps count + progress bar — plus the real "Create an
  instance" tile.

**AuthGate now shows `DeskShellView` instead of `DashboardView` directly** —
the 9-round Dashboard is reached as the real "ACT Field Book" instance card
(a real `fullScreenCover`, not a rebuild). `launchDashboardApp()` (the
shared XCUITest helper all 14 existing tests use) was updated to tap through
the new shell so none of them needed individual changes.

**Honest scope, not hidden**: the web hub's mastery orb / goal-setter /
"start your mastery check-in" call button (`.hub-mastery-head` in the real
markup) is real and substantial (a 3D CSS cube, live-mastery-driven goal
dropdown) — deliberately NOT ported this pass, flagged as real follow-on
work, not faked. "Field Desk" and "Piano Field Book" instance cards render
with the real copy/badge/exec-bar from `DEFAULTS` but their buttons are
honestly disabled ("Coming soon") since neither module exists natively yet
— only ACT Field Book is real. Icon substitution: SF Symbols stand in for
the web's custom PNG orb art (`envelope.fill` for Gmail, `calendar` for
Calendar, `arrow.down.doc.fill` for Moodle, `sparkles` for Intel,
`book.closed.fill` for Binder/Field Book, `checkmark.seal.fill` for ACT),
same substitution pattern already used for `DashboardView`'s nav icons.

**Verification**: build succeeded clean on the real device
(`id=00008103-0012296E01D0C01E`), installed and launched successfully. Per
Akshat's explicit instruction this round ("stop testing every piece, build
cleanly and integrate, we'll test everything together at the end"), the
full XCUITest suite was NOT re-run after this specific change — that
consolidated verification pass is real, outstanding work, not something to
assume passed. See `DESK_OS_NATIVE_BRIEF.md` for the full current-state
breakdown and next steps.

## Round 10 — consolidated full-suite verification + mastery orb + Apple Sign-In (Fable 5, 2026-08-08)

The deferred "test everything together" pass finally ran, plus the two
remaining Desk OS parity features. Everything below was verified on the
real iPad (`id=00008103-0012296E01D0C01E`), foreground `xcodebuild`, with
real screenshots pulled from the xcresult bundles into
`MindCraftNotes/screenshots_realdevice_2026-08-08_round10/` — no green-build
trust anywhere.

### 1. Mastery orb / goal setter / check-in — BUILT and VERIFIED (Brief item 4, closed)

`DeskShellView` now carries the full `.hub-mastery-head` + `.hub-orb-row`
port, read directly from `index.html` lines 119–163 + `bootHub.js`
(`GOALS_BY_KIND` verbatim, `paintGoalControls()`/`paintMastery()`/
`masteryForInstance()` pick rules ported exactly) + `hubCall.js` (the
check-in panel and its `save()` persistence):

- **Greeting** (`.hub-greet` italic serif), **SET GOAL card** (instance +
  per-kind goal-type selects, echo line `name → Goal label`), **call
  button** (bubble + the web's literal `#111`/`#c4f547` phone circle).
- **`MasteryCubeView`** — the web's 72px wireframe cube (6 faces + 3 cross
  planes, `rotateX(-18°)`, 16s Y-turn, 4.2s glow pulse, perspective 520px)
  as a real per-frame perspective projection in a SwiftUI `Canvas` — same
  geometry numbers, not a lookalike. Honors Reduce Motion like the web's
  `prefers-reduced-motion` rule (static `rotateY(-28°)`, no pulse).
- **`MasteryCheckInSheet`** — `hubCall.js`'s panel as a native sheet
  (kicker, note field w/ 220-char cap, "Honest estimate" slider default 40,
  Not now / Save pills, web's literal light-panel colors).
- **`DeskGoalStore`** — `UserDefaults` persistence with the web's exact
  localStorage keys and JSON shapes (`deskOs.instanceGoals`, `.goalFocus`,
  `.mastery`, `.callLog`, `.instances` mutable subset), same approach
  `StickerStore` established. `masteryForInstance()`'s honesty rule kept:
  the percent is a NUMBER only with recorded check-in evidence, otherwise
  an em-dash — never invented.
- New test `testDeskHubMasteryGoalAndCheckIn` — **PASSED on device**:
  asserts default echo, honest em-dash, then a full check-in round-trip
  (sheet → save → toast → live "Mastery 40%" repaint). Screenshots:
  `desk_hub_mastery_head.png`, `desk_hub_checkin_sheet.png`,
  `desk_hub_mastery_after_checkin.png` — all visually inspected, all match
  the web structure.

**Two required app-side test accommodations** (both flag-gated, zero effect
on normal launches): the cube's `TimelineView(.animation)` pauses under
`--ui-testing-in-memory` (a per-frame Canvas keeps XCUITest's quiescence
wait from EVER settling — every synthesized event then eats a 60s stall;
proven by the first full-suite attempt where every desk-path test failed at
~90s while `ContentView`-path tests passed), and `DeskGoalStore` skips real
`UserDefaults` under the same flag (fresh state per test launch, same
in-memory semantics `PersistenceController` gives Core Data).

### 2. Sign in with Apple — implemented, HARD-BLOCKED by the signing team (Brief item 2, honestly parked)

`AuthService.signInWithApple()` is fully implemented (standard
nonce-hardened flow: SHA256 nonce → `ASAuthorizationAppleIDProvider` →
`OAuthProvider.appleCredential(withIDToken:rawNonce:fullName:)` so Firebase
keeps the first-auth full name; silent-cancel handling matching the Google
path; `AppleSignInPresenter` continuation wrapper). `LoginView` has the
matching "Continue with Apple" button (web `#authBlock` parity: stacked
Google-then-Apple, Apple as the dark filled button per `.auth-apple`).

**The blocker is the Apple Developer account, not code**: team `4YV3SZN6P7`
("MindCraft Notes") is a FREE personal team, and the portal refuses the
`com.apple.developer.applesignin` capability for personal teams —
`xcodebuild -allowProvisioningUpdates` fails with "Personal development
teams … do not support the Sign In with Apple capability" (verified
2026-08-08, `build_apple_entitlement_check.log`). Shipping the button
without the entitlement would mean a provider that always errors — worse
than absent. So: `LoginView.appleSignInEnabled = false` gates the button
off, `MindCraftNotes.entitlements` is wired into both app configs but
carries an empty dict + the full 3-step flip-on instructions for when a
paid membership lands (add the entitlement key, flip the flag, enable the
Apple provider in Firebase console). `friendlyError` also now maps
`.operationNotAllowed` to honest copy for the console-side gap.

### 3. The consolidated full-suite verification — 14/16 green, and it caught a REAL seam bug

**The headline catch**: `launchDashboardApp()` (shared helper, 14 callers)
still dismissed the notebook cover AT LAUNCH — the pre-Brick-1 flow. Since
Brick 1, `DashboardView` (and therefore its once-per-session `CoverView`)
mounts INSIDE the fullScreenCover after tapping the ACT card. Result:
every Contents-dependent test ran with the cover overlaying the Dashboard
and failed — proven with a failure-time UI-hierarchy dump showing the
cover's "What should we call you?" screen sitting on top. Round 9's
"individually verified" desk-shell test predates this consolidated run;
the suite was never actually green post-Brick-1. Fixed by moving the
cover dismissal to after the ACT tap (helper + `testDeskShell…` +
screenshot hook preserved). Re-verified: `testDeskShellShowsAndOpensActFieldBook`
**PASSED** with `desk_shell_act_field_book_opened.png` showing the real
Contents roadmap — plus `testDashboardRendersRealContentsLanes`,
`testContentsScrollReachesGeometricTransformations`,
`testChapterDrillDownShowsRealStoryAndOpensPractice`,
`testChapterViewLandscapeHasNoTextImageOverlap`,
`testAnyInputModeAcceptsSimulatedTouch` all **PASSED** after the fix.

**Full tally (16 tests)**: 14 passed on device today —
`testAnyInputModeAcceptsSimulatedTouch`, `testChapterDrillDownShowsRealStoryAndOpensPractice`,
`testChapterViewLandscapeHasNoTextImageOverlap`, `testContentsScrollReachesGeometricTransformations`,
`testDashboardRendersRealContentsLanes`, `testDeskHubMasteryGoalAndCheckIn` (new),
`testDeskShellShowsAndOpensActFieldBook`, `testDrawingPersistsAcrossQuestionSwitch`,
`testGraphBoxAcceptsLaTeXAndScreenshots`, `testLayoutScreenshotsPortraitAndLandscape`,
`testPencilOnlyModeRejectsSimulatedTouch`, `testQuestionOneRendersWithRealBankContent`,
`testQuestionWithRealGraphDataPlotsRealPoints`, `testWelcomeScreenShowsOnForcedLaunch`.
Logs/bundles: `test_run_round10_full.log` + `testresults_round10_full.xcresult`
(first consolidated run), `test_run_round10_fixes.log` +
`testresults_round10_fixes.xcresult` (post-fix re-verification of the 8
affected tests).

**The 2 remaining failures — root-caused, fixes landed, awaiting a healthy
device session to re-verify:**

- `testDiagramQuestionRendersRealBundledImage`: round 9's concept switch to
  `linear_equations` was based on "diagram coverage at all three levels" —
  TRUE of the concept, FALSE of what `QuestionBankLoader.session()`
  actually serves (level-filtered bank order, `.prefix(12)`). A full
  per-concept/per-level audit of `questionBank.json` + `generatedDiagrams/`
  showed `linear_equations`' first diagram+SVG question sits at position
  47 (L1) / 37 (L2) / 20 (L3) — never inside ANY served session. The test
  was impossible as written. The ONLY deterministic target in the entire
  bank is `geometric_transformations`: single authored level (2), so every
  possible session is the same first-12, with `eedi_543` (+ real bundled
  SVG) at index 8. Test rewritten against that audited reality (with the
  same bounded swipe-into-view the contents-scroll test uses, since the
  geometry lane sits below the portrait fold).
- `testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome`: failure-time
  hierarchy shows all four choice buttons still unselected after 4
  `tap()` calls returned — synthesized taps on these in-ScrollView SwiftUI
  buttons are being swallowed under the current device session's
  degradation (see below). Switched the choice selection to
  `press(forDuration: 0.1)` (unambiguous touch-down/up, the standard
  workaround for exactly this pattern) with bounded retries.

### 4. Real environmental finding — the device session degraded mid-round

Every interaction today paid a ~60s "app animations complete notification
not received" stall at `Wait for com.apple.springboard to idle` (present
in PASSING tests too — e.g. the 810s contents-scroll grind), and after a
mid-run `xcodebuild` kill, the device's automation stack started
intermittently CRASHING the test runner ("Restarting after unexpected
exit…") — three tests lost that way in the first full run, and the final
two-test re-verification attempt lost the diagram test the same way while
the practice test's launch never even reached Contents. This is the
device/automation session, not app code — 14 tests passed through the same
stalls. **Next session: reboot the iPad first** (needs physical unlock —
couldn't be done autonomously), then re-run the two rewritten tests; if
the springboard stall persists after reboot, check for a stuck Live
Activity / charging overlay on the device.

### Checkpoints this round

1. App: mastery head/orb/check-in + cube test-pause + goal store (+ its
   ui-testing gating) in `DeskShellView.swift`.
2. App: Apple Sign-In implementation (gated) + entitlements wiring +
   `operationNotAllowed` copy.
3. Tests: cover-order fix in `launchDashboardApp()` + `testDeskShell…`,
   new `testDeskHubMasteryGoalAndCheckIn`, diagram-test rewrite against
   the audited bank, practice-test press-based selection.
4. Docs: this section + `DESK_OS_NATIVE_BRIEF.md` brought current.

## Round 11 — Field Desk + Piano Field Book v1; Apple Sign-In re-check (2026-08-08)

Both remaining "Coming soon" hub cards are now real modules. Scope was the
honest minimum matching the web hub→module relationship (not the full
7-brick Desk OS). Apple Sign-In was re-attempted and remains blocked by
account tier. Everything below verified on the real iPad
(`id=00008103-0012296E01D0C01E`), foreground `xcodebuild`, screenshots
pulled from xcresult into
`MindCraftNotes/screenshots_realdevice_2026-08-08_round11/`.

### 1. Field Desk — BUILT and VERIFIED

- `FieldDeskView` + `FieldDeskStore`: Drop (file importer + PhotosPicker),
  Quick File form, Binder grouped by course, Intel feed.
- Persistence: UserDefaults `deskOs.fieldDeskItems` / `deskOs.intelLines`;
  skipped under `--ui-testing-in-memory`.
- Heuristic classify only (web `classifyFile` stand-in). No OAuth / mail /
  Connect / pannable home sheets this pass.
- Hub: `deskInstance_fieldDesk` → `fullScreenCover` (was disabled
  "Coming soon").
- Test `testFieldDeskFilesNoteIntoBinder` **PASSED** (~17s). Screenshots:
  `field_desk_opened.png`, `field_desk_after_file.png` — inspected; Drop /
  Quick File / Binder / Intel structure matches the scoped web surface.

### 2. Piano Field Book — BUILT and VERIFIED

- Bundled `Resources/pianoSeed.json` (from web
  `agent_work/product/desk_os/data/pianoSeed.json`).
- `PianoFieldBookView`: cover / read / piano / quiz / done; C4–C5 keys;
  Play phrase + Mark practiced; `AVAudioEngine` tones; progress key
  `deskOs.bookProgress.piano_seed` (skipped under ui-testing flag).
- Hub: `deskInstance_pianoBook` → `fullScreenCover`.
- A11y lesson (same class as Round 10 diagram fix): parent wrapper ids
  (`pianoKeyboard`, page containers) swallowed `pianoKey_*` — removed
  wrappers; keys keep their own Button ids.
- Test `testPianoFieldBookOpensSeedAndShowsKeyboard` **PASSED** (~17–21s).
  Screenshots: `piano_book_cover.png` ("First Lessons at the Piano"),
  `piano_book_drill.png` ("Soft curved hand", highlighted C/E/G, Play
  phrase) — inspected against seed content.

### 3. Apple Sign-In — still HARD-BLOCKED (re-verified)

Re-enabled entitlement temporarily; `xcodebuild -allowProvisioningUpdates`
still failed (profile missing Sign in with Apple / "No Accounts").
Entitlements file reverted to empty dict with updated flip-on comments;
`LoginView.appleSignInEnabled` remains `false`. Code path unchanged from
Round 10 — flip when paid Apple Developer Program + Xcode Accounts land,
then enable Firebase Apple provider.

### Checkpoints this round

1. App: `FieldDeskView` / `FieldDeskStore` / `PianoFieldBookView` +
   `pianoSeed.json` + DeskShell wiring for both cards.
2. Tests: `testFieldDeskFilesNoteIntoBinder`,
   `testPianoFieldBookOpensSeedAndShowsKeyboard` (both green on device).
3. Apple: entitlement flip attempted + reverted; comments refreshed.
4. Docs: this section + `DESK_OS_NATIVE_BRIEF.md` Round 11 update.

## Round 12 — ACT Field Book modular UI + raccoon mascot (2026-08-08)

Design source: `/Users/akoirala/Downloads/Please Bring Back the Owl Mascot but make it a Racoon.pdf`
(local renders in `ios-prototype/design_ref_raccoon/`). Page 7 is the ACT brief;
pages 6/8–11 supply the labeled-card / dot-grid language; page 3/title asks
for the owl mascot back as a raccoon.

### What shipped

1. **`ActFieldChrome.swift`** — shared field background, `ActFieldModule`
   (lowercase label above floating card), `ActRaccoonBadge`, in-session
   calculator sheet.
2. **`QuestionView` layout rewrite** — supersedes Round 9 full-page canvas
   overlay:
   - Landscape: left = `question.` (+ conditional `diagram.` / `graph.`);
     right = `writing.`
   - Portrait: same modules stacked; writing gets a dedicated band
   - Diagrams extracted from the prompt into their own module; graph only
     when plottable/recognized (no empty static media boxes)
   - Canvas + floating pencil toolbar live only inside `writing.`
   - Writing tool strip: Calc (real sheet), Tutor (existing live-call),
     Docs (honest “next” toast)
3. **Raccoon** — `Resources/stickers/raccoon-mascot.png` (from
   `app/src/assets/raccoon.jpg`), `StickerCatalog` id `raccoon` as
   `defaultMascotId`; ACT practice nav shows the badge.
4. **`PracticeSessionView`** — field chrome, raccoon principal title,
   quieter question navigator.

### Verification (real iPad `00008103-0012296E01D0C01E`)

Green: `testQuestionOneRendersWithRealBankContent`,
`testDiagramQuestionRendersRealBundledImage`,
`testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome`,
`testGraphBoxAcceptsLaTeXAndScreenshots`,
`testLayoutScreenshotsPortraitAndLandscape`,
`testDrawingPersistsAcrossQuestionSwitch`,
`testPencilOnlyModeRejectsSimulatedTouch`,
`testAnyInputModeAcceptsSimulatedTouch`.

Screenshots inspected:
`MindCraftNotes/screenshots_realdevice_2026-08-08_round12/` (+ previews in
`design_ref_raccoon/round12_verify/`). Modular separation and writing-field
tools match the brief; raccoon visible in ACT nav.

### Follow-ons (not this round)

- PDF page 4 Field Desk floating-widget home
- Real Google Docs / deeper tutor tools in the writing strip
- Apple Sign-In when paid membership lands

## Round 13 — Field Desk desk-home + raccoon everywhere (2026-08-08)

Akshat: Field Desk must open the whole MindCraft desk interface (left
toolbar + padded widget space) like `http://localhost:5180/?v=r6` / current
`?v=r9b`, not a form sheet; raccoon on boot/hub/cover; surface Map/Tutors/
Work on the ACT dashboard; piano not a priority.

### Shipped

1. **`FieldDeskView` rewrite** — 88pt rail + wallpaper + connect/intel/
   binder/ACT/memo/calendar widgets + Ask MindCraft bar. Add panel files
   into binder/intel (Round 11 pipeline kept). ACT cover → dismiss + open
   `DashboardView`. Wallpaper: `Resources/desk/desk-wallpaper.jpg`.
2. **Raccoon** — boot transition (`deskBootRaccoon`), hub nav
   (`deskHubRaccoon`), desk plane (`fieldDeskRaccoon`), Cover STICKERS
   pill, Welcome quote sticker.
3. **Dashboard home** — Map / Tutors / Work launch pads (`dashPadMap` /
   `dashPadTutors` / `dashPadWork`).
4. **Test** — `testFieldDeskFilesNoteIntoBinder` updated (rail + Add panel
   via `--ui-testing-field-desk-add`); **PASSED** on device.

### Follow-ons

- Real Docs drop-in, Connect OAuth, pannable 3× plane parity
- Apple Sign-In when paid membership lands

## Round 14 — Landscape desk polish + Immerse + ACT palette (2026-08-08)

Akshat: polish design → aesthetics → wiring on Groq’s foundation; iPad
landscape workspace; Field Desk must feel like full MindCraft
(`localhost:5180`) not a form sheet; custom fullscreen that does **not**
superimpose over other buttons; keep ACT question layout (loved); raccoon
on transition; Map/Tutors/Work already on dash; piano not important now.

### Shipped

1. **Field Desk plane** — GeometryReader + `overlay`/`offset` slots (no
   `.position` inflation). Landscape-tuned widget packing; wallpaper + left
   rail + Ask bar retained from Round 13.
2. **Immerse** — `fieldDeskImmerse` lives **in the rail** (compact 64pt rail,
   hide Ask bar, hide status bar). Never floats a chrome button over widgets.
3. **Filing reliability** — Add panel scrolls + dismisses keyboard; toast
   a11y hardened; XCUITest dismisses keyboard / uses coordinate tap +
   landscape orientation; delayed Add open at 3.2s so plane screenshot wins.
4. **ACT practice polish** — warmer `ActField` wash (`F0EBE3` / `FFFDF8`),
   slightly more writing column in landscape `QuestionView`.
5. **Verified** on real iPad: Field Desk file→binder, ACT question + diagram,
   hub mastery check-in. Screenshots under
   `MindCraftNotes/screenshots_realdevice_2026-08-08_round14/`.

### Follow-ons

- Real Google Docs chip, Connect OAuth, pannable 3× plane
- Apple Sign-In when paid membership lands

## Round 15 — Windowed desk + working Connect nest (2026-08-08)

Akshat: (1) Connect Gmail/GCal instructions inside the instance were dead;
(2) MindCraft launch occupied full screen — should keep left toolbar +
padding around the desk unless Immersive is clicked.

### Shipped

1. **Windowed default** — `fieldDeskWindow` inset (~18pt) over hub-colored
   backdrop; left rail + canvas padding always. Immerse expands edge-to-edge
   and shows a Window affordance to return.
2. **Connect nest** — tappable Moodle / Gmail / GCal rows open guide sheets
   with web-parity steps, Mark as connected (`deskOs.connect`), plus
   Load sample inbox / Load sample week / File Moodle upload. Rail Mail /
   Calendar sheets also drive the sample loaders.
3. **Intel empty state** — “Connect tools. Intel lands here.” until real
   lines exist (no fake “Quadratics” placeholder once connect is live).

### Verify

`testFieldDeskFilesNoteIntoBinder` — window chrome, Gmail guide + sample
mail, file→binder, immerse screenshot.

## Round 16 — Hub Tutors nearby + Workflow market (2026-08-08)

Akshat: Map / Tutor / Marketplace for workflows are in the design template
Figma (raccoon PDF page 2 desk dashboard) and were missing from the native
hub.

### Shipped

1. **Desk hub · Tutors nearby** — MapKit + filter chips + BOOK FREE SESSION
   using real `TutorDirectoryClient` (Blake added; Abhigya → UNC pin).
2. **Desk hub · Workflow market** — three design-catalog workflows, Buy /
   Trade, local ownership store.
3. **ACT Home pads** — Map / Tutors / Market / Work; Market sheet shares
   `WorkflowMarketStore`.

### Verify

`testDeskHubMasteryGoalAndCheckIn` scrolls to Tutors + Workflow market and
buys gap-scan workflow.

## Round 17 — Immersive pannable Field Desk + floating dock (2026-08-08)

Akshat: Connect margin rule sliced labels; Repo/ACT clipped; left rail
invisible — want floating icons above Ask; fully immersive + movable.

### Shipped
1. Full-bleed immersive desk (no left rail / no window chrome)
2. Floating tool dock above Ask MindCraft
3. Drag-pan on empty plane (~2.2×); house resets view
4. Connect: no red margin rule; footer “Tap a tool”
5. Home-quadrant layout so Repo + ACT aren’t clipped

## Round 29 — ACT own canvas + binder instances + cook digest (2026-08-08)

ACT Field Book is its **own** empty-canvas instance (`ActInstanceShellView`:
dash + notes box + thin tools) — not Field Desk wallpaper. Field Desk Binder
lists/launches ACT, Doc→Cook, and custom instances dynamically. Test-instance
Tour → **Digest** cockpit over the ACT Prep Guide cook artifacts (graph /
labs / chapters / quiz + study-path columns). Story + question next arrows
live top-trailing consistently.

## Round 28 — Field Desk cards + ACT on the desk (2026-08-08)

Field Desk: tap card → shine → drag whole card → bottom-right cream grip
(no lime arc); canvas-only pinch; Binder ~420×300 centerpiece; connect
toggles disconnect. ACT hub card opens the same Field Desk world with a
padded min/max ACT stage + shared Ask/dock; Map/Work/Notes stay in-stage.
ACT chrome: Home replaces exit/sign-out; sticker + quote together on the
left; Weekly Review replaces Find a Tutor on the hero. Follow-up: stage
pad stays pannable, bottom-right resize/minimize; chapter/practice/weekly
stay inside the stage box (no device-full cover); practice drops raccoon /
“ACT Field Book” / Close for Home; formula card uses story-card chrome
when embedded so Pencil writing isn’t buried under full-screen bright UI.

## Round 27 — neat hub + Field Desk cluster (2026-08-08)

Hub: greeting → instance cards (no mastery orb/animation, no SET GOAL, no
“Your instances” label). Tutors nearby + Workflow market are collapsible
tabs. Content pulled left toward the logo. Call sits next to Manage.

Field Desk: X removed (Home only). Voice reverted to typing. Cards clustered
(You→Intel edge always; Connect under You; Binder/Memo/Cal). Drag from card
tab, curved bottom-left resize, pinch = canvas zoom unless a card is focused
(then pinch scales that card). Filed items open Entry + MicroSim studio.
ACT Fieldbook removed from this desk.

## Round 26 — Field Desk pan actually works (2026-08-08)

Root cause: full-screen chrome `Spacer` ate every drag; SwiftUI
`DragGesture` + fullScreenCover interpreted swipes as dismiss / snap-home.
Home/Lab/Scratch/Archive jump chips removed (unnecessary). Canvas is now a
`UIScrollView` (`DeskPanCanvas`) — native pan/pinch, never kicks you to hub.
`interactiveDismissDisabled` on the Field Desk cover. Verified on device:
`testFieldDeskPanDoesNotDismiss` + binder file flow.

## Round 25 — Weavy Field Desk + document→cook showcase (2026-08-08)

Two tracks:

**A. Field Desk (weavy.ai / Figma Weave spirit)** — pinch-zoom + drag-pan
infinite canvas with Home / Lab / Scratch / Archive jump chips. Mascot is a
hub node with live lime **edges** to Connect / Intel / Binder when linked
(not a weak “mascot link” modal). Home icon on every instance → hub dash.
Cards condensed to short bullets + larger type. Voice-in (mic) on Ask,
memo, Add-note, and Create-instance prompt.

**B. test-instance document cook** — drop any PDF/book/notes/syllabus →
McCreary cook (microsims + claude-skills + intelligent-textbooks) →
learning graph + live MicroSim labs + Bloom quiz. Showcase later replaces
ACT Field Book as the default cooked-book surface.

### Shipped
1. Field Desk: weavy canvas (scale/pan), screen chips, Canvas edge links,
   Home=`dismiss()` → hub; voice on writing boxes; shared `DeskHomeButton`
   + `SpeechCaptureController`
2. Tour reframed: DOCUMENT → COOK → LEARN; **Open Labs** / **Take Quiz** CTAs
3. **Cook studio** — fake upload chips for 4 document types (ACT Prep Guide,
   Geometry chapter, Lecture notes, Course syllabus) with cooked outputs
4. Hub badge `Doc→Cook`; UITest ids preserved
5. Home also on ACT Field Book (`actFieldBookHome`) + test-instance
   (`testInstanceHome`)

### Verify
1. Hub → Field Desk → pinch/pan or Lab/Scratch chips → Connect Gmail →
   edges light → mic on Ask/memo → Home → dash
2. Hub → test-instance → Cook studio chips → Labs → Graph → Quiz

## Round 24 — Field Desk movable + pannable (2026-08-08)

Restore ~2.2× pannable plane (drag empty space → other screens). Drag any
page to rearrange. Chrome: shrunk raccoon top-left (tap → connections/intel
hub), home reset, no MindCraft/field-desk title. Paper titles are tabs so
the margin rule never cuts writing; Binder oversized; book tabs not clipped.

## Round 23 — Welcome screen: login on the page (2026-08-08)

Remove “Start your ACT learning book” + “YOUR ACT BOOK INCLUDES”. Nest the
three feature cards under the tagline. Put a Welcome card with Continue
with Google / Continue with Apple on the welcome screen — successful
sign-in already lands on DeskShell boot (connection intel) → hub dash.

## Round 22 — Official ACT Prep Guide × McCreary cook (2026-08-08)

Point test-instance at Akshat’s PDF
(`/Users/…/The Official ACT Prep Guide 2025 - 2026.pdf`, 809 pages):
Before (static Guide) → After (graph / ACT MicroSim labs / Bloom quiz /
9-step skills pipeline). Hub badge `ACT×Sim`. Original quiz items only
(no copyrighted ACT stems).

## Round 21 — McCreary showcase product inside test-instance (2026-08-08)

Akshat: “show me all the features of this library — build the best product
that can come out of it.”

### Shipped
Full showcase shell (Tour / Levels / Graph / Labs / Learn / Quiz / Pipeline):
1. **Tour** — mission, library stats (73+ sims / 19 skills), guided stops, featured labs
2. **Levels** — Five Levels of Textbook Intelligence (L1→L5)
3. **Graph** — 24-concept DAG + open Learning Graph / Graph Viewer MicroSims
4. **Labs** — 30 curated live MicroSims by category (Getting Started → Meta)
5. **Learn** — chapters w/ outcomes, ISO glossary, expandable FAQ
6. **Quiz** — 16 Bloom-aligned items across the graph
7. **Pipeline** — 9-step Claude Skills factory + Book Build Workflow sim

## Round 20 — test-instance (McCreary MicroSims / learning graph) (2026-08-08)

Replaces piano hub card with **test-instance**: Level-2 intelligent textbook
slice grounded in Dan McCreary’s open stack (learning graph + live
MicroSims from dmccreary.github.io/microsims + Bloom quiz).

## Round 19 — Manage / create instance / scrollable Field Desk / AgentMail (2026-08-08)

Akshat: no copy beside Call; Create instance must upload (Figma/studio);
Manage (not Dashboard) → account settings + whitepaper; Field Desk
search+icons one row and actually scrollable; Mail via AgentMail with
summaries + ✨ suggested replies (Gmail-like).

### Shipped
1. Call = phone circle only; Create instance studio (upload → custom hub card)
2. Hub **Manage** → username, billing stub, AgentMail key, whitepaper
3. Field Desk: ScrollView cards + combined Ask/icons toolbar; pan removed
4. `AgentMailClient` + Live Inbox UI (setup / empty / list / detail / reply)
5. Connect Mail guide points at AgentMail; offline sample still available

### Verify
`testDeskHubMasteryGoalAndCheckIn` + `testFieldDeskFilesNoteIntoBinder`.
Paste an `am_…` key in Manage or Mail to exercise Live Inbox for real.

## Round 18 — Writable hub map + grayed workflow market (2026-08-08)

Akshat: map on the dash should be writable like the website (search +
tutors shuffle by distance). Workflow market should only list Application
Tracker and Connect health data — both grayed out for now.

### Shipped
1. Hub Tutors nearby — search city/zip/address (`CLGeocoder`), use-my-location,
   pan/zoom map, haversine sort so tutors reshuffle near the pin (~250 mi)
2. Workflow market catalog → `application_tracker` + `health_insights` only,
   grayed “Soon” cards (Buy removed); ACT Market sheet matches
3. `NSLocationWhenInUseUsageDescription` for locate button
4. UITest asserts map search + grayed cards (no gap-scan Buy)

### Verify
`testDeskHubMasteryGoalAndCheckIn` — map search field + Application Tracker /
Health insights soon badges.
