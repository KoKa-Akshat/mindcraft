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
