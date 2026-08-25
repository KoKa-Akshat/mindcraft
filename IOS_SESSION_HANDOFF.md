# iOS prototype — session handoff (2026-08-25)

**Read this first, then `CLAUDE.md` for the full project brief.**
Canonical checkout: `/Users/akoirala/Developer/mindcraft` (per `CLAUDE.md` — never the Desktop copy, it's stale).
App: `ios-prototype/MindCraftNotes/MindCraftNotes.xcodeproj`, scheme `MindCraftNotes`, bundle id `com.mindcraft.notes-prototype`.

Git is clean as of this handoff: everything below is committed and pushed at `22a24ced` on `main`. Pull before starting if any doubt.

## What shipped this session (phone dashboard focus)

All of this is on `main`, commits `386d52e8` and `22a24ced`:

- **Fixed a real Dynamic Island collision** in `DeskPhoneDashboardView.swift` — the title had `.padding(.top, 8)` standing in for the real safe area (~59pt), because this view sits inside `FieldDeskView`'s outer `.ignoresSafeArea()` canvas. Now reads the key window's real safe area.
- **Mascot-badge icon treatment** on every phone dashboard card, matching the grid dashboard's PencilWork/Kamana treatment from the same night.
- **Locked iPhone (not iPad) to landscape-only** — `LearnStudioView`/`CreateCanvasView`/`ResumeAgentView` are all built on a fixed 1440×810 canvas that has no honest portrait translation on a phone; landscape's aspect ratio is close enough to actually work.
- **Fixed a real centering bug in `LearnStudioView`** — `intakeBoard`/`studyBoard` were missing a `.frame(width: board.width, height: board.height)` that `CreateCanvasView` and `ResumeAgentView` both already had. Without it, `pin()`'s `.position()`-placed children report unbounded size upward, so the whole board silently expanded to fill the screen from the top-left corner instead of staying centered at its real scaled size.
- **Merged phone's Learn + Practice into Gurukul**, matching the grid dashboard's existing merge (phone was still pointing at the old pre-merge `LearnStudioView`/`EnglishPracticeView`).
- **Added Settings / Friends / Logout** to the phone dashboard's top-right (previously unreachable on phone at all).
- **Swapped stale "Answer" card for Design** (grid dashboard dropped Answer entirely back on 2026-08-23; phone still had a dead card pointing at it).
- **Added, then removed, a "Co-Work" card** — added it once, then cut it again same session since "Create" already covers the same ground (`CreateCanvasView`). Net: no Co-Work card on phone.
- **Built `ConstellationView.swift`** (new file) — phone's "Continue your work" card now opens the real `KnowledgeMapView` (the same knowledge-graph visualization the grid dashboard embeds, itself ported from the web's `ConstellationGpsExplorer.tsx`) instead of the old Binder file-list overlay. Has an Archive button bottom-left for sims access.
- **Gave `KnowledgeMapView` a `phoneFullScreen` mode** (new parameter, default `false`, iPad's two existing shapes — `embedded: true`/`false` — are untouched): bigger node touch targets (was ~19–30pt diameter, well under a real tap target), near-zero side padding instead of the old 20pt margins, and — the important one — tapping a node now opens the detail/route panel as a **right-side column** instead of a section below the canvas that shrank it every time you tapped something.
- **Added `ConceptImpactScore.swift`** (new file) — ported Dan McCreary's Concept Impact Score from his `learning-graphs` book (github.com/dmccreary/learning-graphs, ch. 28): a PageRank-style recursive importance measure computed exactly in one pass over the concept dependency DAG. Applied to mastery instead of content length: weights each mastered concept by its real graph importance instead of counting all concepts equally. Shows as "X% impact-weighted mastery" on **both** the grid dashboard's existing count and phone's Gurukul card + Constellation screen, sharing one `KnowledgeGraphClient` load on phone (owned by `FieldDeskView`, injected into both).
- **Fixed a real security/correctness bug**: `MoodleClient.form()` and `GmailClient`'s compose-draft URL encoder both used `.urlQueryAllowed`, which leaves `&`, `+`, `=`, `#` unescaped — all four are the encoded string's own field/key-value delimiters, so a Moodle password or an email subject/body containing any of them corrupted the request. Now alphanumeric-only encoding (Greptile flagged the Moodle instance; found the identical pattern in GmailClient while tracing it).

## What's genuinely pending / next

1. **Constellation was never re-verified live after the `phoneFullScreen` rewrite.** We built it, fixed a centering bug, then got pulled into a marketing-page tangent before confirming the redesigned right-side-panel layout actually looks right on the physical device. **This is the first thing to check.**
2. **Create, Design, and Leverage cards haven't been click-tested this session** — Answer→Design and the Co-Work saga touched their wiring but nobody's actually opened them since. The stated plan before the tangent was: "lock in on testing, then go to Leverage."
3. General device QA: tap through every phone dashboard card fresh, confirm the CIS-weighted mastery numbers look sane with real data, confirm landscape lock behaves correctly from cold launch (not just after manually rotating mid-session).

## Environment facts that will save you time

- **Physical device**: iPhone named "Akshat", UDID `00008150-00023C3C0CF1401C`, iOS 26.5.2. Also an iPad Air paired (`DD553C3C-D821-5869-BBA2-AB501D46210E`) but this session's work was phone-focused.
- **Build**: `xcodebuild build -project MindCraftNotes.xcodeproj -scheme MindCraftNotes -destination 'id=00008150-00023C3C0CF1401C' -allowProvisioningUpdates` from `ios-prototype/MindCraftNotes/`.
- **Install + launch**: `xcrun devicectl device install app --device <udid> <path-to-.app-in-DerivedData>` then `xcrun devicectl device process launch --device <udid> com.mindcraft.notes-prototype`.
- **Screenshots**: `pymobiledevice3 developer dvt screenshot <output.png>` — works without root via the userspace tunnel it falls back to automatically. If the phone is locked, you'll get a lock-screen image back, not the app — ask the user to unlock first.
- **Physical-device re-trust after reinstall**: no paid Apple Developer Program yet, ad-hoc signing. If launch fails with "invalid code signature... has not been explicitly trusted," the user has to manually go **Settings → General → VPN & Device Management → Developer App → Trust** on the device itself — nothing scriptable exists for this.
- **Xcode needs a signed-in Apple ID** in Xcode → Settings → Accounts for the UI test target's own provisioning profile to auto-generate (only came up once, for WebDriverAgent-style tap automation — see below).
- **Disk space is chronically tight** on this machine (was down to 127MB free at one point this session; currently fine but don't assume). `~/Library/Developer/Xcode/DerivedData` and `~/Library/Caches/org.swift.swiftpm` are the first things to check/clear if a build starts failing with SPM checkout errors.
- **Real device tap automation doesn't work here**: tried `pymobiledevice3 developer wda` — it needs the actual third-party WebDriverAgent project (a separate Xcode project with its own build/signing), not this app's own UI test bundle (which just runs assertions and exits, no HTTP server). Don't waste time on this path again; screenshot + ask the human to tap is the working loop.
- **Git push over SSH is blocked** in whatever sandbox this runs in (port 22 silently dropped). `origin`'s push URL is already set to HTTPS (`git remote set-url --push origin https://github.com/KoKa-Akshat/mindcraft.git`), using the already-authenticated `gh` credential helper. Plain `git push` works fine now — this was a one-time fix, already applied, don't redo it.

## Not part of this handoff

There's a **separate, unrelated marketing-page redesign** in flight (`index.html`, the real joinmindcraft.com homepage) via a background agent, still mid-review and intentionally **uncommitted** — don't touch, commit, or push `index.html` or `img/mkt/*` from a fresh iOS-focused session unless the user specifically brings it up.

## Instructions for starting the new chat

Just open a new Claude Code chat and say something like:

> Read `IOS_SESSION_HANDOFF.md` in `/Users/akoirala/Developer/mindcraft` and pick up from there. Let's verify Constellation on the phone, then move to testing Create/Design/Leverage.

That's it — this file plus `CLAUDE.md` should be enough for a cold start to be productive immediately, no need to re-paste any of tonight's conversation.
