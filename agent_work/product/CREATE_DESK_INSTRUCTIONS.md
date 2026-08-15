# The Desk · Create / Work canvas — crystal-clear instructions

**Status:** spec only. Do not invent extra pages. Do not open Flows as a new route.  
**Names:** the agent is **Jesse** everywhere. Never Jack. Never Jill. (The PDF still says Jack. Replace it.)  
**Voice:** full-duplex conversation. No hold-to-talk. No press-to-talk. Talk like a ChatGPT voice session: you speak, Jesse answers, work happens in the background.  
**Transcription:** the existing Otter-style live transcript (“oatmeal”) is the notes rail.  
**Do not touch** `FieldDeskView` (Claude’s iOS lane). This spec is for the web Desk / Create canvas (`desk.html` / `agent_work/product/desk_os` / studio Create board).

---

## Source of truth

The attached Canva file is in the repo:

| File | What it is |
|---|---|
| `agent_work/product/presentation_screen/Presentation_Screen.pdf` | 5-page landscape Canva, **1440×810**, author Akshat Koirala |
| `agent_work/product/presentation_screen/page-1.png` … `page-5.png` | 2× renders (**2880×1620**). Divide by 2 to get artboard px. |
| `agent_work/product/presentation_screen/MEASUREMENTS.json` | Machine-readable boxes below |

**Which page is which**

| PDF page | Screen |
|---|---|
| **1** | Create · Presentation (Jesse rail idle) |
| **2** | Create · Presentation (call live: Transcription + Storyboards) |
| **3** | Create · GDoc (same chrome as page 1, center labeled GDOC) |
| **4** | **Work canvas default** — five photo tiles + one bottom pill |
| **5** | **Work canvas + right rail** — tiles shrink and slide left; Memo (or Flows / Jesse) appears |

All boxes below are in **1440×810** artboard pixels. Implement as **percentages of the iPad page**, not as a second website.

---

## 0. How the product is supposed to feel

A student on a bus opens The Desk and makes a real presentation, GDoc, or memo with Jesse in the room. The canvas is **one iPad page**. Things **slide and shrink**. Nothing opens “somewhere below the fold.” Nothing is a new website.

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

Clicking **Desk** opens **one** landscape page. White dotted-grid desk. Five photo cards + one bottom pill. Treat page 4 as a **measured layout**, not a mood board.

### 2.1 Default tiles (measured)

Labels sit **above** each card, bold black sans, left-aligned to the card.

If a service is not connected, show the **same box** with a placeholder (“Connect”), never a missing hole.

| Tile | Box (x0,y0)–(x1,y1) | Size | Role |
|---|---|---|---|
| **Binder** (center hero) | (492, 61)–(997, 629) | **505×568** | Tall portrait. Click **opens / pulls the binder down on this page**. Must not sit dead. |
| **Intel** (top left) | (81, 118)–(457, 345) | **376×227** | Compact landscape. **Not** a wide horizontal strip. |
| **Moodle** (bottom left) | (115, 378)–(430, 600) | **315×222** | Landscape under Intel. |
| **Email Summaries** (top right) | (1033, 107)–(1414, 319) | **381×212** | Landscape. |
| **GCal** (bottom right) | (1032, 343)–(1425, 629) | **392×286** | Taller than Email. Bottom aligns with Binder. |

**Forbidden:** inventing a new Intel design that is “ugly and too horizontally long.” Match **376×227**.

Rounded corners + light drop shadow, like physical cards on a desk.

### 2.2 Bottom dock — one pill, two fillings

Every PDF page draws the **same charcoal pill**. Use that **size and position** everywhere:

| | Box | Size |
|---|---|---|
| Combined dock | (96, 632)–(1417, 728) | **1321×96** |

**Do not ship two bars.** No floating `+`. No second Ask bar above this pill.

**What goes inside the pill depends on the screen:**

| Screen | Fill the pill with |
|---|---|
| **Work canvas** (pages 4–5) | `Binder` · `Calendar` · `Memo` · `Gmail` · `Flows` · search field. The PDF still shows “Ask AI” here because Canva reused the Create dock. **Do not copy that.** AI does not live on the Work canvas. |
| **Create** (pages 1–3) | paperclip · `Ask AI…` text field · mic · waveform. Voice or type. Transcript = instructions to Jesse. |

Rules:

- Search is **inside** the Work dock, not a second bar above it.
- The whole Work page must be **easy to pan / move**. The student can drag the board. Nothing should open off-screen.

### 2.3 Adding something (PDF page 5) — the only transition

When the student opens Memo, Flows, or Jesse from the Work dock:

1. Every page-4 tile **shrinks to ~85%**.
2. The whole cluster **slides left**.
3. A **~200 px right rail** opens.
4. The **same dock pill** stays at the bottom.

Measured page-5 boxes:

| Tile | Box | Size | vs page 4 |
|---|---|---|---|
| Binder | (425, 54)–(853, 578) | **428×524** | ~85% wide, shifted left |
| Intel | (76, 103)–(395, 295) | **319×192** | ~85% |
| Moodle | (106, 323)–(373, 511) | **267×188** | ~85% |
| Email Summaries | (884, 93)–(1206, 273) | **322×180** | ~85% |
| GCal | (884, 295)–(1216, 620) | **332×325** | shifted into the new column |
| **Memo (right rail)** | (1231, 193)–(1429, 387) | **199×194** | new |
| Dock | same as page 4 | **1321×96** | does not move |

Reuse this transition for Memo, Flows, and Jesse. Do not invent a second motion.

---

## 3. Create · Presentation (PDF pages 1–2)

Click **Presentation** on the Work canvas.

**Do not** spawn a slide deck under the fold. **Do not** only open the keyboard. Open the **Create screen**, centered on the iPad page.

### 3.1 Default / Jesse rail idle (page 1)

| Piece | Box | Size |
|---|---|---|
| **Slide** (left) | (96, 53)–(936, 546) | **840×493** |
| **Jesse rail** (right) | (988, 53)–(1364, 597) | **376×544** |
| **Phone FAB** (top left) | (0, 8)–(63, 70) | **~63×62** |
| **Create dock** | (96, 632)–(1417, 728) | **1321×96** |

Jesse rail contents (PDF says Jack — use **Jesse**):

- Face icon
- Voice bubble / last clip
- Chat: “Hi Akshat, Jesse here.”
- Black pill: **Jump on a call with Jesse**
- Small text: **or continue in chat**

Center = the live slide (slide 1, then + slide).  
Left tools (when we add them) = add / change slides. **Not** stickers / music / looks.  
Remove the **empty video placeholder** on solo create. Video is only for friends-on-a-call (section 3.3).

While you talk, Jesse’s words and yours transcribe. The model treats the transcript as **instructions** and edits the slide in the background.

### 3.2 Call live (page 2)

The slide stays. Two rails replace the idle Jesse box:

| Piece | Box | Size |
|---|---|---|
| **Slide** | (30, 74)–(870, 567) | **840×493** |
| **Transcription** (center) | (898, 103)–(1198, 555) | **~300×452** |
| **Storyboards** (right) | (1225, 74)–(1421, 555) | **~196×481** |
| Create dock | same pill | **1321×96** |

Transcription = the Otter / “oatmeal” notes rail.  
Storyboards = vertical thumbs of slide frames.

### 3.3 Friends on a call

Same Create screen. Students can hop on a call together, transcribe with the same Otter rail, and work the presentation. Video is for **this** case only.

---

## 4. Create · GDoc (PDF page 3)

Click **GDoc**. Same chrome as page 1. The center card is labeled **GDOC**.

| Piece | Box | Size |
|---|---|---|
| **Doc** (left) | (96, 53)–(936, 546) | **840×493** |
| **Jesse rail** (right) | (988, 53)–(1364, 597) | **376×544** |
| Phone FAB | same as page 1 | **~63×62** |
| Create dock | same pill | **1321×96** |

The doc must be **on the canvas**, not under the fold.  
If Google is not connected, show the **same layout** with a Connect placeholder in the center.

Live call → same page-2 shift: doc stays left, transcript notes rail appears.

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
- The **right rail** now lists **workflows**: Resume, Archive, Apply, Book, … whatever is in the market.

### 6.2 Click a workflow (example: Resume)

Still no new page.

1. Keep the page-5 left shift.
2. Open **Jesse’s rail on the right**, same visual language as Presentation page 1.
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

## 8. Bugs that must die (acceptance tests)

1. **Binder** click opens / pulls Binder on this page. It does not sit there dead.
2. **Intel** is **376×227**, not a long ugly strip.
3. **Ask AI toolbar + the bar above it** become **one** dock pill (section 2.2).
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
