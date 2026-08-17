# MindCraft — handoff for Cursor (and sibling agents)

**Canonical live checkout:** `/Users/akoirala/Developer/mindcraft`  
**Read this at the start of every session.** Full project brief: `CLAUDE.md`. Current shipped/open work log: `ACTIVE_TASK.md` (read the top).  
**Canon (brand / vision / pedagogy / research):** `docs/canon/README.md` — Brand Book PDF `BRAND_BOOK.pdf`; Research Constitution `agent_work/research/`.  
Manjushree landing-panel brief: `agent_work/manjushree-zone/LANDING_PANEL_HANDOFF.md`.

---

## Operating model (2026-08-16): Claude plans, Cursor codes

As of this handoff, Claude Code (terminal, run by Akshat) is the **command
center** — it reads device/CI state, makes architecture calls, writes the
task spec below, and audits Cursor's finished work against it. **Cursor
executes from the spec it finds here** — don't invent scope beyond it, and
don't start a new direction without one.

### The loop
1. Akshat describes a problem/goal to Claude (in terminal, sometimes with a
   hand-drawn layout/size sketch — see below).
2. Claude investigates the real repo/device/CI state (never assumes), makes
   the calls that need a person only when genuinely ambiguous, and writes a
   scoped spec into **"Next assignment for Cursor"** below, overwriting the
   previous one once it's been picked up.
3. Cursor reads this file, implements **exactly that scope**, verifies per
   the spec's own checklist, and appends a dated result note under
   **"Cursor's last report"** (what shipped, what verification actually ran,
   any deviation and why).
4. Claude reads that report at the start of its next session, audits it
   against real repo/CI/device state (not just the report's own claims), and
   writes the next spec. Repeat.

### Spec format (what Claude writes for Cursor)
Every assignment states, explicitly:
- **Goal** — the actual problem, one or two sentences, not just a feature name.
- **Files in scope** — exact paths. Cursor should not touch files outside this
  list without flagging it back in the report.
- **Constraints** — lane ownership (see below), anything explicitly NOT to
  change, existing patterns to match (e.g. "match `TileKind`'s enum-switch
  shape, don't introduce a class hierarchy — see CLAUDE.md's
  accessibility-identifier-clobbering gotcha").
- **Definition of done** — a concrete, runnable check: `xcodebuild build`
  passes, a specific `xcodebuild test -only-testing:` target passes, a
  screenshot of a specific screen state. Not "looks right."

### Hand-drawn layout references
When Akshat hand-draws box sizes/positions as a template, photograph it and
drop it in `agent_work/product/design_refs/` (create if missing), named by
date + surface (e.g. `2026-08-16_desk_grid_sizes.jpg`). The task spec below
should point Cursor at the exact filename and which measurements to treat as
load-bearing vs. illustrative — a photo alone, with no spec pointing at it,
won't reliably translate into exact point values.

### Next assignment for Cursor

Five sequenced assignments below (2026-08-16 planning session with Akshat).
**Do them in order, A→E, one PR branch per letter, one report entry per
letter.** Later ones assume earlier ones landed — don't jump ahead. Each
needs `xcodebuild build-for-testing` green (device or simulator) before its
report is written; CI (`iOS simulator build+test`) is the real gate before
merge, same as PR 43 — see "How this handoff gets written" above.

**Assignments A and B are done and merged (2026-08-16, `fe54a37e`,
`b76afc88`) — start on Assignment C next.** Open a fresh branch off current
`main`, same as B did (branching off-tip is what kept B conflict-free,
unlike A).

---

#### Assignment A — Consolidate Binder onto `BinderStore`, revive BYOB ✅ DONE

**Goal.** The Work Dashboard's Binder tile currently reads
`FieldDeskStore.FiledItem` (`FieldDeskView.swift:690`,
`binderTitles: Array(store.items...)`) and tapping it jumps straight to ACT
Field Book (`DeskGridDashboardView.swift`'s `handleTile(.binder)` →
`onOpenBinder` → `showActFieldBook = true`). Meanwhile a *second*,
already-built, Storage-backed, security-reviewed Binder system
(`BinderStore.swift`, `binder_items` Firestore collection, real file uploads
via `CreateInstanceStudioView.swift`'s BYOB — "Bring Your Own Book" — flow)
exists but is only reachable through `StandaloneDeskView`, which CLAUDE.md
explicitly marks as the deprecated old web desk ("Do not send Work to
StandaloneDeskView"). That's why upload-a-PDF-and-file-it-into-Binder
"disappeared" — it's not broken, it's stranded behind a surface nobody
routes to anymore. Fix: make `BinderStore` the one real Binder data source,
and give the Work Dashboard's Binder tile a real popup (same shape as
`intelOverlayLayer` in `FieldDeskView.swift:2965` — a fixed card, Done
button, `.accessibilityIdentifier`) with **Memo / Doc / BYOB** sections (the
proven taxonomy already used in the old web Binder) plus ACT Field Book as
one entry inside it, not the tile's sole destination.

**Files in scope:**
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/FieldDeskView.swift` —
  new `binderOverlayLayer` (mirror `intelOverlayLayer`'s shape exactly),
  own a `BinderStore` instance the same way `StandaloneDeskView` does
  (`@StateObject private var binderStore = BinderStore()`), wire
  `onOpenBinder` to show it instead of jumping straight to
  `showActFieldBook`.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/DeskGridDashboardView.swift`
  — `binderTitles` should read from the new `BinderStore` (passed in), not
  `FieldDeskStore.FiledItem`.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/CreateInstanceStudioView.swift`
  — reuse as-is (`CreateInstanceStudioView(binderStore:onCreated:)` already
  supports this), just give it a new entry point from the binder popup's
  BYOB section instead of `StandaloneDeskView`.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Networking/BinderStore.swift`
  — read, don't restructure, unless the Memo/Doc/BYOB section split needs a
  small query helper.

**Constraints:**
- Don't delete `FieldDeskStore.FiledItem` or its call sites — Jesse's
  Kitchen's own filing (Intel etc.) may still depend on it; if you find it's
  now fully redundant with `BinderStore`, flag that in the report rather
  than deleting unilaterally.
- Don't touch `StandaloneDeskView.swift` / `worlds/deskweb/desk.html` — old
  web desk, out of scope, leave it working for whatever still reaches it.
- `FieldDeskView.swift` is flagged in CLAUDE.md as the highest-risk file in
  the app (overlay hit-testing / accessibility-identifier-clobbering bug
  class, documented at length there) — read that section before adding the
  new overlay, and add `showBinderOverlay` to `deskOverlayChromeBlocked` per
  its own doc comment.
- Match `intelOverlayLayer`'s existing visual language (cream card,
  `fdHex` palette, Done capsule) — don't invent a new visual style for this.

**Definition of done:** tapping Binder on the Work Dashboard opens a real
popup with Memo/Doc/BYOB sections (not an immediate jump to ACT Field
Book); uploading a file via BYOB produces a real `binder_items` Firestore
doc with `type: "byob"` and a Storage blob under `binder/{uid}/{itemId}/`;
the item then shows up in the popup's Doc/BYOB list. `xcodebuild build` +
`build-for-testing` green. New XCUITest: open Binder popup, verify
Memo/Doc/BYOB sections exist by accessibility id.

---

#### Assignment B — Real content rows in Intel/Email tiles, not mascot+list ✅ DONE

**Goal.** When a dashboard box is "hungry" (grown via `DeskBoxBus.requestSpace`
— tap-to-grow, neighbors shrink, this behavior is correct and must not
change), it currently layers a scaled-down mascot image behind a plain
stacked-text list (`tileBody`/`tileLines` in `DeskGridDashboardView.swift`).
Akshat wants the same real row styling used in the full popups
(`intelBody`'s dot+line+divider rows, `GmailWorkflowBoxView`'s subject-row
styling) to be what's shown in the grown tile too — one visual language for
"this box's real content," not two. Don't embed the popups' fixed-size views
directly into a resizable tile (that's the accessibility-identifier/layout
clobbering trap documented repeatedly in CLAUDE.md) — extract the row itself
as a small shared view, sized by whichever parent gives it space.

**Files in scope:**
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/DeskGridDashboardView.swift`
  — `tileBody`/`tileLines`/`mascotArt` (kill the mascot layer when
  `tileShowsContent` is true; the real rows replace it, not sit behind it).
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/FieldDeskView.swift` —
  `intelBody` (extract its row as a shared small view).
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/GmailWorkflowBoxView.swift`
  — same extraction for its subject rows.
- New shared file if the extracted row view doesn't have an obvious home:
  `ios-prototype/MindCraftNotes/MindCraftNotes/Views/DeskContentRow.swift`.

**Constraints:** keep the mascot for the non-hungry (sleeping/working) state
— this only changes what shows once a box has real data and is grown. Don't
touch `DeskBoxBus`/`negotiated(...)` sizing logic — that's the resize
behavior Akshat explicitly said to preserve.

**Definition of done:** grow Email (has a digest) — see real digest rows
using the same row style as the Gmail popup, no mascot underneath.
Same for Intel. `xcodebuild build` green, existing
`testDashboardBoxMascotsExist` still passes (sleeping-state mascots still
render).

---

#### Assignment C — Bring-your-own AI key (Keychain), targeting homework help

**Goal.** `mindcraft-homework` (Anthropic-powered problem solver, stateless,
`homework/` dir, Cloud Run) is currently down — shared Anthropic credits
exhausted, documented in `CLAUDE.md`. Let a student optionally connect their
own free-tier AI key (Groq recommended — fastest free tier; Anthropic as an
alt) so homework help keeps working for them specifically, without any
backend/Engine-lane change. The iOS app calls the student's own key directly
against the provider's plain REST endpoint for this feature only.

**Files in scope:** new
`ios-prototype/MindCraftNotes/MindCraftNotes/Networking/StudentAIKeyStore.swift`
(Keychain-backed — **never** Firestore/UserDefaults/logs for the raw key),
a new settings row (find the existing account/settings surface —
`AccountManageView.swift` is the likely home, confirm before assuming) to
add/remove/test the key, and whichever view currently calls the (down)
homework endpoint (`grep -rn "mindcraft-homework\|recommend-ingredients" 
ios-prototype/` to find it) — add a "use your own AI key" path there when a
key is present, falling back to the existing `/recommend-ingredients`
behavior when it's not.

**Constraints:** Keychain only for the raw key, full stop — this is not
negotiable, flag back rather than improvising storage if Keychain access
turns out awkward from wherever the settings view lives. Never send the key
anywhere except the provider's own API host. This is Product/iOS-lane-only
by design (see Goal) — if implementing this turns out to need a webhook or
`ml/` change, stop and flag it rather than crossing into Engine's lane
unannounced.

**Definition of done:** with no key set, homework help behaves exactly as
today (falls back, no crash). With a valid student-provided Groq key set,
a homework question gets a real answer sourced from that key. `xcodebuild
build` green. Confirm via a real device test with a real (your own test)
free Groq key — not just that the code compiles.

---

#### Assignment D — Extend Drive storage to more Binder-sourced content

**Goal.** `DriveClient.swift` already archives Gmail into the student's own
Drive folder ("The Desk") via the narrow `drive.file` scope (only ever sees
files this app itself creates) — durable storage outside MindCraft's
backend, at zero cost to MindCraft. Extend that same pattern to Binder-filed
notes/transcripts/BYOB uploads once Assignment A lands (needs `BinderStore`
consolidated first).

**Files in scope:**
`ios-prototype/MindCraftNotes/MindCraftNotes/Networking/DriveClient.swift`,
`BinderStore.swift`.

**Constraints:** reuse the existing `drive.file` write scope and folder
convention — don't request a broader Drive scope. Depends on Assignment A;
don't start until it's landed and reported.

**Definition of done:** filing a Binder item also produces a corresponding
file in the student's "The Desk" Drive folder. `xcodebuild build` green.

---

#### Assignment E — Subagent settings panel (connect/reorder existing boxes)

**Goal.** Let students see, connect/disconnect, and reorder the five
existing box kinds (Intel/Moodle/Binder/Email/Gcal) from a settings surface.
This is deliberately **not** "let students define new custom subagent
types" — that's a bigger, separate vision-level idea, explicitly out of
scope here. Most of the plumbing already exists (`DeskBoxBus`, per-box OAuth
via `GmailClient`/`MoodleClient`) — this is mostly a settings UI on top of
what's already there.

**Files in scope:** `AccountManageView.swift` (or wherever Assignment C's
settings row landed — keep them together), `DeskGridDashboardView.swift`
(read a persisted box order/visibility instead of the current fixed order).

**Constraints:** don't change `DeskBoxBus`'s core mediator logic, this is
additive UI only.

**Definition of done:** disconnecting Moodle from settings makes its tile
show sleeping/disconnected state without restarting the app; reordering
persists across relaunch. `xcodebuild build` green.

### Cursor's last report

**2026-08-16 — Assignment A (BinderStore + BYOB popup)** — branch `cursor/binder-store-byob-2c98`

Shipped: Work Dashboard Binder tile no longer jumps to ACT Field Book. It opens a cream-card popup (`binderOverlayLayer`, same Done-capsule / `fdHex` language as `intelOverlayLayer`) with Memo / Doc / BYOB sections plus ACT Field Book as one row inside. BYOB's "Bring your own book" presents existing `CreateInstanceStudioView(binderStore:)` as-is; that path already writes `binder_items` with `type: "byob"` and Storage at `binder/{uid}/{itemId}/`. The popup lists those items from the same `BinderStore` instance Field Desk now owns.

Files:
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/FieldDeskView.swift` — `@StateObject binderStore`, `showBinderOverlay` on `deskOverlayChromeBlocked`, overlay at zIndex 89, no wrapper `.accessibilityIdentifier` (marker Text `fieldDeskBinderOverlay` instead), BYOB fullScreenCover.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/DeskGridDashboardView.swift` — `binderTitles` from BinderStore; empty-state blurb "Memo, docs, and your own books."
- `ios-prototype/MindCraftNotes/MindCraftNotes/Networking/BinderStore.swift` — small `items(types:)` helper only. Memo=`memo`, Doc=`doc`+`book`, BYOB=`byob`.
- `ios-prototype/MindCraftNotes/MindCraftNotesUITests/MindCraftNotesUITests.swift` — `testWorkBinderPopupHasMemoDocBYOB`.
- `CreateInstanceStudioView.swift` / `StandaloneDeskView.swift` / `worlds/deskweb/desk.html` — untouched.

Verification: this environment is Linux; `xcodebuild build` / `build-for-testing` cannot run here. CI (`iOS simulator build+test`) is the gate. New XCUITest asserts overlay + Memo/Doc/BYOB ids + BYOB button + ACT Field Book row, and that `fieldDeskActNotesPopup` is not present after the Binder tap.

Flagged, not deleted:
- `FieldDeskStore.FiledItem` is still live for Jesse's Kitchen filing (`store.items` / `openEntry` / `entryStudio` / file-drop `store.fileDrop`). Not redundant with BinderStore.
- `BookWorkflowView` still owns a separate `BinderStore()` instance. Out of Assignment A scope.
- Kitchen fileImporter still files into `FieldDeskStore`, not BinderStore.

Did not start Assignments B–E or transcript-to-Drive (Assignment D).

**2026-08-16 — Claude's audit of Assignment A** — PR 44 merged (`fe54a37e`).

Real, correctly-followed work: matched `intelOverlayLayer`'s visual language, put `showBinderOverlay` on `deskOverlayChromeBlocked`, used the marker-Text pattern (not a wrapper identifier) to dodge the clobbering bug, reused `CreateInstanceStudioView` as-is, left `FieldDeskStore.FiledItem`/`StandaloneDeskView` alone as instructed, shipped a real test. Not rubber-stamped.

One thing the report didn't catch (Linux env, no `xcodebuild`, so it couldn't have): PR 44 forked from `dc679110` — a commit that predates PR 43's Level 2 connectors/mascot merge by minutes. Real conflict on `DeskGridDashboardView.swift`/`FieldDeskView.swift`, not just line drift — PR 44's own `tileBlurb()` helper predated the `mascotPhase`-driven `tileBody()` system entirely. Resolved by keeping main's structure (it already covered `binderTitles` as real content lines) and folding in PR 44's actual new content (updated Binder blurb copy, `BinderStore` as source). Caught and fixed one real bug the raw merge would've shipped: `binderHasData` (drives the mascot's sleeping/awake state) was still pointed at `FieldDeskStore`, which would've made the mascot disagree with what the popup shows. Repointed it at `BinderStore` alongside `binderTitles`.

Verified for real, not just compiled: `xcodebuild build-for-testing` green, `testWorkBinderPopupHasMemoDocBYOB` + `testDashboardBoxMascotsExist` both pass on-simulator, then installed directly onto the physical iPad and launched clean. CI (`iOS simulator build+test`) passed at 37m40s. Merged to main.

Cursor's two flagged loose ends (`BookWorkflowView`'s separate `BinderStore()` instance, Kitchen's `fileImporter` still filing into `FieldDeskStore` not `BinderStore`) are real and worth remembering, not urgent — noted for whoever picks up Binder work next.

**2026-08-17 — Assignment B (real content rows in Intel/Email tiles)** — branch `cursor/desk-content-rows-2c98`

Shipped: grown (hungry) Intel/Email tiles no longer layer a scaled mascot behind stacked `Text`. Rows are `DeskContentRow` — same dot + title + optional subtitle/divider primitive as `intelBody` and Gmail digest subject rows. Sleeping/working/not-yet-grown tiles still show the mascot (`testDashboardBoxMascotsExist` still valid). `DeskBoxBus` / `negotiated(...)` untouched.

Files:
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/DeskContentRow.swift` — new shared row; no wrapper `.accessibilityIdentifier`.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/DeskGridDashboardView.swift` — hide mascot when `tileShowsContent && hungry`; Email grown tile uses digest subject+why rows (headline + FYI count when grown), fallback to seeded subjects; `deskGridEmailSummaries` id kept on the tile body VStack.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/FieldDeskView.swift` — `intelBody` now composes `DeskContentRow`.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/GmailWorkflowBoxView.swift` — digest action-item rows now compose `DeskContentRow`. Inbox message cards (from/date/subject/snippet white cards) left as-is — different primitive than the digest subject row.
- `ios-prototype/MindCraftNotes/MindCraftNotes.xcodeproj/project.pbxproj` — added `DeskContentRow.swift` to the app target.

Verification: this environment is Linux; `xcodebuild build` / `build-for-testing` cannot run here. CI (`iOS simulator build+test`) is the gate. Did not add a new XCUITest (not in Assignment B files-in-scope); existing `testDashboardBoxMascotsExist` + `testWorkDashboardShowsSeededEmailSummariesAndAsksNeighborsForSpace` should cover sleeping mascots and grown Email subjects.

**2026-08-17 — Claude's audit of Assignment B** — PR 45 merged (`b76afc88`).

Cleanest handoff yet — branched off current `main` (learned from A's conflict), so no reconciliation needed this time. Read `DeskContentRow.swift`: genuinely well-designed, not just adequate — the `compact` flag handles tile-vs-popup sizing without a fixed frame, exactly the "parent sizes it" shape the spec asked for. Diffed `intelBody` and the Gmail digest rows against their pre-change versions: the extracted markup is byte-for-byte identical (same fonts, colors, spacing) to what was inlined before, just deduplicated — zero visual drift, confirmed by reading, not assumed.

Verified: `xcodebuild build-for-testing` green, `testDashboardBoxMascotsExist` + `testWorkBinderPopupHasMemoDocBYOB` (Assignment A's test — confirms B didn't regress A) both pass on-simulator. CI passed at 40m4s. Did not get a physical-device visual pass in before merging — iPad was disconnected at merge time; simulator + code review gave enough confidence given this is pure UI-composition (no OAuth/Storage/device-only APIs involved, unlike Assignment A). Will confirm on-device next time it's connected.

**2026-08-17 — Assignment C (bring-your-own AI key)** — branch `cursor/student-ai-key-2c98`

Shipped: optional student Groq (default) / Anthropic key in the Keychain, Settings row to add/remove/test it, and Work "Get hints" uses that key against the provider's own REST host when present. No key → existing `/recommend-ingredients` path unchanged. No webhook/`ml/` changes.

Files:
- `ios-prototype/MindCraftNotes/MindCraftNotes/Networking/StudentAIKeyStore.swift` — Keychain only (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`). Presence is published; raw key is read only for provider calls. Hosts allowed: `api.groq.com`, `api.anthropic.com`.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/AccountManageView.swift` — Homework help section (save / test / remove). Draft field is cleared after save; status never shows the raw key.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Networking/HomeworkClient.swift` — `IngredientHintsClient.hints` takes the student-key path first.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/WorkPracticeView.swift` — maps key-rejected vs engine-unavailable errors.
- `project.pbxproj` — added `StudentAIKeyStore.swift`.

Flagged:
- Photo-upload parse (`HomeworkClient.parseAndCreateSession` → webhook `/api/parse-homework`) is a different Anthropic path and is unchanged. Assignment C targeted the paste-a-problem solver that already fell back to `/recommend-ingredients`.
- `AccountManageView` was an orphaned sheet (`showManage` never set true). Follow-up: hub gear (`deskHubSettingsButton`) next to Connect/Back opens it. Path: top-left logo ("The Desk · Manage") → hub → gear → **Homework help**. Touched `DeskShellView.swift` (not in the original C file list) because that is the live Manage page; the Settings sheet had no entry point.
- Linux cloud agent cannot run `xcodebuild` or a real-device Groq-key check. CI is the compile gate; the DoD's "paste a problem with a real Groq key" needs Claude's device audit.

Did not start Assignments D–E.

---

## Brand pivot notice (2026-08-11)

MindCraft's positioning moved from "ACT-math tutoring" to "collaborative workspace / operating system for student work." `BRAND_BOOK.md` bumped to **v2.0** — read it before writing any new marketing or product copy. Math/Katha/"the click" is now the voice of the **Solver** vertical specifically, not the whole brand. New: `BUSINESS_MODEL.md`.

---

## Active Field Desk checkpoint (2026-08-09)

Native Desk OS + Desk Operator agent work landed today and is **pushed to main**.

| Surface | Tip |
|---|---|
| iOS prototype | `/Users/akoirala/Developer/mindcraft/ios-prototype` · tip `4c30ccf` · full note `DESK_SESSION_CHECKPOINT_2026-08-09.md` |
| Webhook / desk Ask | `webhook/api/desk-ask.ts` · tip includes `a8e0fd7e` |
| Agent growth ladder | `agent_work/product/DESK_AGENT_GROWTH.md` |

**Locked product shape:** Field Desk home · real Gmail (not AgentMail) · Calendar · Connect enablers · Ask → Desk Operator · live on-device record/tag · Apply today board · hub settings gear.

**Next:** enable Gmail/Calendar APIs on GCP if inbox 403 · harden coffee-shop record · grow agent tools (receipts → mail draft → Job OS → ask_tutor).

---

## Repo, branch, remote

- **One repo, one remote:** https://github.com/KoKa-Akshat/mindcraft.git
- **`app/`, `webhook/`, marketing, `ml/`: work on `main` directly.** No feature
  branches — commits land on `main` and CI deploys immediately.
- **`ios-prototype/` (Cursor agent work specifically): PR branches.** Cursor's
  autonomous iOS sessions push to a named branch (`cursor/<slug>`) and open a
  PR rather than committing straight to `main` — check `gh pr list` for open
  ones before assuming `main` has the latest iOS state. Merge only after CI
  (`iOS simulator build+test`) is green; `xcodebuild build-for-testing`
  locally catches the same compile errors CI does, faster.

### Two local checkouts (do not confuse them)

| Path | Status |
|------|--------|
| `/Users/akoirala/Developer/mindcraft` | **Live** — all real work happens here |
| `/Users/akoirala/Desktop/Business Ideas/mindcraft-site` | **Stale** — tens of commits behind; agents working here have shipped nothing until work was manually copied |

**Before editing anything:** run `pwd` and `git log --oneline -3`.  
If `pwd` shows `Desktop/Business Ideas`, **stop and switch** to `/Users/akoirala/Developer/mindcraft`.

---

## How deploys work

`git push origin main` triggers `.github/workflows/deploy.yml`, which builds `app/` and deploys three Firebase Hosting targets:

| Target | Live URL | Source |
|--------|----------|--------|
| `app` | https://mindcraft-93858.web.app | dashboard / student app (`app/dist`) |
| `world1` | https://mindcraft-world1.web.app | 3D world static site |
| `marketing` | https://joinmindcraft.com | root-level `index.html` / `blog.html` |

- **Never run `firebase deploy` locally.** It publishes whatever’s on disk and clobbers CI, overwriting other people’s in-flight work. Push to `main` and let CI do it.
- After every push, confirm the Actions run went green before calling anything shipped:
  - `gh run list --branch main --limit 1`
  - `gh run view <id>`
- Client app is a SPA — an already-open tab will **not** pick up a new deploy until a hard refresh (**Cmd+Shift+R**) or a fresh tab. “I don’t see my changes” is often a cache false alarm.

---

## Lane ownership (read before touching anything)

Two people’s work lives in this same tree, on **disjoint** trees:

| Lane | Owner | Tree |
|------|-------|------|
| **Engine** | Blake | `ml/**`, `webhook/**`, `data/**`, `worlds/**` |
| **Product** | Akshat | `app/**`, `index.html`, `blog.html`, root marketing files |

Coordinate before crossing a lane boundary. Shared seam files (also in `CLAUDE.md`): `app/src/lib/questionBank.ts`, `app/src/lib/mlApi.ts`, `CLAUDE.md`.

### Manjushree (third in-progress lane — co-founder WIP)

Real, in-progress feature. Treat as live WIP, **not** dead code:

| Area | Paths |
|------|--------|
| Zone | `app/src/manjushree/` |
| Post-cut slideshow | `app/src/pages/StorySlideshow.tsx` |
| Routes in `App.tsx` | `/manjushree`, `/manjushree-dev`, `/story-loop/:conceptId`, `/story-loop-dev/:conceptId` |
| Kitchen → zone handoff | `worlds/world2/sq-standalone.js` (+ css/html, cache `sq-lock-2`) — coordinate with Engine lane before changing world hosting broadly |
| Landing panel brief | `agent_work/manjushree-zone/LANDING_PANEL_HANDOFF.md` |

`App.tsx` has a permanent comment that this exact wiring has been **lost to concurrent overwrites multiple times**. If you edit `App.tsx`:

1. Read the **whole** file first  
2. Make only your specific change  
3. **Never** delete or “clean up” anything that looks like dead Manjushree code — it’s live WIP  

Prefer **scoped commits** (`git add` only relevant files). Never `git add -A` when Manjushree or another agent’s WIP is sitting uncommitted.

---

## How work has been happening (match this pattern)

1. Real bug reports come in as screenshots/descriptions from someone using the **live** product, not only spec docs.
2. Every change is independently verified before it’s called done:
   - `npx tsc --noEmit`
   - `npx vitest run` (baseline when last noted: ~120 passed / 1 skipped, 8 files — re-check current)
   - `npm run build`
   - Real before/after screenshot when UI-facing (a temporary `VITE_SCREENSHOT_MODE`-gated auth bypass in `App.tsx` is the established pattern — **always fully revert** afterward; confirm via `git diff`)
3. Never claim fixed/shipped without having **run** the check.
4. Commits are scoped precisely — only files for that fix.
5. `ACTIVE_TASK.md` gets a new **dated entry** after every real batch — check the top before starting anything new.

---

## Current focus (update this section as batches ship)

### Recently shipped and live

- Contents “roadmap” redesign on the dashboard (horizontal progress dots per subject lane)
- Live typed-expression graph box in Practice / chapter question views
- All 42 concept chapters given real photo art and expanded stories
- “Find a Tutor” page with Google Maps + tutor self-set location
- Marketing-page overhaul (hero, **Sword of Wisdom** demo panel with real product preview, tutor-recruitment section, honest “reviews coming soon” placeholder)

### Still open / in progress (as of handoff write-up — verify in `ACTIVE_TASK.md`)

- Caption-rendering bug in practice questions
- Graph-box shows-the-wrong-thing bug
- Story-pagination issues on a handful of concepts
- Shortening recently-expanded concept stories
- Dashboard hero-bar layout tweaks
- Tabbed apply-for-seat / apply-to-tutor form on the marketing page
- Manjushree sequence polish + landing-panel placement (see `agent_work/manjushree-zone/LANDING_PANEL_HANDOFF.md`)

---

## Complementary agents

Use this file so Product, Engine, and Manjushree agents stay aligned:

- Confirm checkout path first  
- Stay in your lane unless coordinating  
- Don’t clobber Manjushree routes in `App.tsx`  
- Don’t push from the stale Desktop checkout  
- Don’t local `firebase deploy`  
- Leave `ACTIVE_TASK.md` and this file honest after real batches  
