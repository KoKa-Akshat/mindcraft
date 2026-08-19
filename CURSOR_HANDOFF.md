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

---

#### Assignment F — Book: one native Jesse call instead of two, then real tools/boxes + tutor forward

**Goal.** `BookWorkflowView` currently shows TWO independent, simultaneously-
live "talk to Jesse" experiences: the web page on the left
(`agent_work/product/desk_os/workflows/book/agent.js` — browser
`SpeechRecognition`, hold-to-talk, its own `speechSynthesis` voice, POSTs to
`https://mindcraft-webhook.vercel.app/api/book-agent` and actually drives the
book draft) and the native `JesseRailView`/`JesseCallSession` call added on
the right 2026-08-17, which today is decorative — it doesn't feed the
book-writing loop at all. Akshat's explicit ask: "why are there two calls in
Book… bring that functionality to the right." Port the real mechanism onto
the native call so there is exactly one Jesse, then redesign the left side
into structured tools/boxes ending in a tutor-review/forward step (the left
side's current visual *design* — draft/chapters card, publish button — was
called out as good; it's the dual-call and the missing tutor step that need
fixing, not a from-scratch redesign of what's already there).

**The backend is already fully portable — read this before assuming a big
webhook change is needed.** `POST https://mindcraft-webhook.vercel.app/api/book-agent`
is a plain stateless HTTP endpoint, not tied to the browser at all:
- Request: `{ "message": string, "draft": { "topic": string, "title": string, "chapters": [{ "title": string, "body": string }] } }`
- Response: `{ "reply": string, "draft": { same shape }, "readyToPublish": bool }`
`agent_work/product/desk_os/workflows/book/agent.js`'s `ask()` function (top
of the file) is the exact reference implementation of the request/response
cycle — read it, don't guess the contract. Publishing is *also* already
fully native: `BinderStore.addBook(title:body:)` writes straight to
Firestore, and `BookWorkflowWebView.Coord.userContentController` in
`BookWorkflowView.swift` already bridges the web page's `publish` message
into that exact call — a fully-native Book wouldn't need a WKWebView at all.

**The real work, and a genuine gotcha in shared code:** `JesseCallSession.
askJesse(_:)` (`Networking/JesseCallSession.swift:314`) is the ONE place
every native call across the whole app routes a heard utterance to a
backend — and today it does **not** branch on `context` at all. Every
screen's call (Resume, Presentation, Learn Studio, Archive, and Book once
wired) currently ends up at the same generic `ArchiveRagClient.ask(...)`,
regardless of which screen opened it — `context` is stored on turns and used
for UI labeling only. Making Book's native call actually write chapters
means adding a real `if context == "book"` branch inside `askJesse()` that
calls a new `BookAgentClient.ask(message:draft:)` (mirror `agent.js`'s `ask()`
exactly — same URL, same request/response shape) instead of
`ArchiveRagClient`, and speaks back `reply` the same way the existing path
already does. Store the running `draft` as a new `@Published private(set)
var bookDraft: BookAgentDraft?` on `JesseCallSession` (reset it in `begin()`
when `context == "book"`, same place `turns` persistence already lives) so
`BookWorkflowView` can observe it via `.onChange`/environment and render the
chapters live. **This touches a shared, central class every screen depends
on — after adding the branch, confirm Resume/Presentation/Learn Studio/
Archive calls still hit `ArchiveRagClient` exactly as before.** Don't
refactor `askJesse()` more broadly than this one added branch.

**Tutor forward — real client already exists, one real gap in it.**
`Networking/TutorDirectoryClient.swift`'s `Tutor` struct (`displayName`,
`bio`, `subjects`, `calendlyUrl`, …) and `TutorDirectoryClient.load()` are
real and already used by `FindTutorView.swift` — reuse this directly rather
than building a second tutor list. **Gap to fix as part of this
assignment:** `Tutor` has no `email` field, even though `load()` already
parses an `email`/`calendlyEmail` value locally per Firestore doc
(`TutorDirectoryClient.swift` around line 85) just to build `calendlyUrl` —
it's discarded instead of kept. Add `let email: String` to `Tutor` and
persist that parsed value, then "send to tutor" can compose a real email via
the student's own `GmailClient` (already does real sends, see
`GmailClient.swift`) with the book draft in the body — no fabricated backend
needed. If a tutor has no usable email, fall back to their `calendlyUrl`
(book a call instead of emailing a draft) rather than silently failing.

**Files in scope:** `ios-prototype/MindCraftNotes/MindCraftNotes/Views/
BookWorkflowView.swift` (replace the WKWebView-based left side with a native
draft/tools view; publish flow — `BinderStore.addBook` — stays as-is),
new `ios-prototype/MindCraftNotes/MindCraftNotes/Networking/
BookAgentClient.swift`, `Networking/JesseCallSession.swift` (the one added
branch described above — high blast radius, be surgical),
`Networking/TutorDirectoryClient.swift` (add `email`), `Views/JesseRailView.
swift` (read-only reference for how it renders `jesseCall.turns` — Book's
new left side should show the SAME transcript-driven feel, not invent a
different one).

**Constraints:** do not touch `agent_work/product/desk_os/workflows/book/**`
or the web deploy pipeline — this assignment retires the web page as Book's
UI, it doesn't need to keep working. Do not change `JesseRailView.swift`
itself (every other screen depends on it staying exactly as it is) — Book
keeps using it unmodified on the right, same as today. Do not build a new
tutor-messaging backend; the student's own already-authorized `GmailClient`
send is the real, available channel.

**Definition of done:** open Book, talk to Jesse via the one native call on
the right, watch chapters actually appear on the left as you talk (real
`/api/book-agent` round trips, not a stub). Publish still files to Binder.
The left side shows real "what we need from you" tools/boxes state (not
just a blank draft waiting for a call) and, once a draft has at least one
chapter, a "Send to a tutor for review" step that lists real tutors from
`TutorDirectoryClient` and sends via `GmailClient`. `xcodebuild build`
green, confirmed on a real device (a real Groq/Anthropic key isn't needed
here — `/api/book-agent` is the shared webhook endpoint, not BYOK).

---

#### Assignment G — Learn Studio: cards generate live as the student talks, not from a one-shot form

**Goal.** Learn Studio today (`LearnStudioView.swift`) is a strict two-phase
flow: a static intake form (topic text field + level picker) submits ONE
`StudentAIKeyStore.generateStudyPlan(topic:level:knownConceptIds:)` call,
and whatever comes back permanently fixes the cards for that session — the
Jesse rail on the intake screen is present but decorative, same issue as
Book had before Assignment F. Akshat's ask: "it should be cards as I talk to
Jesse" — the cards should generate and refine live as a real conversation
happens, not from one static form submit.

**This is the same architectural gap Assignment F fixes, applied to a
different context value.** Read Assignment F's note on `JesseCallSession.
askJesse(_:)` first — `context == "learnStudio"` has the identical problem
(falls through to generic `ArchiveRagClient`, ignores the real study-plan
machinery entirely). Unlike Book, Learn Studio's actual generation call
(`StudentAIKeyStore.generateStudyPlan`) already exists and is BYOK-native
(no new webhook needed) — the missing piece is wiring it to fire per
conversation turn instead of once from the intake form.

**Recommended shape (not mandatory — flag back if you find a better one):**
add an `if context == "learnStudio"` branch in `askJesse()` that, instead of
calling `ArchiveRagClient`, re-runs `StudentAIKeyStore.generateStudyPlan`
with the accumulated conversation so far (simplest: concatenate all
`jesseCall.turns` text as the "topic" context each time, regenerating the
whole plan fresh per turn — this is the cheap, already-proven-correct
option; a true incremental diff/patch of just the changed card is a nice-to-
have, not the bar for done) and publish the result the same way `bookDraft`
does in Assignment F. `LearnStudioView`'s existing `studyBoard`/`pane`/
`definitionPane`/etc. rendering barely needs to change — it already renders
from `plan: StudyPlan?`; what changes is `plan` updating live from
conversation turns instead of once from `createPlan()`'s form submit.
**Keep the honesty rule intact**: if a turn doesn't produce a usable plan
(model failure, thin topic), don't silently keep stale cards without
indicating anything — surface the same kind of honest `planError` the form
path already has. Practice Probe's rule also stays exactly as-is: never let
this path invent practice questions — it still only ever matches a real
`matchedConceptId` from `SampleQuestion.all` via `StudyPlan.matchedConceptId`,
same as today.

**Files in scope:** `ios-prototype/MindCraftNotes/MindCraftNotes/Views/
LearnStudioView.swift`, `Networking/JesseCallSession.swift` (the added
branch — coordinate with whoever does Assignment F if both are in flight at
once, since both touch `askJesse()`), `Networking/StudentAIKeyStore.swift`
(reference `generateStudyPlan`/`StudyPlan.parse` — reuse, don't fork a
second copy of the parsing logic).

**Constraints:** don't remove the intake screen entirely — a student who
prefers to type a topic and level and tap "Create my plan" without talking
should still be able to (that path stays working exactly as today); this
assignment ADDS the conversational path on top, via the same Jesse rail
that's already sitting there. Don't touch `JesseRailView.swift` itself, same
rule as Assignment F.

**Definition of done:** on Learn Studio's intake screen, tap "Jump on a call
with Jesse" and describe a topic out loud instead of typing it — cards
appear/update on the studying screen as the conversation progresses, backed
by real `generateStudyPlan` calls (not fabricated). The existing type-it-in
form path still works unmodified. `xcodebuild build` green, confirmed on a
real device with a real saved AI key (this path is BYOK, same as the
existing form path — no key means the same "connect your AI key" messaging
as today, not a silent no-op).

---

#### Assignment H — Resume: one native Jesse loop, same shape as Book (Assignment F)

**Goal.** Same gap Assignment F fixed for Book, now for Resume:
`JesseCallSession.askJesse()` has no `context == "resume"` branch, so
talking to Jesse on Resume's native rail falls through to the generic
`ArchiveRagClient` — search-RAG replies to a resume-building conversation,
which doesn't make sense functionally. Meanwhile `ResumeAgentView`'s left
side still loads the old `WKWebView` (`agent_work/product/desk_os/
workflows/resume/`), which has its own real, working resume-drafting loop
— LinkedIn/Drive/PDF extraction, a `state`/`renderResume()` draft — but it's
JS-side, invisible to the native call. Akshat's ask tonight: "make sure the
conversational feature is wired and built into all Jesse/scoped and
specific functionality" — Resume is the next, most valuable gap, and the
backend already exists (same shape as Book's discovery in Assignment F).

**The backend is already real and portable — confirmed by reading
`webhook/lib/handlers/resume-agent.ts` directly, not assumed.**
`POST https://mindcraft-webhook.vercel.app/api/resume-agent`:
- Request: `{ message: string, draft: Partial<ResumeDraft>, sources?: { linkedinUrl?, linkedinText?, driveFiles?: {name,text}[], resumeText?, resumeFileName? } }`
- `ResumeDraft`: `{ name, headline, school, email, location, skills: string[], roles: { title, org, when, bullets: string[] }[], education: string[], projects: string[], files: string[], linkedinUrl, drive: bool }`
- Response: `{ reply, draft: ResumeDraft, readyToApply: bool, suggestedRoles: { company, role, why, query }[], actions: { type: string }[] }`
`agent_work/product/desk_os/workflows/resume/agent.js`'s `askJesse()` is
the reference request/response cycle, same relationship `BookAgentClient`
has to `agent.js`'s `ask()` in the Book workflow.

**Same shared-code mechanics as Assignment F, same care needed:**
add a `ResumeAgentClient.swift` (mirror `BookAgentClient.swift`'s shape
exactly — `Reply`/`ResponseWire`/`ask(message:draft:)`), a new
`if context == "resume"` branch in `askJesse()` (checked alongside the
existing `book`/`learnStudio` branches, before the `DeskBoxBus` briefing —
same reasoning: that briefing is Work-dashboard-specific), and a published
`resumeDraft: ResumeAgentDraft?` on `JesseCallSession`, reset in `begin()`
same as `bookDraft`. Verify the other branches (`book`, `learnStudio`, and
the generic fallback for `create`/`archive`/`designStudio`) are unaffected
after adding this one.

**The one real open design question, not a files-in-scope item — decide
this before writing code:** does Resume go **fully native** (retire the
WKWebView entirely, same as Book did) or does the native call become a
**second entry point into the same web-driven draft**? Full-native is the
cleaner long-term shape (one draft, one place it lives) but means porting
LinkedIn/Drive/PDF-upload — not fabricating them, they're real and already
native-reachable (`DriveClient.shared.connectAndReadFolder()` is the exact
same call the web bridge already makes; `sources.driveFiles`/
`resumeText` would come from there instead of JS). Given the size of that
port, it's fine to ship a first pass where the native call drives
`resumeDraft` with `sources` mostly empty (voice-only conversation, no
LinkedIn/Drive/upload yet) and the WKWebView stays for those — but if that's
the choice, the left panel needs to show ONE draft, not two divergent ones,
which likely means rendering `jesseCall.resumeDraft` when it has content
and falling back to the web view's own view otherwise, or another shape
entirely. Flag the decision made and why in the report, don't silently pick
one.

**Files in scope:** new `ios-prototype/MindCraftNotes/MindCraftNotes/
Networking/ResumeAgentClient.swift`, `Networking/JesseCallSession.swift`
(the one added branch), `Views/ResumeAgentView.swift` (left-panel rendering
— now on the shared GDoc artboard shape as of tonight's layout pass, keep
that intact). Do not touch `agent_work/product/desk_os/workflows/resume/**`
unless the "fully native" path is chosen and confirmed — if so, note it
explicitly, since retiring that page changes what needs a web deploy vs. an
iOS build. Don't touch `JesseRailView.swift`.

**Definition of done:** talk to Jesse on Resume's native rail, get replies
that are actually about building a resume (name/skills/roles), not generic
archive search. `xcodebuild build` green, confirmed on a real device.

---

#### Assignment I — Presentation: native call is still decorative (harder, not scoped yet)

Same underlying gap (`context == "create"` has no branch, falls through to
`ArchiveRagClient`), but a different shape of problem than Book/Learn/
Resume: those three drive a single draft **blob** (chapters, a study plan,
a resume) that a backend can return whole each turn. Presentation would
need to edit **live, already-existing structured state** — `slides: [
CreateSlide]`, `slideIndex` — via voice ("add a slide about X," "make slide
2 shorter"), which likely needs either a different response shape (an
edit/patch instruction, not a whole-draft replace) or a new webhook
entirely. Not scoped into a files-in-scope/definition-of-done spec yet —
whoever picks this up should start by deciding that response shape, not by
copying Assignment F/H's pattern verbatim, since the "replace the whole
draft every turn" trick those use doesn't fit editing a slide deck a
student is actively looking at without visibly flickering/reordering it.

**Archive is very likely already correct, not a gap** — `context ==
"archive"` falling through to `ArchiveRagClient` isn't a fallback masking a
missing feature the way Resume/Book/Presentation's gaps are; `ArchiveRagClient`
IS the archive-search backend by name and by what it does. Worth a quick
confirmation read of `ArchiveWorkflowView.swift`'s own context string before
assuming, but don't build new scoped Archive wiring on the assumption it's
missing without checking first.

---

#### Assignment J — Work Dashboard becomes the real "Learn" surface: conversational content generation, routed into tiles

**Goal.** The single largest ask of the whole 2026-08-17/18 session (verbatim,
lightly cleaned up): tapping "Learn" should not open a separate screen — the
Work Dashboard itself becomes the learning surface. Jesse greets by voice on
arrival ("Hey, welcome back. What would you like to learn today"), the
student answers by typing in the search bar or by talking, the system checks
whether real matched material already exists (the base 42-concept ontology's
`SampleQuestion.all` bank, or one of the bundled book concept graphs — see
Assignment(s) above and `BookGraphLoader.swift`) or needs new material
uploaded, generates content via the student's own AI key (same
`StudentAIKeyStore` pattern every other screen tonight already uses), and
routes different pieces of what comes back into different tiles — Binder
gets the filed artifact, Homework Help shows the question/definition, Moodle
shows a chapter breakdown, and the tile that used to be Intel (now a
`JesseRailView` box — see the dashboard-restructure commit right before this
one) shows the conversation/summary. Tiles with nothing to show collapse;
neighbors grow to fill the space. A "Save & Exit" button appends the session
to Binder and resets the dashboard. In a later call, if the student
references this same work, Jesse should be able to reopen this exact saved
dashboard state.

**What shipped the same night, already in place for this to build on:**
- The dashboard tile in Intel's old slot is now a real `JesseRailView`
  (`DeskGridDashboardView.swift`'s `tileBody`, `kind == .intel` branch) —
  the box this assignment's generated content needs to route around/through
  already exists, it just doesn't drive generation yet.
- `BookGraphLoader.swift` + `Resources/BookGraphs/*.json` — real, bundled,
  validated book concept graphs (Euclid's Elements, Wealth of Nations,
  Origin of Species, Meditations, Art of War), already proven working in
  Learn Studio's "Study a Book" flow (`LearnStudioView.swift`).
- `StudentAIKeyStore.generateStudyPlan(topic:level:knownConceptIds:)` — the
  real, working, BYOK generation call every "check if we can make a lesson"
  step in this assignment should reuse rather than fork a second copy.
- Homework Help's real upload path (`FieldDeskView.swift`,
  `handleHomeworkFileUpload`) — photo-or-PDF, already extracts real text via
  `HomeworkClient`/PDFKit. This is the literal mechanism for "ask for upload
  material" — reuse it, don't rebuild it.
- `BinderStore.addDoc`/`addBook` — the real filing calls "Save & Exit" and
  "this gets appended to your binder" should use.

**Be honest about what does NOT exist yet — do not fake these, flag them
instead if the spec seems to need them:**
1. **No live web search anywhere in this codebase.** "Looks up YouTube
   videos and other resources in Google Scholar" is not buildable as
   described without a real, deliberate integration decision: YouTube has an
   official Data API (quota-limited, needs a key); Google Scholar has **no
   official API at all** — scraping it violates their Terms of Service. If
   this is still wanted, that's a product/legal call for Akshat to make
   explicitly (which service, what budget, accept ToS risk or not) before
   any code gets written — do not silently stub in fake search results that
   look real.
2. **No personalized "language preference / English level / learning style"
   knowledge graph exists anywhere** — not in the iOS app, not in `ml/`. The
   ask references this as if it's already there ("this graph is more
   detailed and more personal also it gets its feedback"). It isn't. Building
   it means a new data model (where does this live — Firestore? the mastery
   engine's `StudentState`?), a way to actually collect these signals from a
   student, and UI to show/use them. Scope this as its own piece, not a
   sub-task assumed to already exist.
3. **No image generation integration** — "generate images if needed" needs a
   real image-gen API decision (cost, which provider), same category of
   decision as (1).
4. **The tick/cross content-rating idea is real and separate** — Akshat
   floated it earlier the same session and said "later" explicitly before
   asking for this dashboard rewrite. Treat it as still later unless told
   otherwise; don't fold it into this assignment's definition of done.

**Visual/simulation generation — a real design, not a decision yet (Akshat
explicitly asked for this to be thought through, not built, this session).**
The question: when a lesson needs a diagram/graph/simulation, not just text,
how does that actually get made? Three real options exist, in increasing
order of power and risk — this is a genuine tradeoff, not a "just do the
best one":

1. **Constrained declarative spec, deterministic renderer (recommended
   starting point).** The LLM never writes code — it fills in a fixed,
   narrow JSON schema (`{"type": "line_chart", "points": [...], "labels":
   [...]}`, `{"type": "number_line", "marks": [...]}`, etc. — a small,
   closed set of chart/diagram kinds, not an open one), and a deterministic
   renderer turns that into a real visual. Two renderer choices: (a)
   **native, on-device** — SwiftUI `Charts`/`Canvas` render the spec
   directly in the app, zero network round trip, zero server compute, zero
   arbitrary-code-execution risk, but limited to whatever chart types get
   built; (b) **server-side** — a small, fixed matplotlib/plotly script
   (not LLM-written, just parameterized by the LLM's JSON) renders an
   image, same safety property (the LLM supplies data, never code) but
   with a richer visual vocabulary than SwiftUI Charts has today. This is
   the same shape of guardrail this whole session has used everywhere else
   (Practice Probe's real-bank-only rule, the `ADVISOR_AUTHORIZED_CREATORS`
   licensing gate in `mindcraft-content-engine`) — never let the LLM's
   output be more powerful than it needs to be to do the real job.

2. **Manim, LLM-written Python, server-rendered (the ask's literal
   suggestion — real, but real risk too).** Manim (3Blue1Brown's animation
   library) produces genuinely excellent math visualizations, and "write
   Manim code to explain X" is a real, well-precedented LLM task. But this
   means executing LLM-generated Python on a server on every request — a
   real arbitrary-code-execution surface, not a hypothetical one. Doing
   this safely needs, at minimum: a sandboxed, network-isolated execution
   environment (a locked-down container, not the same process handling
   student data), a hard time/memory/output-size budget (a render that
   hangs or runs away must not become a denial-of-service or a stuck
   request), and validation that the generated script only imports Manim
   (no `os`, `subprocess`, `socket`, etc. — a real allowlist, not a
   best-effort filter). Manim renders are also not instant — seconds to
   low minutes depending on complexity — so this needs an async job
   pattern (kick off a render, poll or push a result), not a synchronous
   request the student's UI blocks on. This is a real, buildable thing,
   but it's a security-and-infrastructure project on its own, not a small
   add to Assignment J's scope.

3. **Real-life example, text only (the honest fallback, always available).**
   When neither of the above fits — or before either is built — the
   existing `StudentAIKeyStore.generateStudyPlan`-style `context` field
   already does this: a warm, concrete, second-person analogy instead of a
   diagram. Not a consolation prize; genuinely the right choice for a lot
   of content (an abstract legal/philosophical concept from the book
   graphs, for instance, may serve a student better as a real-life example
   than a forced chart).

**Recommended sequencing, if/when this gets built:** ship (1)'s native
on-device renderer first — it's the lowest-risk, fastest to verify, and
covers a meaningful chunk of "show it visually" (graphs, number lines,
simple geometric figures) with zero new backend surface. Only reach for (2)
once (1)'s limits are actually felt in practice, and treat it as its own
scoped security review, not a quick follow-on. (3) is not a fallback to
build — it already exists, just make sure the "no visual available" path
routes to it honestly instead of silently showing nothing.

**What IS honestly buildable, reusing what's real:**
- Voice greeting: `JesseCallSession` has no "speak a scripted line without a
  full listen/reply loop" entry point today — `speak(_:)` is private, called
  only from within `askJesse*` methods after a real round trip. Adding a
  narrow, explicit "greet" path (context-gated, e.g. `context ==
  "workDashboard"`) that speaks a fixed line on `begin()` before any
  listening starts is a small, contained addition — don't generalize
  `speak()`'s access beyond what this needs.
- "Checks if we can create a lesson from the repo": a real, honest check —
  does the spoken/typed topic match a `SampleQuestion.all` concept id
  (reuse `StudentAIKeyStore.generateStudyPlan`'s existing `matchedConceptId`
  mechanism) or a `BookConceptRecord.label` (fuzzy match against
  `BookGraphLoader.all`)? If yes, generate immediately via the existing
  pipeline. If no, this is the literal "ask for upload material" branch —
  Homework Help's tile should visually highlight (a real, added state, not
  a fake pulse animation over nothing) and its real upload flow does the
  rest.
- Tile routing: once a `StudyPlan`-shaped result exists, decide per-tile
  content honestly — Binder gets a real filed doc (`BinderStore.addDoc`),
  Homework Help shows the real question/definition text, Moodle shows a
  real chapter/concept breakdown *only when the source was a book graph*
  (an ACT-math match has no "chapters" — don't fabricate a chapter list for
  it), the Jesse tile shows the real conversation/turns already flowing
  through `jesseCall.turns`. No tile should ever show placeholder content
  dressed up as real.
- Dynamic layout (tiles collapse when they have nothing, neighbors grow):
  `DeskBoxBus`'s existing grow/shrink negotiation (`boxBus.requestSpace`,
  already used by Binder) is the real, proven mechanism for this — extend
  it, don't build a second layout system alongside it.
- Save & Exit: file the session to Binder (`BinderStore.addDoc`/`addBook`
  depending on shape), then reset dashboard state (`phase`-equivalent local
  `@State` back to idle) — same shape as `LearnStudioView`'s own "New topic"
  reset button.
- Voice-triggered resume ("if you say let's do that work... Jesse opens this
  dash as is"): needs the saved Binder doc to carry enough structured
  metadata (matched concept/book id, not just prose) that a later call can
  actually match spoken intent back to it — design this as part of the
  Save & Exit payload shape, not as a separate retrieval system bolted on
  after.

**Files likely in scope:** `Views/DeskGridDashboardView.swift` (the Jesse
tile, tile routing, Save & Exit, dynamic collapse/grow),
`Networking/JesseCallSession.swift` (the greet path, a new
`context == "workDashboard"` branch in `askJesse()` mirroring
`askJesseBook`/`askJesseResume`/`askJesseLearnStudio`'s existing shape),
`Networking/StudentAIKeyStore.swift` (reuse `generateStudyPlan`, don't fork),
`Views/FieldDeskView.swift` (Homework Help's upload-highlight state),
`Networking/BinderStore.swift` (if the Save & Exit payload needs a new
field for voice-resume matching).

**Definition of done:** open the Work Dashboard, hear Jesse's greeting,
say or type a topic that has real matched content (an ACT concept or one of
the 5 bundled books) — real generated content appears in the right tiles,
no fabricated web search or images anywhere. Say or type something with no
match — Homework Help visibly becomes the upload target, uploading real
material (photo/PDF) drives the same generation. "Save & Exit" files to
Binder and resets the dashboard. `xcodebuild build` green, confirmed on a
real device with a real saved AI key.

**Update (2026-08-18, later same session) — most of this is now actually
built**, not just spec'd: `askJesseWorkDashboard` in `JesseCallSession.swift`
does the real check-repo-first flow (bundled book graphs, then Dan
McCreary's real `archive-rag` open-textbook archive, then honest generation
as the last resort), routes into Binder/Homework Help, and matched real
McCreary MicroSims (Calculus, 123 real interactive p5.js sims) show as
tappable rows opening a real `WKWebView`. **Still not built**: the voice
greeting on arrival, Homework Help's upload-target visual highlight tied to
a real "no match found" state, dynamic tile collapse/grow via `DeskBoxBus`,
and — the two pieces below carry forward unchanged — **Save & Exit** and
**voice-triggered resume**.

---

#### Assignment K — Dashboard visual redesign: black canvas, left nav rail, dynamic per-student knowledge graph, "swirl-around" work canvas

**Context.** Akshat shared three reference screenshots from a Gemini product
launch (a "Where should we start?" prompt over floating 3D stat-card icons;
a glassmorphic chat UI with a left icon rail + settings gear, and a 2×2
content grid: file-summary box / person+transcript pairing / a
knowledge-graph-shaped box) and asked for the Work Dashboard to move toward
that visual language. Given the scope (new onboarding animation, a new nav
model, a real dynamic knowledge graph, and an entirely new pannable canvas)
this was split: the safely-scoped visual pieces shipped the same night (see
below); everything else is written up here rather than rushed.

**Shipped the same night:**
- Dashboard board background is black, not cream (`Color.black`, was
  `Color(gridHex: "fff8e9")`) — tile title labels switched to white
  (`.foregroundColor(.white)`, were dark green — unreadable on black).
- The MindCraft raccoon logo moved from top-left to top-right *specifically
  on the Work Dashboard* (`FieldDeskView.swift`'s chrome overlay now keys
  its alignment off `showDeskGridDashboard`) — every other screen (Jesse's
  Kitchen, Create Studio) keeps the logo at top-left, unchanged.
- A real left sidebar (`leftSidebar` in `DeskGridDashboardView.swift`, 64pt
  wide, translucent) with one real, working control today: a gear icon that
  opens the same Manage page the old top-left logo used to (`onOpenManage`,
  wired from `FieldDeskView` to `openManageFromChrome()`). This is
  deliberately the *first slice* of "a big toolbar," not the finished rail
  — see the nav-model item below for what a finished version needs.

**Real gap found, not silently worked around:** Akshat described "113 of
Dan's [McCreary's] books" with real cover art driving a coalescing
onboarding animation. Checked directly (`find` across both this repo and
`mindcraft-content-engine`) — **no book-cover image assets exist anywhere**.
What's real: book *titles* (18 in `webhook/data/dans-archive-chunks.json`,
~30 subjects' worth of MicroSim metadata in the sibling repo) and a text
description per MicroSim, but zero actual cover art. Before building the
onboarding animation, this needs one of: (a) commission/source real cover
art, (b) design a text/color-based placeholder card system (title + subject
+ a generated accent color, no real art needed — matches how `BookGraphs`
already has zero cover art and gets by fine with text-first cards), or (c)
scope the animation around a different, real visual asset this app already
has. Don't build the animation assuming art that isn't there.

**Not yet built — real, scoped pieces for a future pass:**

1. **A real, multi-destination left nav rail.** Today's `leftSidebar` is one
   gear icon. The reference vision wants it to jump between Learn (today's
   dashboard), Presentation, Resume, Book, and Design — i.e., replace (or
   sit alongside) the existing Flows-rail/dock-chip navigation with a
   persistent left-edge rail. This touches `FieldDeskView.swift`'s whole
   `show___` overlay-boolean navigation model (see CLAUDE.md's own flagged,
   deliberately-deferred "collapse into one `activeOverlay: OverlayKind?`
   enum" note) — a real architectural decision, not a quick add.

2. **A pannable "swirl-around" canvas with rectangular work sections**
   (Presentation / Resume / Book / Design, per Akshat's list — the
   dashboard/Learn stays the anchor, not one of the swirl sections).
   `DeskGridDashboardView` already has real pan/zoom (`spaceGesture`,
   `DragGesture` + `MagnificationGesture`) and `CreateCanvasView` is a real,
   working precedent for a single pannable work surface — the real design
   question is whether this becomes ONE big canvas with all sections laid
   out at different coordinates (reusing `spaceGesture`'s existing
   pan/zoom, extending `WorkArtboard`-style fixed rects further out along
   one axis) or stays multiple separate screens reached via the nav rail.
   Akshat's "you move around and navigate every screen with that toolbar"
   phrasing suggests the rail *jumps* between sections rather than the
   student physically panning between them — worth confirming before
   building, since the two are meaningfully different amounts of work.
   Each section resetting its own Binder view on entry needs a real
   decision too: does Binder show ONLY that section's filed items, or
   everything with a section filter? (`BinderStore.addDoc`'s `source`
   field already carries enough to filter by if that's the shape wanted.)

3. **A real, dynamic, per-student/per-upload knowledge graph** (the
   "dog box" in the reference image) — Akshat's explicit ask: "instead of
   being static, hard-coded 42 concepts, it grows dynamically as I learn
   new things... or maybe it's for whatever PDF I upload... it'll be better
   if it's my long-run graph." What's real and already shipped tonight:
   `KnowledgeGraphClient` reads the student's live per-concept mastery from
   `GET /knowledge-graph/{uid}` and a compact Canvas rendering shows it in
   the old Moodle slot. What's NOT real yet: that endpoint serves the
   *static* 42-concept `ml/data/5_level_ontology` ontology only — it has no
   path for a concept graph to grow from something a student uploads.
   The real foundation for this already exists in the Engine lane, unmerged:
   **PR #49** (`engine/dynamic-concept-graphs` branch) adds
   `ml/mindcraft_graph/loaders/dynamic_concept_loader.py` — real,
   DAG-validated loading + `merge_ontology()` of per-book dynamic concept
   graphs into the base ontology, with 18 passing tests. It was deliberately
   NOT merged to `main` out of respect for Blake's Engine-lane ownership.
   Making the knowledge-graph tile genuinely per-student-and-per-upload
   means: (a) get PR #49 reviewed/merged (Blake's call), (b) a real pipeline
   from "student uploads a PDF in Homework Help" → book/concept-graph
   generation (the same `mindcraft-content-engine` pipeline that produced
   the 5 bundled `BookGraphs` and the McCreary MicroSim extracts) → the
   dynamic loader, and (c) `/knowledge-graph/{uid}` (or a new endpoint)
   actually returning the merged, per-student graph instead of the fixed
   ontology. This is real, buildable, cross-lane work — not a client-side
   tweak, and shouldn't be attempted as one.

4. **File-upload directly from the dashboard's own search bar** (the
   "Ask Gemini" bar in the reference attaches files inline). Today, upload
   only happens by tapping the Homework Help tile directly
   (`.fileImporter`/`HomeworkDocumentPicker`, both real and working) — the
   main search field (`deskGridDashboardSearch`) has no attach affordance.
   A real addition, not a big one: add an attach button to the search bar
   reusing the same `HomeworkDocumentPicker`/`handleHomeworkFileUpload`
   pipeline Homework Help already has, rather than building a second upload
   path.

**Files likely in scope for the above:** `Views/DeskGridDashboardView.swift`
(nav rail, swirl canvas or section screens, search-bar attach),
`Views/FieldDeskView.swift` (nav-rail-driven overlay routing, if the
`show___` boolean model gets touched), `ml/mindcraft_graph/loaders/
dynamic_concept_loader.py` + `ml/serve.py` (PR #49, Engine lane — coordinate
with Blake, don't just merge it solo), a new or extended `/knowledge-graph`
endpoint, `Networking/KnowledgeGraphClient.swift` (consuming whatever that
endpoint returns once it's real).

**Update, 2026-08-18/19:** PR #49 merged (Akshat's own explicit go-ahead,
not solo) — 185 concepts now live in the mastery engine once `ml/` is
redeployed to the HF Space (needs an HF write token neither Claude Code nor
this environment has — Akshat or Blake runs `HF_ORG=joinmindcraft
ml/scripts/deploy_hf.sh`). Everything else above ("shipped the same
night") is now heavily superseded by same-session work not yet written up
here in detail — dashboard background reverted back to cream/white (not
black), left sidebar is a full multi-destination rail (Presentation/GDoc
parked, not removed; Resume; Develop — a real Workflows/Books toggle
merging Design Studio + Book Workflow), real book cover art DOES exist
(`agent_work/product/desk_os/workflows/archive/covers/`, 122 real files —
the "no cover art" finding above was wrong, corrected live), toolbar
moved to screen-space and matches the white card style everywhere else.
Treat this doc's Assignment K body text as a historical snapshot, not
current state — check `ios-prototype/MindCraftNotes/MindCraftNotes/Views/`
directly before assuming anything above is still accurate.

---

#### Assignment L — Study Session: tabbed, chapter-by-chapter lesson view (Cardiology reference, 2026-08-18/19)

**Context, verbatim intent (Akshat, product screenshot reference — a
medical-chart dashboard: dark charcoal panel, a rounded-pill tab row across
the top for chart sections, a stat row, a scrollable timeline of
expandable cards connected to date markers, a full-width bottom scrubber
bar with per-month event ticks).** A concept can span multiple chapters,
each chapter can span multiple sims/pages, and none of that fits on one
screen. Desired behavior, explicit:

- Talking to Jesse / uploading to Homework Help must NOT navigate the
  student away from the dashboard - "the dash was changing... right now,
  what will happen instead is that once that happens, the dash stays."
  One thing gets appended to Binder for the session; a new tabbed surface
  opens **in the same canvas** for the student to work through.
- The AI decides how many tabs/chapters a topic needs at generation time
  - not a fixed count. (Ties to the in-progress `mindcraft-content-engine`
  work training content generation - not live yet, see below.)
- Tab 1 is the default landing tab. Within a tab, a left/right arrow steps
  through that tab's own pages (however many the content actually needs -
  "5, 10, however many pages you need to completely teach that content").
  The arrow's SECOND click (after the first page's own analysis/load
  finishes) is what reveals tab 2; tabs unlock as their prerequisite
  content is actually ready, not all at once.
- Last tab: sources/citations, properly attributed (matches
  `ArchiveRagClient`'s real `hits[].pageUrl`/`bookTitle` today, or "AI-
  generated, no source" when the lesson came from generation instead of
  the archive).
- A close control (matches the reference's own top-left X) saves
  everything real to Binder as one dated entry with a summary, closes
  every open tab, and resets the dashboard to how it looked on arrival.
- Starting a NEW "Jump on a call with Jesse" resets back to tab 1 / closes
  the session - same close-and-save behavior as the explicit close button.
- Visual language: this session's OWN overlay can use the reference's dark
  panel aesthetic (it's the one surface Akshat explicitly asked to look
  like the reference) - this does NOT reopen the "background should be
  white everywhere" ask from the same session, which was about the
  dashboard's own toolbar/dock looking inconsistently dark, a fixed,
  separate, already-shipped complaint.

**What's real today vs. what this needs to build on:**
- ✅ `JesseCallSession.workDashboardLesson` (`WorkDashboardLesson`: topic,
  source, `chapters: [String]` - titles only today, `definition`,
  `question`, `microsims`) - real, live, generated per the archive-check-
  then-generate pipeline in `askJesseWorkDashboard`/`generateFromMaterials`.
  This is the real data source for tabs; each `chapters[i]` becomes one
  tab title.
- ❌ Chapters are titles only - no per-chapter BODY text exists yet, so a
  tab has nothing of its own to show beyond a title today. Needs
  `LessonOutline`/`generateTableOfContents` extended with a parallel
  `chapterBodies: [String]` (same index as `chapters`) so each tab has
  real content, not a repeat of the single top-level `definition`. This
  is a real, scoped, safe prompt change - not blocked on anything.
- ❌ "However many pages a chapter needs" (multiple pages PER chapter,
  not one) genuinely needs the richer, structured content-generation
  pipeline referenced in the live "89 learning graphs" / McCreary MicroSim
  work in `mindcraft-content-engine` - that pipeline is real and has
  real, tested progress (see its own `ENGAGEMENT_TRAINING_SIGNAL_SPEC.md`
  for the separate, gated engagement-training piece specifically), but is
  not yet wired to produce per-chapter multi-page content this app can
  consume. Until then, each chapter tab is genuinely one page - honest,
  not faked as more.
- ✅ Real MicroSims (`MicroSimLoader.matching`) and real archive citations
  (`ArchiveRagClient.Hit`) already exist and should populate the
  simulations/sources tabs directly, no new backend needed for those two.
- ❌ No Binder-save-and-reset-on-close exists yet for this flow
  specifically (Homework Help's own upload summaries already file to
  Binder via `onFileHomeworkToBinder` - the NEW session view needs its own
  equivalent close handler).

**Proposed shape (subject to revision once building starts - flag any
deviation here rather than silently diverging):**
- New `StudySessionView.swift` - a dark-panel overlay, NOT a
  `.fullScreenCover` (keeps the dashboard mounted underneath per the
  explicit "dash stays" ask, same reasoning as this session's own
  Presentation/GDoc pan-nav work in `DeskGridDashboardView`).
  `DeskGridDashboardView` presents it as a screen-space overlay (matching
  `bottomDock`/`leftSidebar`'s own screen-space pattern) whenever
  `jesseCall.workDashboardLesson != nil`, dismissed by either its own
  close button or a fresh `jumpOnCall()`.
- Top tab row: one pill per `lesson.chapters[i]`, plus a fixed trailing
  "Sources" tab. Active tab styled filled/dark, matching the reference.
- Body: active tab's `chapterBodies[i]` (once that field exists) with
  left/right arrow paging - single-page-per-chapter for now, architected
  so a future `[ChapterPage]` array slots in without a rewrite.
- Bottom strip: small tappable markers, one per chapter, current one
  highlighted - direct-jump navigation, same spirit as the reference's
  bottom timeline.
- Close control: saves `lesson` to Binder (title = topic, body = definition
  + chapters joined, same shape `onFileHomeworkToBinder` already uses
  elsewhere) and clears `jesseCall.workDashboardLesson`.

---

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

**2026-08-17 — Claude's audit of Assignment C, in progress** — PR #46 (`cursor/student-ai-key-2c98`) open, **not yet merged**.

Code-reviewed `StudentAIKeyStore.swift` line by line, not just the PR description: Keychain-only (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — correctly excluded from iCloud Keychain sync), the raw key is never logged anywhere in the file, and both provider calls guard `url.host == Provider.x.host` before sending — real defense in depth even though the URLs are hardcoded. `AccountManageView`'s Save/Test/Remove UI clears the draft field after save so the raw key never lingers displayed. `HomeworkClient`'s `Outcome` enum cleanly distinguishes key-rejected (Settings-facing message) from engine-unavailable (generic message) — read the diff, this is a real behavioral improvement, not just plumbing. Confirmed `xcodebuild build-for-testing` green, `testDashboardBoxMascotsExist` + `testWorkBinderPopupHasMemoDocBYOB` pass on-simulator, then installed on physical iPad and confirmed the Settings UI renders and doesn't crash.

**What's NOT verified — needs a real key**: I don't have a Groq/Anthropic key of my own and won't sign up for one unprompted. The actual "paste a problem, get a real answer back" round-trip is unconfirmed. **First task for whoever picks this up: paste a real free Groq key into Settings → Homework help → Test, confirm it says "Key works," then check `gh pr checks 46` — CI was still running the XCUITest suite as of this note (started 2026-08-17T06:28:22Z, full suite runs ~35-40min) — mark the PR ready (`gh pr ready 46`, it's a draft) and merge (`gh pr merge 46 --merge`) once green, sync `main`, then append a dated report entry here same as A/B/C before starting Assignment D.**

Also landed directly on `main` tonight (small, isolated, didn't need a PR): a Greptile-flagged overflow bug from PR #45 — compact (non-grown) Email tiles could clip when a digest row's `why` subtitle wrapped to 2 lines across all 3 shown items. Fixed by only showing the subtitle once a tile is actually grown. Commit `26aaba5a`, verified build+tests+device before pushing.

**2026-08-17 - Codex audit of Assignment C - PR #46 READY, NOT MERGED** - branch `cursor/student-ai-key-2c98`, audited iOS head `39b4911c83b7220cf581c2bacf29670b365f8f3e`. Later PR tips are documentation-only commits that keep this report aligned with `main`; use `gh pr view 46` for the current tip. PR is open, no longer draft, and GitHub reports it mergeable. Akshat explicitly reserved the actual merge for Claude, so no merge was performed and Assignment D was not started.

Read the complete diff and provider contracts, not just the prior report. The Keychain-only/host-guard/no-logging design is intact, the no-key path still calls the existing MindCraft endpoint, and the Settings sheet is now reachable from the live hub (`43a8845e`). Found two release-blocking pieces of provider drift: Groq shut down `llama-3.3-70b-versatile` for the free/developer tier on 2026-08-16, and Anthropic retired `claude-3-haiku-20240307` on 2026-04-20. Commit `9e58bd6a` moves them to `openai/gpt-oss-120b` and `claude-haiku-4-5-20251001` using the providers' current request fields, changes Keychain accessibility to `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, and replaces delete-then-add key updates with `SecItemUpdate` so a failed replacement cannot erase a working key. Sources checked: https://console.groq.com/docs/deprecations and https://platform.claude.com/docs/en/about-claude/model-deprecations.

Added live-path UI coverage in `7d2771f5`: Work Dashboard -> Manage -> hub -> Settings -> AI status/provider/key/Test controls -> Done -> hub. The first two local attempts failed before reaching any PR UI because the test still waited for the obsolete `fieldDeskModeToggle`; the failure reproduced after a simulator shutdown/reboot, then the test's launch precondition was corrected to the current `deskGridDashboard` landing. Greptile reviewed the substantive diff at 4/5 and raised one P1: `StudentAIKeyStore.swift` used `ObservableObject`/`@Published` without an explicit Combine import. Fixed in `39b4911c`, replied with verification, and resolved the only review thread. Greptile did not post a fresh numeric score after that one-line fix (its manual retrigger redirected to login), so the audited iOS head was also re-read and rebuilt locally rather than claiming a nonexistent second review. `d4b942ce` keeps this handoff file identical to current `main`, which removed the PR's prior document conflict without merging `main` into the branch.

Verification on audited iOS head: local `xcodebuild build-for-testing` passed (only existing warnings in `FieldDeskView.swift`/`HomeworkClient.swift`), and focused `testDeskHubMasteryGoalAndCheckIn` passed in 27.945 seconds with 0 failures. GitHub iOS run `32005775191` passed at 42m52s: https://github.com/KoKa-Akshat/mindcraft/actions/runs/32005775191. Its required compile step passed. The workflow's continue-on-error full UI sweep still returned exit 65 with 23/38 failures; the immediately preceding Assignment B run `31985452151` had the identical 23 failures plus `testDeskHubMasteryGoalAndCheckIn` and `testWorkBinderPopupHasMemoDocBYOB` (25/38 total). Both of those now pass, no new failed test appeared, and the exported failure artifacts repeatedly show the known stale `fieldDeskModeToggle` launch assumption. This is baseline suite debt hidden by the workflow's best-effort setting, not a new Assignment C regression.

GitHub still labels the PR `UNSTABLE` only because its unrelated Vercel webhook preview is red. Inspected deployment `dpl_DZhwsRXy4cpkMHpCf6svC21LiR5h`: `api/tts` packaged at 452.67 MB over Vercel's 250 MB preview limit; PR #46 changes no webhook files, and current `main` deployment `dpl_Yn92vZyqkqNcE2K4gDgzMd847tgw` succeeded from the same webhook tree. Did not cross the Engine lane to alter deployment configuration.

**Still not verified; this remains the Assignment C pre-merge gate:** no Groq or Anthropic key exists in this environment, and `xcrun devicectl list devices` could not initialize CoreDeviceService because no physical iPad was available. Claude must connect the iPad, save and Test a real current provider key, confirm "Key works," then paste a homework problem and receive a real answer from that key. Only after that should Claude merge PR #46. Do not call Assignment C definition-of-done complete before this test.

**2026-08-17 - Codex takeover follow-up: Assignment C installed on device, real-key gate still open; typed-box audit written** - PR #46 remains open and unmerged. Current PR tip is `51c5f6ebc6c2d82be5d90c45adf1c86da4d03478`; its only changes after audited iOS head `39b4911c83b7220cf581c2bacf29670b365f8f3e` are handoff synchronization commits. GitHub reports the PR mergeable and no longer draft. The only live review thread was Greptile's missing-Combine finding; it is resolved, and the current source imports Combine. The PR remains `UNSTABLE` solely because the unrelated Vercel preview exceeds its function bundle limit. No PR merge was performed and Assignment D was not started.

Re-ran verification at the exact PR tip rather than relying on the earlier report. `xcodebuild build-for-testing` passed for a generic iOS Simulator. A first focused run of `testDeskHubMasteryGoalAndCheckIn` on the stale `MC-Test-iPad3` simulator timed out querying `manageAIKeyStatus`; its exported accessibility hierarchy nevertheless showed the live path and all expected controls: `accountManage`, Settings, HOMEWORK HELP, Use your own AI key, `manageAIKeyStatus` with "No key saved," provider selection, secure key field, Save, and Test. Repeating the same focused test on a newly created `MC-Fresh-Test` simulator passed in 32.768 seconds with 0 failures. Result bundle: `/private/tmp/mindcraft-pr46-focused-fresh.xcresult`. Existing compiler warnings in `HomeworkClient.swift` and `FieldDeskView.swift` remain, with no new build error from PR #46.

The physical-device limitation from the previous report is now cleared. CoreDevice found Akshat's connected iPad Air (5th generation), device ID `DD553C3C-D821-5869-BBA2-AB501D46210E`. A device-targeted signed build at the exact PR tip passed, `com.mindcraft.notes.prototype.akshat` installed successfully, and the app launched successfully on the iPad. It is the PR build, not `main`, so the reachable path is now The Desk Manage -> hub gear -> Settings -> Homework help. No signing/trust or launch crash was observed.

**Still not verified and still the only Assignment C release gate:** this environment has no Groq or Anthropic key, and Codex did not request or log Akshat's secret. Akshat was asked to use his own key directly on the iPad, tap Save and Test, confirm "Key works," then use Work -> Paste a problem and confirm a real provider answer. Until that human test is reported successful, Claude should not merge PR #46 or call Assignment C complete.

Audited the requested box architecture without implementing it. New design document: `agent_work/product/DESK_TYPED_BOX_GRAPH.md`. It confirms the intended shape: Jesse remains the only conversational agent; Intel/Moodle/Binder/Email/Gcal own tools, data, cache, freshness, deterministic actions, and compact typed reports; a box may invoke a bounded model only when deterministic logic is insufficient. The audit found that today's single conceptual Jesse has two divergent context pipelines (`DeskBoxBus` -> `/api/archive-rag` and legacy `FieldDeskStore` -> `/api/desk-ask`), full free-form box briefings are repeated on unrelated remote turns, Gmail digest inputs lack a revision fingerprint, canonical Binder identity is reduced to titles in one path while the other uses a legacy store, and there is no common private-safe token/call telemetry. The document proposes typed reports/commands, selective revision deltas, digest deduplication, layout/content bus separation, a measured call budget, tests, and a future PR sequence. It borrows Weft's typed-edge and scoped-graph ideas but explicitly rejects adding its early server runtime to the iOS app now. No claim of a Weft token-savings percentage is made because no official benchmark supporting one was found.

**2026-08-17 — Claude, later same night — PR #46 still gated on the real-key test; new PR #47 opened on top of it (do not merge either yet)**

Confirmed Codex's overnight work on #46 by reading it, not re-doing it: the Groq/Anthropic model-ID fixes (`openai/gpt-oss-120b`, `claude-haiku-4-5-20251001`), the Keychain `SecItemUpdate` correction, and the Settings-reachability fix (`43a8845e`, real bug — the sheet genuinely wasn't wired to show before) are all real, sound fixes. Still true: **nobody has done the real-key device test.** That's still the gate. I don't have a Groq/Anthropic key and won't sign up for one unprompted — this needs Akshat, by hand, on the physical device: Settings → Homework help → paste key → Save → Test → confirm "Key works" → Work → paste a problem → confirm a real answer comes back.

Separately, Akshat asked for a live box-grid redesign while waiting on that: Email Summaries/Gcal merged into Intel (three sections — Research/Email/Calendar), a new Homework Help box in Intel's old slot with a real working popup (not a stub — reuses `StudentAIKeyStore`/`IngredientHintsClient` from #46), Binder now never shows its mascot. Built on top of #46's branch since Homework Help needs `StudentAIKeyStore` to mean anything. Shipped as **PR #47, draft, explicitly blocked on #46 merging first** — do not merge #47 before #46.

Verified for real: build + build-for-testing green on both device and simulator, 3 of 5 relevant tests pass clean (`testDashboardBoxMascotsExist`, `testHomeworkHelpOpensConnectPromptWithoutKey`, `testWorkBinderPopupHasMemoDocBYOB`). The other 2 new tests (`testIntelTileShowsMergedSections`, `testWorkDashboardShowsSeededEmailSummariesInIntel`) hit a **real discovery worth remembering**: a native Calendar/EventKit permission dialog can appear on a freshly-erased simulator and race against XCUITest's automatic system-alert dismissal — sometimes the race is lost and the whole app looks hung at cold load. Confirmed via git-stash isolation that this reproduces identically on the *unmodified* baseline, so it's pre-existing and environmental, not a regression from tonight's work — matches the same family of flakiness CLAUDE.md already documents for AX-degraded simulators, just a different trigger (a real system dialog, not a resolution glitch). If this resurfaces: `xcrun simctl privacy <device> grant calendar <bundle-id>` before the run may help; plain `revoke` did not suppress the dialog in my testing, only `xcodebuild test`'s own alert-auto-dismissal (which isn't always fast enough) does.

Also live, uncommitted-elsewhere-so-noted-here: Codex's separate product-vision package under `agent_work/product/future_school_vision_2026-08-17/` (deck, thesis, pitch script, platform concept — a genuinely different, large deliverable, not iOS code) is sitting untracked in the working tree with its own `CLAUDE_HANDOFF.md` addressed to me. Have not reviewed it in depth tonight — flagging its existence rather than rushing an audit of a business/pitch document at the tail end of an already-long session. Whoever picks this up next: it explicitly should NOT be committed/reconciled with the box-grid work until it's actually been read.

Two items from Akshat's ask tonight are deliberately **not done** and need their own scoped assignment, not a rushed pass: (1) Homework Help's full upload/write/"web-version parity" feature — today's popup only does paste-a-problem; (2) the "connect your AI" flow seamlessly from the search bar / bottom toolbar (tapping Search/Flows/etc. with no key saved should prompt to connect right there) — today that only lives in Settings and the Homework Help popup. Also flagged, not fixed: Moodle's mascot art doesn't read as Moodle's actual brand (a design/asset call, not a code bug — needs Akshat's input on new art vs. a small logo badge, not a guess).

**Next, in order: (1) the real-key test on #46, (2) merge #46, (3) merge #47, (4) scope the upload/write + search-bar-connect work as new lettered assignments, (5) read the future-school-vision package before deciding what if anything becomes an iOS task from it.**

**2026-08-17 — Claude, real on-device SIGSEGV crash on PR #47's branch, found and fixed — verified by Akshat on his iPad**

Akshat reported real crashes (instant kick-to-home-screen) tapping Search, Binder (specifically the *second* tap), and Homework Help on the physical iPad, after PR #47's box-grid work landed. Not caught by any simulator test — this is the documented "fine in simulator, crashes on device" failure class.

First pass (commit `92eaea1f`, already on this branch): pulled the real crash log via `xcrun devicectl device info files --domain-type systemCrashLogs` + `device copy from`. Found `EXC_BAD_ACCESS`/SIGSEGV, "Could not determine thread index for stack guard region" — a Swift type-metadata-resolution stack overflow. Traced it to `DeskGridDashboardView.intelSections()`'s three nested multi-branch conditionals and fixed by extracting each into its own function wrapped in `AnyView(...)`. **This was necessary but not sufficient** — Akshat retested and the identical crash still happened on the identical three taps, on a truly clean reinstall (confirmed via `devicectl device info apps` there was never a second app — the "two apps on my iPad" report was a stale SpringBoard icon left over from the display-name change to "The Desk", not a real second bundle; bumped to build 1.66/66 to make the reinstall provably fresh either way).

Caught the real crash live by launching with `devicectl device process launch --console` and having Akshat tap through the app while I watched: `App terminated due to signal 11` — genuine SIGSEGV, same signal class, on the exact rebuilt binary. That ruled out the ghost icon, ruled out a stale build, and proved the first fix hadn't addressed the actual site.

Root cause (commit `e87ef790`): `FieldDeskView.body`'s root `ZStack` composes **~20 independent `if show___ { ... }` overlay branches directly** — ACT Field Book, Calendar, Intel, Binder, Homework Help, the dashboard itself, Apply Today, Scheduling Workflows, Gmail, Projects panel, Projects screen, Standalone Desk, Create Studio, Create Canvas, the polka transition, Add panel, connect guide, toast — none type-erased. This is the exact structural risk CLAUDE.md already flagged as "genuinely open, deliberately deferred" (the `activeOverlay: OverlayKind?` enum note). `intelSections()` was one contributor at 3 branches; the root `ZStack` was the real one at ~20. Adding Homework Help as the 20th branch tipped it over the edge for on-device type-metadata resolution, and because the crash is about the *combined* compound generic type of the whole `ZStack`, toggling **any** branch could trigger it — explaining why Binder's second tap crashed too, not just the new Homework Help code.

Fix: wrapped every one of those ~20 branches' view expressions in `AnyView(...)`, same behavior-preserving pattern as the `intelSections` fix, just applied comprehensively instead of piecemeal. Verified for real, not by inspection: built clean (simulator first for fast syntax feedback, then device), installed fresh, launched with `--console` attached, and had Akshat tap Search → Binder (twice) → Homework Help live while I watched the console for a repeat crash. None occurred. Akshat also independently exercised the pre-existing Calendar-permission "Don't Allow" flow during the same pass and confirmed it behaves correctly (matches the pre-existing/environmental flake already documented above — not something this fix touched, just incidentally re-confirmed healthy).

**Lesson for whoever touches `FieldDeskView.swift`'s root `ZStack` next**: every new `if show___ { ... }` branch there needs `AnyView(...)` around it, not just a `deskOverlayChromeBlocked` entry (that guardrail prevents the touch-swallowing bug; it does nothing for this type-complexity crash, they're two independent failure modes documented in the same file for two different reasons). The `activeOverlay: OverlayKind?` enum refactor CLAUDE.md defers would eliminate the underlying need for this pattern entirely — still not done, still a real option for whoever has a full reviewed session to spend on it.

PR #47's branch (`cursor/box-grid-redesign-2c98`) now has both fixes. Gate is unchanged: **the real-key test on #46 is still the next thing that has to happen before either #46 or #47 merges.**

**2026-08-17 — Claude, real-key gate cleared: Akshat confirmed his Groq key works on-device across both Homework Help and the new agent takeover (real drafted email reply, real answered questions).** Resolved the CURSOR_HANDOFF.md conflict against main (Engine-lane commits had diverged the branch heavily; no iOS code conflicted), confirmed `xcodebuild build` still green post-merge, waited for CI (`build-and-test` passed, 40m30s - the only red check is the pre-existing, already-investigated, unrelated Vercel webhook package-size failure), then merged via `gh pr merge 46 --merge`. **PR #46 is MERGED.** PR #47 (`cursor/box-grid-redesign-2c98`) is next - it now also contains the crash fix, search fix, and generalized agent-takeover work from tonight, all pushed and CI-worthy but not yet itself re-verified against this new main tip.

---

**2026-08-17/18 — Claude, overnight marathon session — #46 merged, large iOS batch shipped on `cursor/box-grid-redesign-2c98` (not yet a PR)**

#46 merged after resolving a real git conflict and confirming CI green and a
real on-device key test (per Akshat, tested and working). Everything below
landed as direct commits on `cursor/box-grid-redesign-2c98`, verified via
`xcodebuild build` + real device install/launch each time, not just compiled
— this branch has NOT been opened as a PR yet, so `gh pr list` won't show it.
This entry is a pointer, not a full diff — `git log --oneline
b76afc88..cursor/box-grid-redesign-2c98` has the real detail; read commit
messages, they're written to stand alone.

Real fixes: SIGSEGV crashes on Search/Binder/Homework Help (un-type-erased
`@ViewBuilder` chains — wrapped in `AnyView`), Work Dashboard search (was a
backwards `.contains()` — completely dead before this), then generalized
search into a real agent-takeover mechanism that borrows the Binder/Intel
tiles for any request instead of opening new floating boxes.

New/rebuilt surfaces: real Homework Help photo upload (now files results
into Binder instead of its own popup — see "Homework Help files into Binder"
commit); a new five-pane Learn Studio (`LearnStudioView.swift`) with a real
two-phase intake→AI-generated-plan→adaptive-box-layout flow
(`StudentAIKeyStore.generateStudyPlan`); a shared `JesseRailView.swift`
(extracted from `CreateCanvasView`'s original "Jesse card") now used
uniformly by Resume/Book/Learn Studio/Presentation instead of each screen
inventing its own; Apply Today folded into Resume, Archive folded into Learn
Studio (explicit, confirmed product-scope decisions — the underlying
`JobOSStore`/`ArchiveWorkflowView` are untouched, just reached differently);
Resume's "Applications" now opens inline on the left instead of a
`.fullScreenCover`; Presentation's real box-overlap bug fixed (`slidesRail`/
`jesseRail` overlapped by 139pt on every normal load) plus tightened
margins and a search-styled Ask AI dock; Work dock chip set is now Memo,
Transcribe, Learn, Flows, +Book.

Real, confirmed regression caught and fixed same night: Resume briefly
showed two separate "Jesse" identities — the shared `JesseRailView` on the
right, and the embedded web page's own unprompted `speechSynthesis` greeting
plus "Hi. I'm Jesse." header on the left. Fixed at the web source
(`agent_work/product/desk_os/workflows/resume/{index.html,agent.js}`,
pushed straight to `main` per the "edit the source, never `app/public/`"
rule — this is a separate deploy from the iOS branch, already live).

**Not done, deliberately — new Assignments F and G above are the scoped
follow-up**, written tonight with real technical grounding (exact backend
contracts, the shared-`JesseCallSession`-routing gotcha, the existing tutor
client) rather than left as a vague ask:
- **Book still has two Jesses** — the web page's own full call
  (`agent_work/product/desk_os/workflows/book/agent.js`) runs independently
  of the native `JesseRailView` added on the right, which today is
  decorative. Assignment F.
- **Learn Studio is one-shot, not conversational** — cards come from a
  single static form submit, not a live conversation. Assignment G.
- Presentation (`CreateCanvasView.swift`) has further asks not yet
  addressed: move/resize the slide stage further left, reposition its search
  bar to match the dashboard's standard position, and render uploaded docs
  scrollable in the same box as slides (top 2/3 slides, bottom 1/3 uploads).
  Not yet scoped as a lettered assignment — do that before starting it.
- "Standard search bar position across dash" — a repeated consistency ask;
  partially addressed (Presentation's dock now visually matches the
  dashboard's `searchField` style) but not audited screen-by-screen.

Branch is NOT yet a PR — before starting F or G, either open one against
current `main` or confirm with Akshat whether to keep stacking on this same
branch. Whoever starts either assignment: branch off current `main` (not off
this long-lived branch) per the lesson in Assignment A's report above, unless
told otherwise.

---

### Claude's report

**2026-08-18 — Assignments F (Book) and G (Learn Studio), both done — pushed directly onto `cursor/box-grid-redesign-2c98`** (explicit instruction this session, not the "branch off main" note two paragraphs up — flagging the deviation: the note above was Cursor's own open question about *sequencing*, not a standing rule, and this session's task explicitly named `cursor/box-grid-redesign-2c98` as the working branch because Assignment F/G's own spec depends on `JesseRailView.swift`/`LearnStudioView.swift`/the current `BookWorkflowView.swift` shape that only exists on this branch, not on `main`).

**Worktree staleness caught before any code was touched, worth recording:** the isolated worktree this session started in had been branched from a point *before* the "overnight marathon" commits (`542c8c79`..`8be21745` — JesseRailView, LearnStudioView, the SIGSEGV fixes, all of it) landed on `cursor/box-grid-redesign-2c98`, even though it carried a commit claiming to add the Assignment F/G spec text. Confirmed via `git merge-base`/`git diff` that the worktree branch's only unique content (two small doc/web-fix commits) was already byte-identical on the real branch, then `git reset --hard cursor/box-grid-redesign-2c98` to get onto the real, current branch before starting. If another agent's worktree ever seems to be missing files this handoff says exist, check for this class of staleness before assuming the file was never built.

Shipped both assignments in one pass, as two separate commits against the same base (`8be21745`), per the sequencing note at the top of the F/G spec:

**Assignment G** (`ae8fa795`) — `JesseCallSession.askJesse()` gained an `if context == "learnStudio"` branch that re-runs `StudentAIKeyStore.generateStudyPlan` per turn instead of falling through to `ArchiveRagClient`. Topic text = this session's conversation only (scoped by `sessionTurnOrigin`, the same boundary `end()` already uses — a Resume or Book conversation from earlier never bleeds into a study plan). Publishes `@Published studyPlan`/`studyPlanError` on `JesseCallSession`, reset in `begin()`. `LearnStudioView` observes both via `onChange` to update its existing `plan`/`planError` state live; the typed-topic form (`createPlan()`) is untouched and still works standalone. One real judgment call beyond the spec's literal text: `studyBoard` (the five-pane studying layout) never rendered `JesseRailView` at all, and Jesse's mic doesn't auto-resume listening after a reply (confirmed reading `JesseCallSession` — that's existing, pre-Assignment-G behavior, not something introduced here) — meaning without a fix, the "conversation" could only ever produce exactly one turn once the screen left the intake phase. Added a small compact live-call control (mic toggle + end call, reusing `JesseMiniWaveform`) to the studying screen to make multi-turn conversation on that screen actually possible — this is additive UI, doesn't touch `JesseRailView.swift`, and is necessary for the definition of done ("cards appear/update on the studying screen **as the conversation progresses**") to be achievable at all, not scope creep.

**Assignment F** (`c467cc9b`) — `BookWorkflowView` is fully native now, no `WKWebView`. New `BookAgentClient.swift` mirrors `agent.js`'s `ask()` exactly (`POST { message, draft }` → `{ reply, draft, readyToPublish }` against the same stateless `/api/book-agent`). `JesseCallSession.askJesse()` gained the sibling `if context == "book"` branch (checked before `learnStudio`, both before the Work-dashboard `DeskBoxBus` briefing — deliberately, since that briefing is Work-dashboard-specific and would be actively wrong context to inject into a book or study conversation happening elsewhere), storing the running draft as `@Published bookDraft`, reset in `begin()`. Verified Resume/Presentation/Archive are unaffected: `grep 'context =='` on the final file shows exactly two branches (`book`, `learnStudio`), everything else still falls through to `ArchiveRagClient` unchanged. Left panel is real native tools/boxes — a "what we need from you" checklist that means something before any call starts (not a blank draft), the chapters rendered live from `jesseCall.bookDraft`, and once there's ≥1 chapter, "send to a tutor for review" listing real tutors from `TutorDirectoryClient` and sending via the student's own `GmailClient.sendReply`. Publish still calls `BinderStore.addBook`, unchanged. `TutorDirectoryClient.Tutor` gained `email`, persisting the value `load()` already parsed per Firestore doc instead of discarding it.

**Two honest judgment calls on Assignment F, both deliberately conservative:**
1. The three hardcoded demo tutors (Akshat/Blake/Abhigya) get `email: ""` — there is no verified real address for them anywhere in this codebase (checked both the iOS and web `DEMO_TUTORS` lists), and fabricating one for real named people felt wrong given how hard this codebase leans on "never invent, always honest failure." `email: ""` correctly triggers the spec's own documented fallback ("if a tutor has no usable email, fall back to their calendlyUrl") — for these three, "send to tutor" opens Calendly, which is accurate, not broken. Real Firestore tutor docs with `calendlyEmail`/`email` set get a real send.
2. `GmailClient.sendReply(to:body:)` is a *reply* composer (`Re: <subject>` prefix logic, `In-Reply-To`/`References` headers when `rfcMessageId` is set) being reused here for a *fresh* outbound email to a tutor, since `GmailClient.swift` is explicitly not in this assignment's files-in-scope and the spec frames it as "already does real sends, reuse it directly." A synthetic `Message` with empty `threadId`/`rfcMessageId` correctly sends as a real new (non-threaded) email, but the subject line still gets an unconditional `Re: ` prefix from `sendReply`'s own logic even though nothing is being replied to — a real, minor cosmetic quirk (tutor sees "Re: Akshat's book draft…" as a first-touch subject), not a functional one. Fixing it properly means either a new `GmailClient` method or changing `sendReply`'s prefix logic, both out of this assignment's file scope — flagging rather than fixing silently.

**Verification, real not assumed:** Xcode 26.6 and two booted simulators were available in this environment (not something I could assume going in) — `xcodebuild build` and `build-for-testing` both green on the full scheme after each commit. Added two new XCUITests (`testBookWorkflowIsNativeWithToolsAndJesseRail`, `testLearnStudioIntakeStillHasFormAndJesseRail`) confirming the native surfaces actually render — Book's tools/chapters/publish panels plus the one shared Jesse rail and call button, and Learn Studio's typed-topic field/Create-plan button still existing alongside the rail. Both pass individually on-simulator (`MC-Fresh-Test`, iOS 26.5); run together in the same `xcodebuild test` invocation the Book test failed on `bookWorkflowBack` after Done — this reproduces the exact "one app install reused across an entire suite run" cross-test-state-leakage class CLAUDE.md already documents for this test harness, not a new regression (isolated re-run of the identical test passed clean). Did **not** run the full 38-test suite (documented at 35-40 min, with ~23 known pre-existing failures from a stale `fieldDeskModeToggle` launch precondition unrelated to this work) — targeted, real signal instead of a long run mostly re-confirming known debt.

**What's still owed — cannot be done from this environment:** no physical iPad, no Groq/Anthropic key of my own. The actual live-call round trips (`/api/book-agent` writing real chapters as you talk; `generateStudyPlan` updating cards live) are unconfirmed beyond code review + the structural UI tests above. **Akshat needs to, on his own iPad:** (1) re-trust the dev profile after this reinstall (Settings → General → VPN & Device Management → Developer App → Trust — required after every reinstall per CLAUDE.md's device-trust gotcha, easy to mistake for a crash if skipped); (2) open Book, talk to Jesse on the right, confirm chapters actually appear on the left and Publish files to Binder; (3) open Learn Studio, tap "Jump on a call with Jesse," describe a topic out loud, confirm cards appear/update on the studying screen as the conversation continues (using the new compact mic control there) and that a real saved AI key drives it, same "connect your AI key" messaging as the form path when no key is set; (4) try "send to a tutor for review" on a book draft and confirm the email actually lands (or Calendly opens, for the three demo tutors).

Files:
- `ios-prototype/MindCraftNotes/MindCraftNotes/Networking/JesseCallSession.swift` — the two new branches (`book`, `learnStudio`) in `askJesse()`, `askJesseBook`/`askJesseLearnStudio`, `bookDraft`/`studyPlan`/`studyPlanError` published state, reset logic in `begin()`.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Networking/BookAgentClient.swift` — new. `BookAgentDraft`/`BookAgentChapter`, `BookAgentClient.ask(message:draft:)` mirroring `agent.js`.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Networking/StudentAIKeyStore.swift` — `StudyPlan` gained `Equatable` (needed for `onChange(of:)`); `generateStudyPlan`/`StudyPlan.parse` reused as-is, not forked.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Networking/TutorDirectoryClient.swift` — `Tutor.email` added and persisted from `load()`'s already-parsed value; demo roster gets `email: ""` (honest, no fabricated addresses).
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/LearnStudioView.swift` — `onChange` wiring from `jesseCall.studyPlan`/`studyPlanError` into local `plan`/`planError`; new compact `jesseLiveControl` on the studying screen; live-error banner in `studyDock`. Typed form path unchanged.
- `ios-prototype/MindCraftNotes/MindCraftNotes/Views/BookWorkflowView.swift` — full native rewrite: tools/boxes, chapters (from `jesseCall.bookDraft`), tutor-forward section, publish button. `WKWebView`/`WKScriptMessageHandler` code deleted entirely.
- `ios-prototype/MindCraftNotes/MindCraftNotes.xcodeproj/project.pbxproj` — registered the new `BookAgentClient.swift` (PBXBuildFile/PBXFileReference/group/Sources phase — this project manually lists files, no synchronized groups).
- `ios-prototype/MindCraftNotes/MindCraftNotesUITests/MindCraftNotesUITests.swift` — two new tests, see Verification above.
- `Views/JesseRailView.swift` — read only, per constraint, not modified.
- `agent_work/product/desk_os/workflows/book/**` — not touched, per constraint.

**2026-08-18 — Claude, "+ Design" shipped and merged — PR #48, separate from F/G**

Not Assignment F or G — a third, parallel piece: `DesignStudioView.swift`,
a new "+ Design" row at the bottom of the Flows menu. A boxy canvas
(draggable/connectable Find/Ask/Make/Output boxes) following the exact
shell shape Learn Studio already established: `JesseRailView` docked
right, content on the same 1440x810 artboard `DeskGridDashboardView`/
`LearnStudioView` both use — not the older WKWebView+desk_os pattern.
Ask boxes make a real call via a new `StudentAIKeyStore.ask(systemPrompt:
userPrompt:)` (generalizes the `complete()` primitive already backing
`solveHomework`/`generateStudyPlan` — same BYO-key path, no separate
setup). Find/Make/Output boxes say plainly they're not wired to a real
backend yet rather than faking a result.

Branched separately from PR #47 on purpose (that PR was, and is, mid-flight
on Book/Learn Studio in the same two wiring files). Opened as PR #48,
picked up a real conflict once #47's Book/Learn-Studio work and an
unrelated Gmail-tile fix (PR #45) landed on `main` first — resolved by
taking `main`'s version wholesale for anything not mine (the Gmail tile
code, `CURSOR_HANDOFF.md`) and re-applying only the one `flowRow` addition
on top, then fixing one stale call site (`DeskGridDashboardView`'s init
had dropped `onOpenHomeworkHelp`/`onOpenLearnStudio` since this branch
forked — Homework Help stays reachable via its existing separate wiring).
`xcodebuild build` succeeded before and after the merge. Merged via
`gh pr merge 48 --merge`. **PR #48 is MERGED.**

Coordinated live with a second Claude Code session Akshat had standing by
as a fallback — it stood down once I confirmed I had it, no double-work.

Still open, not done tonight: Find/Make/Output boxes aren't wired to real
Binder/Gmail/Drive backends, no pan/zoom camera, no NL "describe it, Jesse
builds the boxes" generation, no flow persistence. See
`agent_work/product/flows_2026-08-17/FLOWS_VISION.md` for the fuller list.

---

**2026-08-19 — Claude, Design Studio unified into ONE content canvas — branch `design-studio-unification`, not yet a PR**

Supersedes both the Find/Ask/Make/Output vocabulary above AND the
Develop Workflows/Books toggle (`DevelopStudioView` is deleted; the
Design dock chip / sidebar Develop icon / Flows "+ Design" row all land
directly on the rebuilt `DesignStudioView`). Box types are now content:
`.chapter` (opens the existing `BookWorkflowView` Jesse flow SCOPED to
that box via its new `ChapterScope` — "Save to canvas" instead of
publish; extra chapters Jesse writes become new chained boxes),
`.simulation` (real Blockly workspace in a new `SimulationStudioView`
WKWebView shell — page source at `agent_work/product/desk_os/studio/
simulation/`, bundled via folder reference + `mcworld://simulation`),
`.checkpoint` (small native form), `.branch` (outgoing edges carry
student-named choice labels — `DesignEdge` gained `label: String?`).
The two old canvas gaps are closed: edges can actually be created
(long-press a box or inspector "Connect to…", then tap the target) and
the graph persists (`ContentGraphStore`, UserDefaults `deskOs.*` draft,
FieldDeskStore pattern). Publish walks the graph from the no-incoming-
edges start box(es) into the same `## Chapter` markdown → `BinderStore.
addBook`; a header Preview shows exactly that walk (with honest
placeholders for unwritten boxes, which publish drops).

**Known, named gap:** nothing in the app can READ a branching book —
`StudySessionView` is a flat chapter-list reader and the Binder popup
has no reader at all — so `.branch` publishes as labeled "If you choose
X: continue at …" sections. Documented on
`ContentGraphStore.assembleSections()`, deliberately not papered over.

Standalone `BookWorkflowView` (global draft → Binder publish) is
untouched and still reachable via the workflow library's "Create a
book" and the Flows rail's Book row.

Note for the next agent: this session ran CONCURRENTLY with the
live-gated-generation session on this same checkout (no worktree
isolation) — histories interleaved; this branch was fast-forwarded over
that session's commits and my UI-test rewrites rode along inside its
`f1be9eb1` test commit. Both branches share one linear history; nothing
was rewritten or lost.

---

## Handoff note (2026-08-16 night → 2026-08-17 morning): Codex filling in for Claude

Akshat's Claude Code session is ending for the night. A ChatGPT/Codex session
is filling the **planner** role from here until Claude is back — Cursor
keeps implementing exactly as before, just reporting to Codex instead of
Claude in the meantime. **Nothing about the operating model above changes** —
same loop (investigate real state → write/read the assignment spec → verify
for real, not by trusting a report → append a dated entry here), same file,
same "Cursor executes exactly the scope in front of it" rule.

**For Codex, specifically, starting now:**
1. Read the "Operating model" section at the top of this file in full before
   doing anything else — it's the actual contract, this note is just a
   pointer to it.
2. First real task: finish auditing PR #46 per the note directly above this
   section (CI check + real-key test + merge), **not** starting Assignment D
   from scratch — Assignment C isn't closed out yet.
3. Same discipline that's bitten this process twice already tonight, both
   worth internalizing before touching anything: **(a)** any edit to this
   file must be committed AND pushed immediately — Assignment A's spec once
   sat local-only for ~40 minutes and Cursor built the wrong thing because of
   it; **(b)** branch new assignment work off current `main`, not off
   whatever commit you happened to read it at — Assignment A's PR forked
   right before a big merge landed and needed a real conflict reconciliation
   afterward; Assignment B branching off-tip avoided this entirely, do that.
4. Verify claims against real repo/CI/device state before trusting any
   report — including your own, and including this one. Don't rubber-stamp
   Cursor's "done," and don't let Claude rubber-stamp yours tomorrow either —
   append full, honest detail (what you read, what you ran, what you
   couldn't verify and why) so tomorrow's audit has something real to check
   against, the same way the entries above this one do.
5. When Claude's session resumes, it will read everything appended here
   between now and then and audit it the same way it audited A/B/C — real
   diffs, real builds, real device checks, not just the report text.

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

| Lane | Tree |
|------|------|
| **Engine** | `ml/**`, `webhook/**`, `data/**`, `worlds/**` |
| **Product** | `app/**`, `ios-prototype/**`, `index.html`, `blog.html`, root marketing files |

Cross a lane boundary in its own labelled commit. Shared seam files (also in `CLAUDE.md`) are high blast radius: `app/src/lib/questionBank.ts`, `app/src/lib/mlApi.ts`, `CLAUDE.md`.

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
