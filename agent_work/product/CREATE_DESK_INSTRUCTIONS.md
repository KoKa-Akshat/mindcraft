# The Desk · Create / Work canvas — crystal-clear instructions

**Status:** spec only. Do not invent extra pages. Do not open Flows as a new route.  
**Names:** the agent is **Jesse** everywhere. Never Jack. Never Jill.  
**Voice:** full-duplex conversation. No hold-to-talk. No press-to-talk. Talk like a ChatGPT voice session: you speak, Jesse answers, work happens in the background.  
**Transcription:** the existing Otter-style live transcript (“oatmeal”) is the notes rail.  
**Source of truth for box sizes:** `Presentation Screen.pdf` **page 4** = default desk. **Page 5** = desk after a right-hand tab opens.

Do not touch `FieldDeskView` (Claude’s lane). This spec is for the web Desk / Create canvas (`desk.html` / `agent_work/product/desk_os` / studio Create board).

---

## 0. How the product is supposed to feel

A student on a bus opens The Desk and makes a real presentation, GDoc, or memo with Jesse in the room. The canvas is one iPad page. Things **slide and shrink**. Nothing opens “somewhere below the fold.” Nothing is a new website.

---

## 1. Landing — Jesse’s Kitchen (ramen)

This landing stays.

| Control | What it must do |
|---|---|
| **Desk** | Opens the Work canvas (section 2). Already correct. Keep it. |
| **Call** | Starts a fluent Jesse call on this landing. Keep it. |
| **Open Learning Archive** | Must open the archive workflow (Dan’s books / Jesse archive). Today it does nothing. Wire it. |
| **Create an instance** | Uploads only. Keep that meaning. |
| **Booking** | Keep the booking page. |
| **Workflow market** | Keep the market **card** on this landing. Do **not** send people to a separate workflows site. Clicking a flow later happens **inside** the Work canvas (section 6). |

### Chrome on this landing (fix now)

| Now | Must become |
|---|---|
| Email (e.g. shrutke@…) in a random place | **Top right** |
| Sign out next to email | **Remove from the header.** Sign out lives at the **bottom of this landing**, under Workflow market. |
| Home button | **Remove.** It does nothing. |
| Button next to the email | **Jesse** — returns to Jesse’s Kitchen. |

### Jesse’s Kitchen performance (fix now)

- Going **back to Jesse** must be instant. Do not remount / re-download the 3D ramen world every time.
- Keep the kitchen **warm in memory** (hidden, not destroyed) while the Work canvas is open.
- The ramen scene must stay **interactive** when you return (orbit / click). Today it freezes until you open Projects. That is a bug.

---

## 2. Work canvas — the iPad page (PDF page 4)

Clicking **Desk** opens **one** landscape page. Treat page 4 as a measured layout, not a mood board.

### 2.1 Default tiles (exact positions and sizes)

These five tiles sit on the page at the **page-4 sizes**. If a service is not connected, show the **same tile** with a placeholder sign (empty / “Connect”), never a missing hole.

| Tile | Required | If not connected |
|---|---|---|
| **Intel** | Yes. Compact card. **Not** a wide horizontal strip. Height and width match page 4. | Placeholder sign |
| **Binder** | Yes. Same size as page 4. Clicking Binder **pulls the binder down / open on this page**. It must not stay glued as a dead box. | Placeholder |
| **Email summaries** | Yes. Same size as page 4. | Placeholder |
| **Moodle** | Yes. Same size as page 4. | Placeholder |
| **GCal** | Yes. Same size as page 4. | Placeholder |

**Forbidden:** inventing a new Intel design that is “ugly and too horizontally long.” Match the PDF box.

### 2.2 Bottom dock (replace the current mess)

One **combined toolbar** under the tiles. Not two stacked toolbars. Not a random floating `+`.

**Dock, left → right:**

`Binder` · `Calendar` · `Memo` · `Gmail` · `Flows` · search field (merged into this same bar)

Rules:

- **No plus button** on the canvas.
- Search is **inside** this dock, not a second bar above it.
- Ask / AI is **not** a second competing toolbar on the Work canvas. AI lives in Create (section 3–4) and in the Jesse rail (section 5).
- The whole Work page must be **easy to pan / move**. The student can drag the board. Nothing should open off-screen.

### 2.3 Adding something (PDF page 5)

When the student adds a note, opens a flow, or opens a Create tab:

1. Every page-4 tile **shrinks**.
2. The whole cluster **slides left**.
3. A **right-hand tab / rail** appears in the space that opened.
4. The **same combined dock** stays under the tiles.

This is the only layout transition on the Work canvas. Reuse it for Memo, Flows, and Jesse.

---

## 3. Create · Presentation (PDF slides 1–2, Jack → Jesse)

Click **Presentation** on the Work canvas.

**Do not** spawn a slide deck under the fold. **Do not** only open the keyboard. Open the **Create screen**, centered.

### 3.1 Default Create · Presentation

```
┌─────────────────────────────────────────────────────────────┐
│                         [slide]                             │
│                    large, centered                          │
├───────────────┬─────────────────────────────┬───────────────┤
│  tools /      │     combined AI bar         │  Jesse rail   │
│  add slide    │     voice or type           │  (not Jack)   │
└───────────────┴─────────────────────────────┴───────────────� or type           │  (not Jack)   │
└───────────────┴─────────────────────────────┴───────────────┘
```

- Center = the live slide (slide 1, then + slide).
- Bottom = **one** AI toolbar: type **or** talk. Transcript goes to Jesse as instructions.
- Left = tools to add / change slides (and later: notes). Not “stickers / music / looks.”
- Right = **Jesse call box**. One **Call** button. Fluent back-and-forth. No hold-to-talk.
- Remove the **video placeholder**. That belongs only if we are in a real people-call (section 3.3).

While you talk, Jesse’s words and yours transcribe. The model treats the transcript as **instructions** and edits the slide in the background.

### 3.2 While talking — page-5 shift

When the call is live:

1. The slide **moves left** (same shrink-and-slide as page 5).
2. AI toolbar **stays**.
3. A **notes rail** appears (the Otter / “oatmeal” transcript) capturing the conversation into notes.

### 3.3 Friends on a call

Same Create screen. Students can hop on a call together, transcribe with the same Otter rail, and work the presentation. Video is for **this** case only, not as an empty placeholder on solo create.

---

## 4. Create · GDoc

Click **GDoc**.

Same Create screen pattern as Presentation:

- **Center:** the Google Doc (or our doc surface). Occupies the screen. No mystery scroll-to-nowhere panel.
- **Bottom:** the same combined AI toolbar (voice or type → transcript → instructions).
- **Left / floating utilities:** tools that help the doc (not a video placeholder).
- **Right:** Jesse call box, same as Presentation.
- Live call → doc shifts left → transcript notes rail appears.

If Google is not connected, show the **same layout** with a Connect placeholder in the center. Never open the doc off-canvas.

---

## 5. Memo

Memo on the Work canvas is **mostly fine**. Keep pin-note.

When Memo is opened from the dock, use the **page-5** shift (tiles shrink left, Memo tab on the right). Do not invent a new Memo page.

---

## 6. Flows (workflows) — not a new page

**Flows is a dock item, not a route.**

### 6.1 Click Flows

Do **not** navigate to `/workflows` or a new section.

On the Work canvas, do the **page-5** move:

- Tiles shrink and slide left.
- The **right rail** (the slot that used to show Binder / Calendar / Memo chrome) now lists **workflows**: Resume, Archive, Apply, Book, … whatever is in the market.

### 6.2 Click a workflow (example: Resume)

Still no new page.

1. Keep the page-5 left shift.
2. Open **Jesse’s rail on the right**, same visual language as Presentation slide 1 (the Jesse box).
3. That rail is the workflow.

**Resume, first time:** Jesse starts a fluent call and walks LinkedIn / Drive setup.  
**Resume, returning:** Jesse continues from saved state.  
**Later:** per-workflow layouts will come as screenshots / Figma. Until then, every flow uses this same shell: left = work, right = Jesse.

**Dan / Open Learning Archive flow:** will get its own Figma. Until then, clicking Archive on landing **or** Flows → Archive opens this same right-rail Jesse shell on the Work canvas (not a dead button).

---

## 7. Voice rules (all Create + all Flows)

| Do | Do not |
|---|---|
| One **Call** control | Hold to talk |
| Back-and-forth like ChatGPT voice | Push-to-talk lock |
| Transcript is the instruction stream | Silent “AI is thinking” with no text |
| Work updates while you talk | Block the canvas until the call ends |
| Name the agent **Jesse** | Jack, Jill, “assistant” |

If the model API is not wired yet, still ship the **UI**: Call, live transcript, instruction log. Show a clear “Jesse is listening / Jesse is working” state. Do not fake completed slides.

---

## 8. Bugs that must die (current Work canvas)

These are acceptance tests, not vibes.

1. **Binder** click opens / pulls Binder on this page. It does not sit there dead.
2. **Intel** matches page-4 proportions. Not a long ugly strip.
3. **Ask AI toolbar + the bar above it** become **one** dock (section 2.2).
4. **GDoc** opens the Create screen, centered. Not below the fold. Not unreachable.
5. **Presentation** opens the Create screen, centered. Not “just the keyboard.”
6. **No random plus** floating on the canvas.
7. **No off-screen panels.** If it opened, it is on the iPad page.
8. The Work board is **pannable** so every tile is reachable.
9. **Home** gone. **Sign out** only under Workflow market on the Kitchen landing.
10. **Back to Jesse** is instant and the ramen world stays interactive.

---

## 9. What we are not building in this pass

- Canva-level design tools. A solid slide + doc surface is enough. Prefer a small open-source slide/doc kit over a fake Canva.
- A new marketing page.
- Field Desk iOS (`FieldDeskView`).
- Dan’s full archive Figma (coming next).
- Per-workflow custom interiors beyond the shared Jesse-rail shell (screenshots / Canva / Figma incoming).

---

## 10. Build order (so it can be tested on a device)

1. Kitchen chrome + warm Jesse world (section 1).
2. Work canvas page-4 tiles + one dock (section 2).
3. Page-5 shrink/slide + right rail (section 2.3).
4. Presentation Create screen (section 3).
5. GDoc Create screen (section 4).
6. Flows in the right rail (section 6).
7. Wire Archive button + Resume first-run call.

Ship each step on the Work canvas. Do not add routes.
