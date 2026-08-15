# Field Desk + Create — structured feedback pass (2026-08-15)

Source: a single long voice-memo transcript from Akshat testing the live iPad build,
plus a 5-page reference PDF (`Presentation Screen.pdf` — stock-photo mockup of a
skincare brand's presentation tool, used purely as an INTERACTION/LAYOUT reference,
not literal content). This doc restructures that transcript into scoped, actionable
items, grounded against the real `ios-prototype/MindCraftNotes/` code where checked.

Each item is tagged:
- **[BUG]** — confirmed broken against real code, ready to fix
- **[VERIFY]** — reported broken, but the code looks like it should already work; check on-device before assuming a rewrite is needed
- **[REDESIGN]** — current behavior works but the shape is wrong; spec below
- **[NEW]** — doesn't exist yet, full spec below
- **[OPEN]** — explicitly deferred by Akshat pending a Figma/Canva mockup he's making next

Read `CLAUDE.md`'s "iOS native app" section before touching `FieldDeskView.swift` —
it documents a real, recurring overlay-blocking bug class (`deskOverlayChromeBlocked`)
that several items below likely intersect with.

---

## 1. Field Desk landing (Jesse's Ramen) — keep, but fix the surrounding chrome

**Confirmed good, don't touch:** landing directly on Jesse's Ramen with the call
button and "The Desk" wordmark visible. This is the right front door.

- **[BUG] "Open Learning Archive" does nothing.** `DeskShellView.swift:579` defines
  it as a static list entry (`id: "open_archive", name: "Open Learning Archive"`)
  inside the Workflow Market sheet, but there's no dispatch case anywhere that
  handles that id when tapped — it's a dead list row. Needs a real tap handler
  (open `dans-archive.html`-equivalent in-app, or the archive's live URL in a
  browser sheet).
- **"Create an instance"** — currently upload-only. Akshat flagged this as
  observed-state, not a complaint. No action unless scope grows later.
- **Booking page** — exists, works, no complaint.
- **Workflow Market** — the picker UI exists (`WorkflowMarketStore`) but selecting
  a workflow doesn't launch a real flow yet ("not wired to the actual workflows").
  This is the same gap Section 7 below specs the fix for.

### Hub nav (top bar on the secondary/instance-hub page, `DeskShellView.swift:368-412`)

Current real layout: `[The Desk wordmark] [call button] ... [name/email] [house icon → Field Desk] [Sign out]`.

- **[VERIFY] House icon "does nothing."** The code already sets
  `fieldDeskRoute = .plain` on tap (`DeskShellView.swift:390-401`), which should
  navigate back to Field Desk. Either this binding isn't actually being observed
  somewhere downstream (real bug), or the icon just isn't legible as "go back to
  Jesse" (a labeling/affordance problem, not a logic bug). Reproduce on-device
  first before rewriting the navigation.
- **[REDESIGN] Move "Sign out" out of the top bar entirely** — relocate it to the
  bottom of the hub page, under the Workflow Market section. It shouldn't share
  visual weight with primary navigation.
- **Email/name block stays top-right** (already correct) — but the button next to
  it should read as "back to Jesse's," not a generic house glyph. Relabel/restyle
  rather than reposition (position is already right).
- **[BUG] Return-to-Jesse transition isn't fluid.** Going from the hub back to
  Field Desk visibly re-instantiates Jesse's Kitchen in the background before it's
  ready, producing a stall. Needs the Kitchen `WKWebView`/world instance kept warm
  (not torn down on navigate-away) so the return trip is instant, not a fresh load.
- **[BUG] After returning to Jesse's Ramen, the 3D scene is inert** — can't
  orbit/interact with it at all unless "projects" is tapped first (which opens the
  desk). Either the scene should be interactive immediately on arrival, or — if
  requiring "projects" first is intentional — that needs to not read as broken
  (e.g. a visible affordance hinting "tap projects to interact").

---

## 2. Binder / desk overlay panel — bugs

- **[BUG] Binder panel doesn't animate closed** — "the binder is not coming down,
  it stays on the screen." Sounds like a missing/broken dismiss transition on the
  Binder `movableCard` (`FieldDeskView.swift:1623` area), not a state bug (the data
  is presumably fine, the close animation isn't firing or isn't visible).
- **[REDESIGN] Intel card proportions are wrong** — "too horizontally long and not
  wide," described as ugly. Needs a real dimension/visual pass, not just a content
  fix. Reference: PDF page 4's Intel tile for target proportions (see Section 6).
- **[REDESIGN] Merge the two stacked toolbars into one.** Currently there's an
  "Ask AI" toolbar and a separate toolbar directly above it. These should combine
  into a single unified bottom toolbar — this same merge applies to the search bar
  too (Section 5) and to the Create screens (Section 3/4). Treat this as one
  toolbar component reused everywhere, not three separate merges.
- **Memo (create/write/pin)** — confirmed working, no complaint. Don't touch.

---

## 3. G-Doc / Presentation creation — currently broken, full redesign spec

### Current bug **[BUG]**
Tapping G-Doc: the screen shifts but the doc panel renders far below the visible
area — unreachable, unscrollable, can't be tapped. Same for Presentation. Both
`.gdoc` and `.slides` already exist as real `movableCard` cases
(`FieldDeskView.swift:1217`, `:1223`) using the same wrapper as the working
Gmail/Calendar/Memo cards — so this is most likely a bad initial-placement
coordinate for these two specific cards (off-viewport spawn position), not a
missing feature. There's also a stray, unexplained "+" button in this state that
reads as confusing UI — audit what it's actually for before deciding to keep it.

### Target redesign **[REDESIGN]**
Tapping G-Doc or Presentation should open the **Create screen** (not a movable
card at all — a dedicated full-screen mode), matching this shape:

- The document/slide is **centered** on screen (full doc for G-Doc; the current
  slide for Presentation).
- **One merged AI toolbar at the bottom** — same unified component as Section 2.
  Accepts either typed text or voice; voice gets transcribed and the AI turns it
  into proper notes/content (reuse the existing auto-transcribing memo pattern
  already shipped — see `reel-field-desk.webp`'s "AUTO TRANSCRIBING" card for the
  pattern already built and working elsewhere in the app).
- Floating utility boxes around the edges for doc-specific tools, OR let the doc
  occupy the full screen if that reads cleaner — Akshat is open on this, use
  judgment once it's built and testable.
- **Remove the video placeholder** from this view — that's specific to the video/
  Create-Studio segment (`CreateInstanceStudioView.swift` territory) and shouldn't
  appear in the doc/slide creation flow.

### Presentation-specific right panel **[REDESIGN]**
Today the Create Studio's right panel (per `reel-create.webp`, already shipped)
shows **Stickers / Music / Looks**. For the Presentation flow specifically, replace
that panel with a **call-Jesse box** — see Section 4, this is the same call UX
spec, just docked in this right panel instead of a separate screen.

### Detailed interaction spec — text entry + live call, side by side **[NEW]**
This is the fullest version of the flow Akshat described, twice, slightly
differently each time — treat this as the target, build toward it in stages:

1. Tap Presentation → a text-entry/keyboard state opens at **center screen**
   ("+ slide" to add new slides).
2. AI panel (bottom, merged toolbar) helps draft content via chat.
3. **The moment a call starts:** the center presentation panel slides/shifts
   **left**, the AI toolbar stays, and a **new box appears to the left of that**
   showing a **live transcription of the conversation**, converted into notes in
   real time (reuse the existing transcribe-to-memo pipeline — this is not new
   infrastructure, it's the same auto-transcribe pattern wired into a new spot).
4. Alternate flow: multiple people can be on the call together (not just
   student+Jesse) working on the same presentation, with the same live
   transcription feeding notes in the background.

Vision framing Akshat gave for this, worth keeping in mind while building:
*"an interface where people can work from their bus, from anywhere they are, to
create sick presentations using AI."* Not Canva-level polish required for v1 —
functional and fluid matters more than visual finish right now. He's open to an
existing open-source base if one fits (slide-editor + real-time transcription),
or building in-house from free-tier building blocks — flag options back to him
rather than picking silently, this is a real build-vs-buy call worth his input.

---

## 4. Call-with-Jesse UX — replaces push-to-talk everywhere in Create

**[REDESIGN]** — this generalizes across G-Doc, Presentation, and any future
Create surface. Current pattern elsewhere in the app (Resume Help, per
`JesseCallSession.swift`) uses **hold-to-talk** ("Hold to talk. Release when
you're done."). Akshat explicitly does NOT want that pattern inside Create:

- **Tap to call, not hold-to-talk.** A single button starts a live, continuous,
  back-and-forth conversation — closer to a live ChatGPT voice session than a
  walkie-talkie.
- Reference shape (PDF pages 1 &amp; 3): a rounded call card with an avatar, a
  waveform/playback scrubber, a text line ("Hi Akshat, Jack here." → should read
  **"Hi Akshat, Jesse here."** in our build — the reference PDF uses a placeholder
  brand, swap the name, keep the layout), and a primary "Jump on a call with
  [Jesse]" button, with "or continue in chat" as the fallback path.
- **While the call is live, the AI executes real edits in the background** — what
  gets said becomes an instruction sent to the background AI, which acts on the
  document/presentation as the conversation happens (add a slide, rewrite a line,
  restyle something) without the student having to stop talking and tap a button.
- **[OPEN]** Akshat flagged he can't currently verify whether his AI API is fully
  wired to actually execute these instructions end-to-end yet — don't assume the
  execution half is done; confirm the real backend hookup before treating "AI
  edits the doc live" as shippable, only the call UI + transcription capture are
  confirmed in scope for this pass.

This is a straightforward reuse of `JesseCallSession`'s existing plumbing
(Kokoro TTS voice, live transcription) — the delta is UX shape (continuous vs.
hold-to-talk) and adding the "AI acts on the document" execution loop, not
building calling infrastructure from scratch.

---

## 5. Left panel reorder + toolbar merge

**[REDESIGN]**
- New order for the desk-tools panel: **Binder, Calendar, Memo, Gmail** (verify
  against whatever the current `projectsToolsPanel` order is —
  `FieldDeskView.swift:1204-1211` currently lists Binder, Intel, Transcribe, Doc,
  Memo, Gmail, Gcal; reconcile the two rather than blindly overwriting, some of
  those extra entries may still need a home).
- Replace the "+" add button with a **Flows** entry point instead.
- The search bar merges into the same unified toolbar from Section 2/3 — one
  toolbar component, not three separate ones scattered across the app.
- **Make this whole panel freely draggable/movable** on screen (same free-
  positioning behavior the other movable cards already have).

---

## 6. Exact layout reference — PDF pages 4 &amp; 5 (pixel/proportion spec)

This is the most literal, least-ambiguous part of the feedback — treat page 4 of
the attached PDF as **ground truth for tile dimensions**, not just a vibe
reference:

- **Page 4**: five tiles at fixed sizes — Intel (small, landscape), Moodle (small,
  landscape, two-up), Binder (large, portrait, dominant), Email Summaries (small,
  landscape), Gcal (small, portrait-ish square). Treat this whole page as
  "how the iPad renders it" — each tile in our real app should match that
  reference's proportions for its equivalent (Intel → Intel, Binder → Binder,
  Gmail digest → "Email Summaries," Gcal → Gcal; Moodle maps to the existing
  Moodle entry inside the Connect widget, not a new top-level card). Anything not
  yet wired to a real integration gets a placeholder sign rather than being
  omitted.
- **Page 5**: same five tiles **plus a new Memo tile** added on the right. Adding
  it causes every existing tile to **shrink and shift left** to make room — a
  responsive reflow, not an overlay-on-top. A single **combined toolbar sits
  underneath everything** once the new tile is added (this is the toolbar-merge
  point again, now with an exact visual reference for where it docks).

Build the desk-tools grid as a reflowing fixed-tile layout matching these two
reference states (baseline 5-tile / expanded 6-tile-with-toolbar), rather than
guessing proportions from scratch.

---

## 7. Workflows ("Flows") panel behavior

**[REDESIGN]**
- Clicking **Flows** should NOT push a new full-screen page. Instead, on the
  right side of the current screen — in the exact same slot the AI panel occupies
  for Presentation (Section 3/4) — it should **swap its content to a workflow
  list** (Resume Builder, etc.) in place of the Binder/Calendar/Memo/Gmail list.
  Same panel, different content mode, not a navigation event.
- Selecting a specific workflow (e.g. **Resume Builder**) triggers the same
  reflow-left pattern as Section 6's tile-add case, and **Jesse's call panel opens
  to the right** (matching Section 4's call card) to walk the student through that
  workflow — e.g., first-time LinkedIn setup for Resume.
- **[OPEN]** Each workflow will need its own tailored right-panel design. Akshat
  is preparing reference images/Figma per workflow, starting with Resume; a more
  involved **Dance workflow** is coming separately with its own Figma. Don't
  design ahead of those references — build the panel-swap mechanism generically
  (Section 7's structural behavior) so each workflow's specific content can slot
  in once its reference arrives, rather than hand-building Resume's specific UI
  as if it were the template for all future workflows.

---

## Suggested build order

1. **[BUG] fixes first** — Open Learning Archive dead link, G-Doc/Presentation
   off-screen spawn position, Binder close animation. These are small, isolated,
   and unblock testing everything else.
2. **[VERIFY]** the house-icon navigation and the Jesse's-Ramen interactivity
   gate on-device before writing any code for either.
3. **Toolbar merge component** (Section 2/3/5) — build once, reuse in all three
   places rather than three one-off merges.
4. **Section 6's tile-reflow layout** — concrete, pixel-referenced, no open
   questions, good candidate to build fully before the fuzzier Create/call work.
5. **Call-with-Jesse tap-to-talk redesign** (Section 4) — UI shape first,
   background-execution loop only once the AI API wiring is confirmed live.
6. **G-Doc/Presentation Create screen** (Section 3) and **Flows panel-swap**
   (Section 7) last — both depend on the toolbar and call components above being
   solid first, and both have real open questions Akshat is still resolving with
   upcoming Figma/Canva references.
