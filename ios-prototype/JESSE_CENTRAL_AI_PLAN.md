# Jesse as a central, cross-workflow AI agent — plan

Written 2026-08-16, end of a long native-app session, for continuation in
Cursor. This is a **plan**, not an implementation — the vision described
tonight (a single Jesse that knows the student across every workflow, with
Gmail/Gcal/Binder boxes showing real content instead of empty states) is
multi-day work. This document exists so that work starts from a clear map
instead of a cold read of the codebase.

## What's real right now vs. what needs building

**Real, working, OAuth-gated (not mocks):**
- `Networking/GmailClient.swift` — real Gmail read/send + Calendar, via
  Google OAuth (`GIDSignIn`). `hasGmailScope`/`hasCalendarScope` gate
  everything; nothing shows until the student actually connects.
- `Networking/DriveClient.swift` — Drive read (`drive.readonly`, scoped to
  a folder named "The Desk") + Drive write (`drive.file`, narrower — only
  sees files this app itself created).
- `Networking/JesseCallSession.swift` — real native STT (`SFSpeechRecognizer`)
  + TTS (Kokoro primary, `AVSpeechSynthesizer` fallback), shared across
  every screen via `.environmentObject`, now with turns persisted
  (UserDefaults, capped at 60) across calls and relaunches (shipped
  tonight).
- `Networking/ArchiveRagClient.swift` — real RAG call Jesse's replies go
  through during a call.

**Likely explanation for "Gmail/Gcal/Binder boxes are empty" tonight:**
these are OAuth-gated. If the test account hasn't gone through
`GmailClient.connectGoogleMailAndCalendar()` on this specific device/build,
the boxes correctly show their empty/"Connect" state — that's the gate
working, not a broken integration. Worth confirming on-device (tap
Connect, go through the Google consent screen) before assuming anything
is broken in code. If it's still empty *after* connecting, that's a real
bug worth a focused debugging session with actual repro steps, not a guess
from here.

**Missing entirely:**
- No summarization endpoint for Jesse calls. `JesseCallSession.end()`
  already returns the full transcript specifically *for the caller to
  summarize/archive* (see its own doc comment) — every current caller
  (Hub, Archive, Resume, Flows) discards that return value. No backend
  route exists to send it to. The `Fireflies → Anthropic → /process-summary`
  pipeline in `webhook/` is for human tutor sessions, not Jesse calls —
  don't reuse it as-is, it's a different data shape and a different trust
  boundary (tutor session content vs. a student's private AI conversation).
- No "central" read access across workflows. Each screen's Jesse call
  passes its own narrow context (`context: "archive"` + `studentWeakness`,
  or nothing at all for Hub/Resume/Flows) into `ArchiveRagClient.ask()`.
  There's no shared "what does Jesse currently know about this student"
  object that every call context pulls from.
- "Oatmeal" (`agent_work/product/desk_os/workflows/book/agent.js`) is a
  **UI style reference only** (MIT-licensed `st-imdev/oatmeal-meeting-notes`,
  adapted for how transcript rows are laid out) — not a summarization
  service. Don't build on top of it expecting AI behavior; it's CSS/markup
  inspiration, nothing more.

## The two "central context" options raised tonight

1. **Read from Binder.** Binder already aggregates a lot (per
   `FieldDeskStore.intelLines`, session filings, connector state). Pro:
   infrastructure partly exists. Con: Binder is UI-shaped (a list of
   strings for display), not a clean data model an LLM prompt can reason
   over — would need a real extraction/summarization layer between
   "what's in Binder" and "what Jesse reads before replying."
2. **Per-student Google Drive folder as the canonical store.** Every
   real event (call transcripts, Gmail digest highlights, calendar
   context, archive book/sim usage, resume drafts) gets written as
   structured files into the student's own "The Desk" Drive folder
   (already the read/write scope `DriveClient.swift` uses). Jesse's
   `ArchiveRagClient.ask()` (or a new shared "ask Jesse" client used
   everywhere) reads from that folder for context before replying.

   This is the more coherent long-term design — it matches the
   product's own "your data stays yours" framing already used in the
   Archive/Resume copy, gives one clear place to reason about what
   Jesse can see, and reuses `DriveClient`'s existing write scope rather
   than inventing a new storage layer. It also composes with the
   archive-mirror pipeline built tonight (`agent_work/product/archive_mirror/`)
   — that pipeline already proved out "pull structured content, land it
   in Drive, use it as an AI source" end to end for Dan McCreary's books;
   the same shape (structured JSON in a Drive folder, read by a RAG
   client) is exactly what a per-student context store needs.

   **Not decided by this document**: exact file schema, how transcripts
   get turned into structured "facts" (that's the missing summarization
   step above), how much history to keep, and who (student vs. app) owns
   deletion. Those need a real design pass, not a guess at 5am.

## Recommended build order (phased, not "build everything now")

**Phase 0 — close the loop that already exists.** Wire every
`jesseCall.end()` call site (Hub, Archive, Resume, Flows) to actually do
something with the returned `[JesseCallTurn]` — at minimum, write it as a
JSON file to the student's Drive folder via `DriveClient`. No
summarization yet, just don't discard real data. This alone makes "past
conversations" durable outside the 60-turn local cache already shipped.

**Phase 1 — summarize on end, not just store raw.** A real backend
endpoint (new `webhook/` route, separate from `/process-summary`) that
takes a `[JesseCallTurn]` array, calls an LLM (Anthropic, matching the
rest of this codebase's pattern) for a short structured summary
(key facts learned, follow-ups, sentiment), and returns it. Native side
writes both raw transcript and summary to Drive. This is also where "AI
summarizes what the user said before replying, visible in the
transcript" (asked for tonight) would hook in — as a visible summary
line inserted into `JesseCallSession.turns` after each user turn, before
Jesse's reply turn.

**Phase 2 — Jesse reads it back.** `ArchiveRagClient.ask()` (or its
replacement) takes an additional "student context" parameter, populated
by reading recent summary files from the student's Drive folder before
the call starts. This is what makes Jesse feel "central" — not a new
call architecture, just richer input to the same call architecture that
already exists and is already shared across every screen.

**Phase 3 — the boxes.** Once Phase 1/2 exist, Gmail/Gcal/Binder boxes
have something to *show*: the Gmail box could surface "Jesse noticed
this in your last 3 emails," Gcal could show "Jesse flagged a conflict
with your study plan," etc. — this only makes sense after there's a real
summarization pipeline to draw from. Building this before Phase 1/2
would mean either fake/hardcoded content or empty boxes with better
CSS, neither of which was actually asked for.

## What NOT to do

- Don't reuse `/process-summary` for Jesse calls — different data shape,
  different trust boundary (a tutor session summary is reviewed content;
  a Jesse call transcript is raw first-person student speech).
- Don't build a new storage layer when `DriveClient`'s existing
  `drive.file` write scope already does per-student, app-created-only
  file storage — that's the right primitive, just not yet wired to call
  transcripts.
- Don't touch `ml/**` or `webhook/**` without coordinating — those are
  Blake's lane per `CLAUDE.md`'s lane-ownership table. A new webhook
  route for call summarization crosses that boundary; flag it before
  building, the same way this session flagged the archive-mirror
  Google Drive question before building past a local pilot.

---

# Level 2 — box mascots, scoped connectors, ambient transcribe

Added 2026-08-16, later the same session, once the direction above got
more specific. **Planning only — nothing below has been implemented.**
This is written for a Cursor agent to execute against; the "explicit
instructions" section near the bottom is the actual work list.

## The core architectural correction

**Not** "each box is its own sub-agent." **One central Jesse**
(`JesseCallSession`, already real, already shared app-wide) is the only
agent a student talks to for the foreseeable future. The five dashboard
boxes — Intel, Moodle, Binder, Email Summaries (Gmail), Gcal — are
**scoped data connectors and stores**, not agents. They don't reason,
don't converse, don't have their own LLM calls. Jesse reads from the
connectors and writes to Binder. That's the whole relationship.

The one deliberate exception, and it's explicitly a **later phase, not
now**: Flows (starting with Presentation) may eventually get their own
specialized sub-agent (e.g. a "Presentation Agent" whose only job is
slide/deck generation), with central Jesse talking *to* that agent
rather than doing the slide work itself — "flows are spaces where two
agents talk." Don't build this yet. Get the one-agent-plus-scoped-
connectors foundation solid first; a second agent only makes sense once
there's a real central Jesse to hand work off *from*.

## Per-connector scope (the "extremely defined scopes" ask)

| Box | Kind | Scope | Status |
|---|---|---|---|
| **Gmail (Email Summaries)** | Connector | `GmailClient` — read inbox, send drafts. Already real, OAuth-gated (`hasGmailScope`). | Built. |
| **Gcal** | Connector | `GmailClient`'s calendar scope — read the week. Already real (`hasCalendarScope`). | Built. |
| **Moodle** | Connector | Read-only: assignments/grades for this student. **No client exists yet** — this is genuinely new work, not a redesign of something real. Don't fake data for it. | Not built. |
| **Intel** | Derived view, not a connector | Read-only over whatever Moodle/Gmail/Gcal/Binder already fetched — no permissions of its own, no independent network calls. Its job is display: summarize what the *other* connectors already pulled. | Partially built (currently reads `FieldDeskStore.intelLines`, a flat string log — see "what changes" below). |
| **Binder** | Store, not a connector | The write-target. Central Jesse (and later, specialized flow-agents) write produced artifacts here — call summaries, resume drafts, book chapters, study plans. "The agent organizes it properly" = auto-categorize/tag on write (by source: call/resume/book/archive), not a manual filing UI. | Data model exists (`FieldDeskStore.items`), auto-organization does not — new work. |

Each connector keeps its scope narrow on purpose: Gmail can send mail,
it can't touch Calendar; Moodle (once built) is read-only, full stop.
Intel and Binder are not connectors at all — conflating "Intel needs
its own permission" with "Intel needs to read what's already been
fetched" was the wrong framing tonight; fix that framing before writing
any code for it.

## Box UI: mascot states

Cursor designs the actual mascot art (explicitly the user's plan, not
this document's job). What this doc defines is the **state machine**
the art needs to support, so mascot design and interaction wiring don't
drift apart:

- **Sleeping** — connector not yet granted permission (Moodle/Gmail/
  Gcal before OAuth) or, for Intel/Binder, genuinely empty (no data
  fetched yet anywhere).
- **Working** — actively syncing (mid-OAuth handshake, mid-fetch).
- **Awake / idle** — connected and has data, nothing in flight.
- *(Open question for the mascot designer, not resolved here: does
  "awake" need a distinct visual per box, e.g. Gmail's mascot looks
  different awake than Gcal's, or is state the only visual axis and
  identity comes from a fixed icon/label alongside the mascot? Pick one
  before drawing all the states, not after.)*

**Interaction model**: tapping the mascot is the connect affordance for
OAuth-gated boxes (Moodle, Gmail, Gcal) — replaces the current plain
"Connect" text button with "tap the sleeping mascot to wake it up."
For Intel/Binder (no OAuth, always available), tapping opens the
existing overlay content (already built tonight — `intelOverlayLayer`,
the redesigned `binderBody`) unchanged; there's no "wake up" step for
those two since there's no permission to grant.

## Fix: dashboard "Transcribe" is ambient recording, not a call

Built tonight as a call trigger (`jesseCall.begin(context: "flows")` +
full `JesseCallSheetView`) — wrong shape. It should record the room and
show a live transcript, full stop — no Jesse spoken reply, no
listen-respond-speak loop. Same STT engine and same transcript *box*
UI, different mode.

Concretely: `JesseCallSession` needs a second entry point alongside
`begin(context:)` — something like `beginAmbientTranscription(context:)`
— that starts `SFSpeechRecognizer` capture and appends turns exactly
like today, but never calls `askJesse()`/`speak()`. `isActive` still
flips true (so the persistent "on the line" pill and turn-persistence
both keep working unmodified), but a new `isAmbient` flag suppresses
the reply loop. `JesseCallSheetView`'s mic/pause/end controls stay
useful as-is for ending an ambient session; only the reply plumbing
changes.

## Fix: storyboards on the call screen

Checked the actual code — `storyboardsRail` in `CreateCanvasView.swift`
is a **slide-thumbnail picker** (tap a title, jump `slideIndex` to it).
It is not "space for people on call" — that read never matched what it
does. Recommend: rename the label from "Storyboards" to "Slides" (the
honest name for what it is), and stop gating it behind `callLive` —
it's useful for navigating a deck whether or not a call is active, so
tie its visibility to `slides.count > 1` instead.

## Meeting transcripts (Gcal-scheduled calls) also feed central Jesse

New ask, reconciles with — doesn't contradict — the "don't reuse
`/process-summary` for Jesse calls" caution above. That caution was
about *writing* Jesse's own call transcripts into the tutor-session
pipeline (wrong data shape, wrong trust boundary). This is about
*reading*: when a real meeting happens (student + tutor/friend, booked
via the existing QCal-invite flow in Manage → Friends) and gets
Fireflies-transcribed through the existing `webhook/` pipeline, that
summary should become *additional context Jesse can read*, alongside
Jesse's own call history — not merged into the same file, just another
source the Phase 2 "Jesse reads it back" context-assembly step pulls
from. This only makes sense after Phase 0-2 above exist; note it here
so whoever builds Phase 2 doesn't scope it to Jesse-only transcripts by
accident.

## Explicit instructions for Cursor (in order)

1. **Scope-table pass first, no UI changes.** Confirm/document exactly
   what each connector can and can't do (table above) as code comments
   at each connector's definition (`GmailClient.swift`, and a new
   `MoodleClient.swift` stub if Moodle work starts). This is cheap and
   prevents scope creep on everything after it.
2. **`JesseCallSession.beginAmbientTranscription()`** — add the mode
   flag and skip-reply-loop behavior described above. Wire the Flows
   dock's "Transcribe" chip (`FieldDeskView.swift`'s `onTranscribe`) to
   call this instead of `begin(context:)`. Build+install+verify on
   device per the pattern in `SESSION_LOG_2026-08-16.md` before
   committing — this touches the shared call session every other
   surface depends on.
3. **Storyboards rename + visibility fix** (small, low-risk, do it
   alongside #2 since it's in the same file).
4. **Mascot state machine wiring** — once art exists, replace the
   plain "Connect" buttons on Moodle/Gmail/Gcal boxes with the
   mascot-tap interaction; Intel/Binder mascots are decorative-only
   (no wake-up step). Don't block this on Moodle actually existing —
   Gmail/Gcal can get their mascots first since those connectors are
   real today.
5. **Moodle connector** — new work, real scope: read-only assignments/
   grades. Needs Moodle API research (auth model, what a student-role
   token can access) before any code — don't guess at an API shape.
6. **Binder auto-organization** — when central Jesse (or, later, a
   flow-agent) writes an artifact to Binder, tag it by source
   automatically (call summary / resume draft / book chapter / archive
   plan) instead of leaving that to manual filing.
7. **Presentation specialized agent** — explicitly last, explicitly a
   separate design pass, not a Cursor "just build it" task. Needs its
   own scoping conversation (what does hand-off from Jesse actually
   look like in the UI/transcript, what's the Presentation Agent's own
   prompt/tooling) before any code.

## Self-check on this plan (done before handing it over)

- Verified `storyboardsRail`'s actual behavior by reading
  `CreateCanvasView.swift` directly rather than guessing from the name
  — confirmed it's a slide picker, not a call-adjacent feature.
- Verified `JesseCallSession.begin()`'s existing structure (`isActive`,
  turn persistence, the pill) is compatible with adding a second entry
  point without restructuring what's already shipped and stable — the
  ambient mode only needs one new bool and one early-return in the
  reply path, not a rewrite.
- Confirmed the "don't reuse /process-summary" guidance from the
  original plan and the new "meeting transcripts should feed Jesse"
  ask aren't actually in conflict once separated into write-path
  (unchanged: Fireflies pipeline keeps owning tutor-session ingestion)
  vs. read-path (new: Jesse's context-assembly step also pulls from
  it) — flagged explicitly above so this doesn't get rebuilt wrong.
- Did **not** verify Moodle's actual API/auth model — flagged as
  needing real research (item 5) rather than assumed, since no Moodle
  client exists anywhere in this codebase to check against.
