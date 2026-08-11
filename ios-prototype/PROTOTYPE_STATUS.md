# MindCraft Notes: native iPad handwriting prototype status

This is a standalone technical prototype, not part of the web app (`app/**`).
It lives entirely under `ios-prototype/` and proves out a native PencilKit
based writing surface next to a real question, as the seed of an eventual
native MindCraft app. Nothing outside this directory was touched.

## Where it lives

```
ios-prototype/
  PROTOTYPE_STATUS.md          (this file)
  MindCraftNotes/
    MindCraftNotes.xcodeproj/
      project.pbxproj
      xcshareddata/xcschemes/MindCraftNotes.xcscheme
    MindCraftNotes/                        (app target)
      MindCraftNotesApp.swift              (SwiftUI app entry)
      ContentView.swift                    (question switcher, top level screen)
      Models/
        SampleQuestion.swift               (3 real ACT questions + model)
      Views/
        QuestionView.swift                 (question card + canvas layout)
        CanvasView.swift                   (PKCanvasView wrapper, palm rejection, tool picker)
      Persistence/
        PersistenceController.swift        (Core Data stack)
        DrawingStore.swift                 (debounced, background-context save/load)
        MindCraftNotes.xcdatamodeld/       (Core Data model: one entity, QuestionDrawing)
    MindCraftNotesUITests/                 (UI test target)
      MindCraftNotesUITests.swift
```

Xcode project name: `MindCraftNotes`. Target names: `MindCraftNotes` (app),
`MindCraftNotesUITests` (UI tests). Bundle id
`com.mindcraft.notes-prototype`. iPadOS only
(`TARGETED_DEVICE_FAMILY = 2`), deployment target iOS 17.0, built against the
iOS 26.5 SDK installed in this environment.

The `.xcodeproj` was authored by hand (no `xcodegen`/`tuist` available and no
network access to install one), so `project.pbxproj` is a plain text file
edited directly. It was validated at every step with `xcodebuild -list`,
`xcodebuild build`, and `xcodebuild test`, not just visual inspection.

## What was built, and why, against each requirement Akshat gave

### PencilKit (`PKCanvasView`) as the foundation, not custom Metal

`Views/CanvasView.swift` wraps a plain `PKCanvasView` in a SwiftUI
`UIViewRepresentable`. No custom rendering, no Metal layer, no hand rolled
stroke smoothing on top of what PencilKit already does. This was a deliberate
choice, not a default: PKCanvasView already is Apple's tuned, Metal backed
renderer, and there was no functional gap found during this pass that would
justify reaching past it.

### Real palm rejection

This is the part the prototype cares most about proving, so it got the most
verification effort (see the Verification section below).

`CanvasView` exposes a `PalmRejectionMode` enum mapped directly onto
`PKCanvasView.drawingPolicy`:

- `.pencilOnly` (the default): every finger and palm touch is ignored
  outright. Only an Apple Pencil mark ever becomes ink.
- `.anyInput`: a finger can draw too, using iPadOS's own pencil versus touch
  disambiguation, not a custom heuristic.

Both modes are exposed as a segmented control in `QuestionView` so a real
device test, or the automated UI tests described below, can compare the two.
No custom palm detection code (timing, contact size, etc.) was written
anywhere. The entire palm rejection guarantee rests on Apple's own
`drawingPolicy` API, which is exactly what was asked for.

### Off main thread processing

The PencilKit delegate callback (`canvasViewDrawingDidChange`) necessarily
fires on the main thread, that is a UIKit requirement and cannot be avoided.
What happens inside it is what matters: it only calls
`DrawingStore.scheduleSave`, which schedules work onto a Swift `Task`. The
actual expensive steps, encoding a `PKDrawing` to `Data` via
`dataRepresentation()` and writing it into Core Data, happen inside a Core
Data background context (`container.newBackgroundContext()` plus
`context.perform`), never on the main thread or the view context. Loading a
saved drawing back in (`DrawingStore.loadDrawing`) is the same story: fetch
happens on a background context, only the final `canvasView.drawing =` write
back happens on the main actor.

No custom spatial indexing or hit testing was added because this prototype's
canvas does not need any (see the tiling judgment call below); if a future
pass adds that kind of processing, it should follow the same background
context or `Task`/actor pattern already established here.

### Vector, not raster, stroke storage

`DrawingStore` stores exactly one thing per question: the `Data` returned by
`PKDrawing.dataRepresentation()`. No rasterization, no custom point/stroke
schema. That `Data` blob is decoded back with `PKDrawing(data:)` when a
question is reopened. The only custom code here is the Core Data wrapper
around that blob (see below), not a replacement for it, exactly matching the
guidance to wrap rather than reinvent PKDrawing's own format.

### Tile based rendering: judgment call, not built

This was explicitly called out as something to make a real judgment on
rather than build reflexively. The call made here: **no custom tiling was
built, and that is correct for this prototype's actual scope.**

Reasoning: the brief's own scope for this pass is "a single question's
writable margin/page", not a long scrolling notebook. The canvas in
`CanvasView` is a single fixed size `PKCanvasView` with zoom locked to 1x
(`minimumZoomScale = maximumZoomScale = 1`) and no scrolling content larger
than what fits on screen. PKCanvasView already renders a drawing at this
scale natively at full frame rate with no visible cost; there is no observed
or expected performance problem to solve with tiling here. If a future pass
adds a genuinely large, continuously scrolling notes surface (the "write
anywhere" full page concept referenced from the web app), that is the point
where custom tile based rendering (or at minimum, verifying whether
PKCanvasView's own handling of large drawings is still sufficient at that
scale) becomes a real question worth revisiting, not before.

### Incremental Core Data persistence

`Persistence/PersistenceController.swift` sets up a standard
`NSPersistentContainer` for a single entity, `QuestionDrawing`
(`questionId: String` unique, `drawingData: Binary Data`,
`updatedAt: Date`), defined in
`MindCraftNotes.xcdatamodeld/MindCraftNotes.xcdatamodel/contents`.

Core Data was chosen over hand rolled SQLite because the data here is
structured (one row per question, one blob, one timestamp) and
`NSPersistentContainer` already provides background context safety and
incremental saves without any extra plumbing. There was no concrete reason
found during this pass to prefer raw SQLite instead; the brief's own
suggested default was followed.

`Persistence/DrawingStore.swift` is the persistence policy layer on top of
that stack:

- **Incremental**: every `PKCanvasViewDelegate.canvasViewDrawingDidChange`
  callback schedules a save. A crash or force quit loses at most the last
  debounce window (0.4 seconds), not the whole session.
- **Debounced**: a fast flurry of pen strokes cancels and reschedules the
  pending save rather than writing to disk once per delegate callback.
- **Forced immediate save on the moments that must not lose work**:
  switching questions (`dismantleUIView` on the outgoing `CanvasView`) and
  clearing the canvas both call `saveNow`, bypassing the debounce.

## The three sample questions

`Models/SampleQuestion.swift` hardcodes three real ACT questions borrowed
read only from `app/src/data/actMasterQuestionBank.generated.json` (not
modified): `act_math_t01_q03` (linear equation), `act_math_t01_q02` (ratio
word problem), `act_math_t01_q06` (linear equation word problem). All three
were picked because they are pure text and symbols with no diagram, so this
prototype's writable canvas is genuinely the only place work happens for
them, matching the real product's write mode intent.

## Verification: what was actually checked, and how

The iOS Simulator runtime was NOT available when this task started
(`xcrun simctl list runtimes` returned empty). It finished downloading
partway through this session. Both situations are relevant to report
honestly, so here is exactly what was and was not verified, and by what
method.

### Build correctness (proven)

```
cd ios-prototype/MindCraftNotes
xcodebuild build -sdk iphonesimulator -project MindCraftNotes.xcodeproj -scheme MindCraftNotes
```

Result: **BUILD SUCCEEDED**, zero errors, zero warnings in this project's own
code (one pre-existing, unrelated `xcodebuild` destination-ambiguity notice
when no `-destination` is passed, and one Xcode `appintentsmetadataprocessor`
informational line about no AppIntents framework being present, expected
since this app defines none). Ran multiple times across the session as code
changed, including one full `xcodebuild clean` plus rebuild at the end.

### Live simulator verification (also proven, not just claimed)

The runtime finished downloading during this session
(`xcrun simctl list runtimes` later reported `iOS 26.5 (23F77)` available),
so this went further than a build only check. An `iPad Pro 11-inch (M5)`
simulator (already present from Xcode's default device list) was booted for
real and used two ways:

**1. Manual screenshots**, via `xcrun simctl io <device> screenshot`, after
installing and launching the built `.app` with `simctl install` /
`simctl launch`:

- A screenshot of question 1 on first launch, confirming the real question
  text, choices, concept chip, and empty canvas ("0 strokes") render
  correctly.
- A screenshot after driving a real drag gesture on the canvas in
  "Pencil + finger" mode, confirming actual visible ink renders on screen
  ("2 strokes", a drawn line visible in the writable area).

**2. An XCTest UI test target** (`MindCraftNotesUITests`), run for real via
`xcodebuild test -destination 'platform=iOS Simulator,name=iPad Pro
11-inch (M5)'`. This was the more rigorous route, and it exists specifically
because of a real limitation worth stating plainly: **the iOS Simulator has
no physical Apple Pencil**, so no touch injected from a Mac, whether a mouse
click on the Simulator window or an XCUITest coordinate tap, can ever be a
genuine pencil-type touch. That limitation is exactly what makes these tests
meaningful rather than circular: if `drawingPolicy` is really wired up
correctly, `.pencilOnly` mode must reject every single one of these
simulated touches, and `.anyInput` mode must accept them. Four tests, all
passing on a real booted simulator:

- `testQuestionOneRendersWithRealBankContent`: confirms the exact borrowed
  ACT question text is on screen (not a placeholder).
- `testPencilOnlyModeRejectsSimulatedTouch`: starts in the default
  Pencil only mode, drags across the canvas, asserts the stroke counter
  stays at "0 strokes". **This is the core palm rejection proof.**
- `testAnyInputModeAcceptsSimulatedTouch`: switches to Pencil + finger mode,
  drags across the canvas, asserts the stroke counter changes from
  "0 strokes". Proves the canvas is genuinely interactive and that
  `drawingPolicy` genuinely changes behavior, not just that it compiles.
- `testDrawingPersistsAcrossQuestionSwitch`: draws a stroke, switches to
  question 2, switches back to question 1, asserts the stroke count is
  restored. Because `CanvasView` uses `.id(question.id)` to force a full
  teardown and recreation of the underlying `PKCanvasView` on every question
  switch, this only passes if the drawing genuinely round tripped through
  Core Data, not through some in memory SwiftUI state that happened to
  survive.

All four: `Test Suite 'MindCraftNotesUITests' passed ... Executed 4 tests,
with 0 failures`.

A small, honestly motivated testability addition made this possible: a
"N strokes" label in `QuestionView`, wired to the live stroke count via a
callback from `CanvasView`'s coordinator. This is not pure test scaffolding,
it is a real, small piece of UX (visible confirmation that work is being
captured) that also happens to give the UI tests something accessible to
assert against, since canvas ink itself cannot be asserted against directly
through the accessibility tree. `PersistenceController.shared` also checks
for a `--ui-testing-in-memory` launch argument so every test run starts from
a guaranteed empty store; this has zero effect on normal app launches.

### What is still NOT verified, honestly

- **Real Apple Pencil behavior**: latency, pressure and tilt response,
  predictive smoothing quality, and genuine pencil versus palm
  disambiguation on physical touches all require real Apple Pencil hardware.
  Nothing in the Simulator can exercise this, by definition, since the
  Simulator has no Pencil. This needs a real iPad and a real Pencil, which
  was not available in this environment.
- **Subjective "does it feel smooth" judgment**: not assessable without
  physical hardware either, for the same reason.
- **Long term persistence across full app kill and relaunch (not just
  in-session question switching)**: the automated test proves a real Core
  Data round trip across a full teardown and recreation of the canvas view,
  which is strong evidence, but a full process kill and cold relaunch was
  not separately exercised in this pass. Given the round trip already goes
  through disk backed Core Data rather than memory, this is expected to work
  identically, but it was not itself directly observed.
- **Long term/heavy Core Data data volumes**: only three questions and a
  handful of strokes were exercised. No stress testing of large drawings or
  many stored questions was done.

## Known rough edges worth flagging

- The XCUITest target's `drawingPolicy` verification proves the
  configuration takes effect on synthetic touches; it is deliberately not a
  substitute for on-device testing, and `PROTOTYPE_STATUS.md` (this file)
  says so rather than leaving that implicit.
- `PKToolPicker()` is created fresh per canvas view attach rather than
  reused across question switches, since `CanvasView` recreates the whole
  `PKCanvasView` per question by design (see the persistence round trip
  test above). This is harmless for a three question prototype; a longer
  lived version of this app might want to reconsider recreating the whole
  view per question if that overhead ever becomes noticeable, though nothing
  observed in this pass suggested it was.
