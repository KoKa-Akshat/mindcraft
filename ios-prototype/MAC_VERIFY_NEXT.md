# Mac verify pass — paste this into a LOCAL Cursor agent on the Mac

**Why this file exists:** the cloud agent wrote the 2026-08-10 desk changes and
syntax-parse-verified every touched Swift file (swiftc 6.0.3 `-parse`, all
clean), but a real build/run needs Xcode + the iPad — macOS only. This is the
one remaining step.

## Paste prompt (local Mac Cursor session)

```
cd /Users/akoirala/Developer/mindcraft && git pull origin main.

You are verifying the 2026-08-10 Field Desk changes on the real iPad
(id=00008103-0012296E01D0C01E). Read
ios-prototype/NATIVE_APP_BUILD_PLAN.md (2026-08-10 entries) and
ios-prototype/DESK_OS_NATIVE_BRIEF.md section 4 (no Monitor/background
waits, foreground xcodebuild only).

1. Build + install ios-prototype/MindCraftNotes to the device
   (scheme MindCraftNotes). If SPM hits safe.bareRepository, prefix
   env -u GIT_CONFIG_COUNT -u GIT_CONFIG_KEY_0 -u GIT_CONFIG_VALUE_0.
2. Fix any compile errors (cloud agent verified syntax only, not types).
   Commit fixes as scoped commits.
3. Walk + screenshot each:
   a. Jesse's landing: top-right = Volume, then Create (toast) + Sign out.
   b. Ask bar + tool dock reveal at the BOTTOM (swipe up bottom edge).
   c. Top chrome = Call + name only (no raccoon logo / Home / desk pill).
   d. Projects sign -> white polka bloom -> Malevolent Shrine screen ->
      tap shrine -> work area (desk.html).
   e. Work area top bar: Volume / Jesse's / Manage. Jesse's returns to
      kitchen. Manage opens the hub page (instances + tutors map +
      workflow market) with Back to desk.
   f. Work area: Binder center with clickable ACT map inside (opens ACT
      dash), Intel + Gmail + Gcal tiles, transcriber paused with play,
      + tray = Memo / Gdoc / Presentation / Intel, tiles drag anywhere.
   g. Work mode top-right: Jesse's + Manage pills next to Volume.
   h. Native + panel: Gdoc and Presentation place as movable cards.
4. Run the XCUITest suite foreground; known baseline failure
   testPracticeSessionChecksAnswerAndAttemptsToSaveOutcome is acceptable.
   Fix any NEW failures caused by the chrome changes (old tests may
   reference removed fieldDeskRaccoon / fieldDeskImmerse / fieldDeskLabel
   ids or the old top Ask position - update those assertions).
5. Append a verification note to NATIVE_APP_BUILD_PLAN.md, commit, push
   origin main.
```

## Raw commands (if driving Xcode by hand instead)

```bash
cd /Users/akoirala/Developer/mindcraft && git pull origin main
open ios-prototype/MindCraftNotes/MindCraftNotes.xcodeproj
# Cmd+R onto the iPad, then walk 3a-3h above.
```
