# Responsive Layout Plan — iPad portrait + iPhone across the Work Dashboard surface

**Scope:** `DeskGridDashboardView.swift`, `FieldDeskView.swift`, `LearnStudioView.swift`, `CreateCanvasView.swift`, `DeskPhoneDashboardView.swift`, plus UI-test follow-ups. Goal: the app works deliberately (not accidentally) on iPad portrait and iPhone, without regressing the iPad-landscape layout the founder considers "great."

**Founder ask (verbatim):** "designed to be perfect for a horizontal view when i go vertical theres a lot of empty space underneath so the mobile phone view must be horror… if you have to abridge for mobile phone its fine… what we have currently is great for ipad and desktop but for iphone and ipad vertical view we really need to pay attention to details."

---

## 1. Current state (verified in code, line numbers as of 2026-08-23)

**A real phone layer already exists — this plan extends it, it does not invent it.** `Views/DeskPhoneDashboardView.swift` (143 lines, dated 2026-08-23 in its own doc comment) is a vertical card feed (Continue/Learn/Practice/Create/Answer/Leverage, ids `deskPhoneCard_*`), mounted at `FieldDeskView.swift:715` behind `openOverlays.contains(.deskGridDashboard) && UIDevice.current.userInterfaceIdiom == .phone` (zIndex 88, lines 715–754). Its doc comment already states the right philosophy: "Deliberately NOT a scaled-down DeskGridDashboardView… one thing owns the screen at a time." **The unsolved problems are (a) iPad portrait, which the phone branch does not cover, and (b) several destinations the phone feed routes into that are themselves still landscape-tuned.**

### 1.1 The 1440×810 artboard is baked into THREE screens, not one

Identical `scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)` pattern with `artboard = CGSize(width: 1440, height: 810)`:

| Screen | Artboard const | Scale math | Pin helper |
|---|---|---|---|
| `DeskGridDashboardView.swift` | :421 | :525–526 | `pin()` :842–849 |
| `LearnStudioView.swift` | :39 | :57–58 | `pin()` :705–710, rect tables `IntakeBoard` :718–720 / `LearnBoard` :729–746 |
| `CreateCanvasView.swift` | :43 | :78–79 | own `artboardContent(scale:)` :128 |

Measured consequences (iPad A16 = 820×1180pt portrait; iPhone 17 = 402×874pt):

- **iPad portrait:** scale = min(820/1440, 1180/810) = **0.569** → board 820×461, top-aligned → **~700pt (≈60%) of the screen is empty cream below the board.** This is the literal "empty space underneath."
- **iPhone portrait (Learn/Create, reached from the phone feed):** scale = min(402/1440, 874/810) = **0.279** → board 402×226; LearnStudio's 908×656 intake pane renders at **253×183pt**. Functionally unusable.

### 1.2 DeskGridDashboardView — what's already fixed vs. still landscape-shaped

- **The plain Binder landing already escapes the artboard** — `isPlainBinderLanding` at :578–582 renders `photoTile(.binder)` at full `geo.size` (the documented "full-geo.size sibling" escape hatch; `tileBoard` skips its binder pin via `skipBinder`). So the boot-time landing is NOT letterboxed. Its portrait problem is different: **wide-assuming internal proportions.**
- `binderLandingBodyContent` (:2250–2277): `HStack` = `binderWorkspaceColumn` at `.frame(width: geo.size.width * 0.76, ...)` (:2271) + `binderProgressGutter` (vertical 5-dot column, :2412) + `moduleBoxColumn` (:2445) with `.frame(maxWidth: .infinity, maxHeight: .infinity)` (:2276). On 820×1180 portrait: workspace 623pt wide, **module column squeezed to ~150pt**, and each of the 4 module boxes (min-height 84, internal `Spacer`) stretches to ~265pt of mostly-empty box. Wide-tuned, never reflowed.
- **Content-viewer state IS letterboxed:** `binderContentViewerActive` (:303) → `boxRect(.binder)` :3113 returns `WorkArtboard.contentViewerBinder` (:3755, x:130 w:1181 h:768) pinned at board scale → in portrait the open book/graph/upload viewer is **672×437 in the top corner of an 1180pt screen**. Same for the `expanded` memo/flows rails (:829–833, p5 rects :3737–3742).
- `bottomDock` (:3229–3262) is screen-global, bottom-pinned — already orientation-safe.
- Pan/zoom state `spacePan`/`spaceZoom` (:416–417) has no reset on rotation — a landscape pan can strand content off-screen in portrait (same family as the documented `cardOffsets` stranded-card bug in CLAUDE.md).
- `MoodleBoxSheet` hard `.frame(width: 420, height: 480)` (:4132).
- `UnifiedKnowledgeFieldCanvas` is `private struct` (:3874); `graphNormalizedPositions` is `fileprivate` (:3762) — both currently unusable outside this file.

### 1.3 FieldDeskView — the phone feed's destinations, audited one by one

| Feed card | Destination (FieldDeskView) | Phone verdict |
|---|---|---|
| Continue | `.binderOverlay` → `binderOverlayLayer` :3162, hard **`.frame(width: 420, height: 520)` :3222** | **Broken: 420pt card on a 402pt screen** — clipped both edges |
| Learn | `showLearnStudio` → fullScreenCover :1446 → LearnStudioView | **Broken: 0.279-scaled artboard** (§1.1) |
| Practice | `showEnglishPractice` :1450 → EnglishPracticeView (`maxWidth: 640/720` caps, :46/:52) | Fine — already adaptive |
| Create | `.createCanvas` → CreateCanvasView | **Broken: 0.279-scaled artboard** |
| Answer | `showJesseCallSheet` `.sheet` :1418 | Fine — sheet adapts |
| Leverage | `showResumeAgent` fullScreenCover :1373 → WKWebView (live desk-os page) | Likely fine; verify page's own responsive CSS (fix lives in `agent_work/product/desk_os/`, deploys via Firebase, **no iOS rebuild**) |

Also: `FieldDeskOverlay` enum with exhaustive `blocksChrome` (:227–253) — the overlay-boolean collapse CLAUDE.md called "deferred" has since landed; new overlays get a compile-forced chrome decision. The kitchen/free-drag desk (`defaultSizes` :263–279, `deskPoints` :282–299) is **unreachable from the phone feed** (no close/Done on it) — explicitly out of scope on phone.

### 1.4 Environment facts

- Project supports all 4 orientations on both idioms (`project.pbxproj` :1136–1137, `TARGETED_DEVICE_FAMILY = "1,2"` :1035).
- Simulators confirmed live right now: **MC-Phone-Test (iPhone-17, iOS 26.5, Booted)**, **MC-Fresh-Test** and **MC-Test-iPad3** (both iPad-A16, iOS 26.5, Booted).
- UI tests (2,722 lines): zero phone/`deskPhoneCard` coverage today; orientation is set **post-launch** (test comment at :1090–1091: pre-launch-only is flaky on iPad) — keep that pattern.

---

## 2. The branching mechanism — two switches, deliberately different

1. **Product-abridgement switch ("give them the phone feed"):** keep the existing idiom check at FieldDeskView:715 but extend it: `UIDevice.current.userInterfaceIdiom == .phone || horizontalSizeClass == .compact` (add `@Environment(\.horizontalSizeClass)` to FieldDeskView). Rationale: idiom alone misses iPad Split View 1/3-width (compact), where the 0.57-scaled board is equally hopeless. This is a *product* decision (fewer, stacked things), so a size-class — Apple's "is this window phone-shaped" API — is the right trigger.
2. **Layout-reflow switch ("same product, tall canvas"):** iPad portrait full-screen is **regular×regular in BOTH orientations — size classes cannot distinguish it.** Branch on real geometry at each screen's existing root `GeometryReader`: `let tall = geo.size.height > geo.size.width`. Not `UIDevice.orientation` (unreliable when the device is flat) and never a device-name check. This also does the right thing for any future Stage-Manager-ish window.

No global singleton; each screen computes `tall` from the `geo` it already owns.

---

## 3. The designs (opinionated, one answer each)

### 3.1 iPad-portrait Work Dashboard landing → stacked reflow

Branch inside `binderLandingBodyContent`'s own GeometryReader (:2251) on its local `geo`. New **separate private struct** `BinderLandingTallLayout` (struct boundary, NOT more nested `@ViewBuilder` branches — see Risks):

```
WIDE (today):  HStack [ workspace ×0.76 | vertical gutter dots | module column (stretched) ]
TALL (new):    VStack [ Knowledge-Map workspace, full width, ~62% height ]
                      [ horizontal progress dots row ]
                      [ 2×2 grid: Learn+Practice · Create · Design · Leverage, fixed ~110pt tall each ]
```

- `binderWorkspaceColumn` (:2320) is reused as-is — it's already a flexible VStack whose field fills whatever frame it gets; the PCA remap (`graphNormalizedPositions`) spreads nodes across any aspect.
- Module boxes reuse `learnModuleBox`/`moduleBox` (:2489/:2511) unchanged inside a 2-column `LazyVGrid` — **drop `maxHeight: .infinity`** so slack height goes to the map, which genuinely uses it, instead of stretching empty boxes.
- `binderProgressGutter` gets an axis parameter (or a 6-line horizontal twin).
- **All accessibility ids unchanged** (`deskGridModule_*`, `deskGridBinderGraphPreview`) — existing tests stay green, new portrait tests reuse them.

### 3.2 iPad-portrait content viewer + rails

- When `tall` and `binderContentViewerActive`: render the viewer as a full-`geo.size` sibling — **the exact escape-hatch precedent `isPlainBinderLanding` established at :578–582**, extended to one more state. Do not invent a portrait rect table.
- When `tall` and `rail == .memo`: memo opens as a full-width bottom panel (~300pt, above `bottomDock`) instead of the p5 side-rail; flows already live in the dock. (Slice 2 — secondary states.)
- `onChange(of: tall)`: reset `spacePan`/`spaceZoom` to zero (stranded-content prevention, mirrors the `closeDeskPanel`/`cardOffsets` fix).

### 3.3 iPhone destinations

- **`binderOverlayLayer` (FieldDeskView:3222):** replace the hard 420×520 frame with caps — `idealWidth 420 / maxWidth = min(420, available − 24)`, same for height. One-line-class fix; the internal `ScrollView` already handles less height. Same treatment for `MoodleBoxSheet` (DeskGrid :4132).
- **`LearnStudioView` compact variant** (serves iPhone all-orientations AND iPad portrait): branch at :57. New private struct `LearnStudioCompactLayout`: `ScrollView(VStack)` of the **same pane properties already called at :417–431** — intake = `intakeContent` full-width + a slim Jesse call strip; study = `definitionPane → contextPane → workedExamplePane → microsimPane → practiceProbePane` stacked, `studyDock` as a bottom-pinned 64pt bar. Approved abridgement fallback: if the embedded microsim WKWebView is unusable under ~360pt, render it as an "Open simulation" launcher row → fullScreenCover instead.
- **`CreateCanvasView` compact variant:** slide/doc scaled to full width (`.aspectRatio(16/9, contentMode: .fit)` for slides), storyboard/controls stacked beneath in a scroll, Ask-AI dock bottom-pinned, Jesse call as a floating bottom-trailing button. Mic stays **tap-to-toggle** (CLAUDE.md: hold-to-talk anywhere is a regression).
- **`ResumeAgentView`:** verification-only — load the live resume page at 402pt width; any fix is desk-os CSS in `agent_work/product/desk_os/workflows/resume/` (Product lane, Firebase deploy, no iOS rebuild — but remember the hardcoded `?v=rN` cache-bust param needs a Swift bump only if the page itself changes).

### 3.4 Knowledge Map on phone — the new ambient field, abridged deliberately

The phone feed currently has **no map at all**; the founder's brand-new unified field shouldn't be iPad-only. Design call: **the 42 dots fit a phone card fine — the labels don't.**

- Promote `UnifiedKnowledgeFieldCanvas` + `graphNormalizedPositions` (DeskGrid :3874/:3762, currently private/fileprivate) into a new `Views/UnifiedKnowledgeFieldCanvas.swift` (internal), adding a `maxBookLabels: Int?` parameter (nil = today's behavior).
- `DeskPhoneDashboardView` gains a ~210pt-tall map card at the top of the feed: own `@StateObject KnowledgeGraphClient` + `BookLibraryClient.listBooks()` `.task` (mirror the dashboard's eager-load pattern at :577 and the `libraryBooksLoaded` guard at :2290). Dots at existing 3.5–7pt radius read as ambient status texture at 366×210; **label only the top 2 recommended books** (by `coveredConcepts/totalConcepts`); book dots stay tappable → same `openChapterBookFromBinder` path via a new closure on the phone view's init. Tapping the field background → fullScreenCover `KnowledgeMapView` (GeometryReader-rooted at its :303 — already flexible).

---

## 4. Build order

| Slice | What | Why first |
|---|---|---|
| **1 (min. fix for the exact complaint)** | 3.1 tall landing reflow + pan/zoom reset; 3.3 binderOverlay width cap | iPad-portrait boot screen is THE reported horror; the overlay cap un-breaks the phone feed's #1 card. Two files. |
| **2** | 3.3 LearnStudio compact (fixes iPhone Learn AND iPad-portrait Learn); 3.2 content-viewer tall escape | Biggest remaining unusable surface on both form factors |
| **3** | 3.3 CreateCanvas compact; 3.2 memo-rail tall panel; MoodleBoxSheet cap | Same pattern, lower traffic |
| **4** | 3.4 phone Knowledge Map card + canvas promotion; ResumeAgent web-width verification | New value, not a fix; safe last |

Each slice is its own commit + suite run; do not batch.

## 5. Risks (all grounded in this codebase's documented history)

- **Opaque-return-type stack-overflow crash class** (`binderLandingBody`'s `AnyView` comment at :2230–2236; KNOWLEDGE_MAP_MERGE_PLAN §8): every new layout variant is a **separate private struct** with its own `body` boundary; if a branch must live at an existing deep call site, `AnyView`-erase there. **Never** add branches inside `tileBody`'s if/else chain — the file's own comments name it the highest-risk area.
- **Identifier clobbering (3 documented variants):** new structs self-identify via the invisible marker-`Text` pattern; no `.accessibilityIdentifier` at call sites of self-identifying children.
- **Keyboard-shrink regression:** the root `.ignoresSafeArea(.keyboard, edges: .bottom)` at :719 (2026-08-22 fix) must survive any `body` restructuring; likewise the "no Color + GeometryReader as ZStack siblings / no `.position()` on the board" rule (:504–512).
- **Split View product change:** extending the feed to compact-width iPad alters what Split View users see — flag to founder; recommended default is yes (feed beats a 0.27–0.57-scaled board).
- **Rotation mid-session:** tall↔wide flips re-evaluate the branch; `@State` survives (same view identity) but geometry-tuned values (`spacePan`/`spaceZoom`) must reset (3.2).

## 6. Test / verification plan

- **Regression gate (must-not-break):** run the existing suite unchanged on **MC-Test-iPad3** (landscape). Existing tests already force `.landscapeLeft` per-test, so they self-protect.
- **New tests** (post-launch orientation only, per the :1090 lesson; `XCTSkipUnless(UIDevice.current.userInterfaceIdiom == …)` so one suite runs on both destinations):
  - iPad: launch skip-auth → `.portrait` → assert `deskGridModule_Learn/Create/Design/Leverage` exist **and `isHittable`** + `deskGridBinderGraphPreview` exists → rotate `.landscapeLeft` → re-assert (round-trip guard).
  - iPhone (MC-Phone-Test): all `deskPhoneCard_*` hittable; Continue → `fieldDeskBinderOverlay` marker + **`fieldDeskBinderDone` isHittable** (catches the 420pt overflow concretely); Learn/Create → new compact-layout markers.
- **Known gotchas to honor:** one shared app install per suite run → `xcrun simctl uninstall <udid> com.mindcraft.notes.prototype.akshat` before full runs; AX-resolution degradation → `simctl shutdown`/`boot` before believing a failure; `isHittable: false` = suspect overlay-blocking first, not timing; add any new full-screen surface's flag to the `blocksChrome` switch (now compile-forced).
- **Founder eyeball pass:** capture the 4-cell matrix (iPad land/port × iPhone land/port) via `XCTAttachment(screenshot:)` + `xcrun xcresulttool export attachments` — documented as more reliable here than racing `simctl io screenshot`.

---

### Critical Files for Implementation
- /Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotes/Views/DeskGridDashboardView.swift
- /Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotes/Views/FieldDeskView.swift
- /Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotes/Views/LearnStudioView.swift
- /Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotes/Views/CreateCanvasView.swift
- /Users/akoirala/Developer/mindcraft/ios-prototype/MindCraftNotes/MindCraftNotesUITests/MindCraftNotesUITests.swift
