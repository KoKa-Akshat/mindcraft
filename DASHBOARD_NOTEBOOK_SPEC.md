# The Field Journal
## MindCraft dashboard design specification — v1.0

---

## 1. The Core Concept

The dashboard is a **field journal** — the working notebook of someone in the middle of becoming good at something. Not a diary (too soft), not a planner (too corporate), not a sketchbook (too loose). A field journal is what an explorer, a naturalist, a mathematician-in-progress carries: dated entries, a folded map tucked inside, letters tipped between pages, margin notes from a mentor, and a growing record that proves — in the student's own accumulated pages — that the work happened and the territory is being claimed.

Experientially: the student arrives at a dark desk (Deep Field — the brand canvas is now the *desk surface and the cover*, which is the creative unlock). On the desk sits a closed, near-black notebook with a lime elastic band and a red ribbon peeking from the fore-edge. It opens — with weight, not bounce — to today's spread. The pages are warm ivory. The light changes. The student is no longer looking at software; they are inside their own record. Everything they do in MindCraft becomes an artifact here: a practice session becomes a dated entry, a Katha story becomes a letter folded into the binding, mastery becomes a highlighter stroke and a letterpress stamp, the knowledge graph becomes a star chart folded into the back cover.

The emotional job: Maya — the student who gave up — has never had evidence that she is the kind of person who is good at math. A journal is evidence by construction. Every page filled is a page she filled. The journal never cheers, never condescends, never says "great job!!" — it simply keeps the record with the seriousness of a beautiful object, and the record keeps getting longer. That *is* the click, delivered structurally.

---

## 2. Layout Architecture

### 2.1 The closed notebook (landing state)

Shown on first arrival per session (skipped on subsequent same-session navigations back to `/dashboard` — the notebook stays open).

- **Full viewport:** Deep Field `#080e14` with an extremely subtle radial vignette (`radial-gradient(ellipse at 50% 35%, #0c141c 0%, #080e14 70%)`) — the desk under a single lamp.
- **The notebook:** centered, `min(520px, 82vw)` wide, 4:5.4 aspect ratio, perspective-tilted 4° (`transform: rotateX(4deg)`). Cover color `#0b1119` (one step lighter than the desk so it reads as an object), 2px radius corners, and a debossed wordmark: "MindCraft" set in the geometric grotesque, `color: #10181f`, with `text-shadow: 0 1px 0 rgba(255,255,255,0.04), 0 -1px 0 rgba(0,0,0,0.6)` — blind-embossed, legible only by light.
- **The elastic band:** an 8px vertical strip of The Click `#c4f547` running the full height at 78% width position, with `box-shadow: 0 1px 2px rgba(0,0,0,0.5)`. This is the screen's single lime instance.
- **The ribbon:** 14px of Stakes `#c1121f` peeking 22px out of the bottom fore-edge, slightly angled (`rotate(3deg)`).
- **Below the notebook:** one line of chalk text, sentence case, geometric sans 14px, `#f5f5f5` at 64% opacity: "Entry 47 · last written Tuesday" — the student's own page count as the greeting. If it's a first-time student: "Entry 1 · unwritten".
- **Interaction:** click anywhere on the notebook, or press Enter, to open. Cursor over the notebook is `cursor: pointer` with the cover lifting 2px (`translateY(-2px)`, 200ms) — the only hover behavior. No pulsing, no glow.

### 2.2 The open spread (desktop, ≥1024px)

The open notebook occupies `min(1240px, 94vw)`, centered, resting on the Deep Field desk which remains visible as a 40–80px frame around the spread. A center gutter — 24px wide, `linear-gradient(90deg, rgba(8,14,20,0) 0%, rgba(8,14,20,0.18) 45%, rgba(8,14,20,0.28) 50%, rgba(8,14,20,0.18) 55%, rgba(8,14,20,0) 100%)` — is the binding shadow. Stitching: five 3px × 10px thread marks in `#1d3a8a` at 30% opacity spaced down the gutter.

**Left page — the record (retrospective).** What has been written:
1. **The running header:** "The record" in small caps-free grotesque 13px, pencil ink, top-left; page number bottom-left ("46").
2. **Recent entries list** — the last 5–7 practice sessions and tutor sessions rendered as dated journal lines (see feature 5.5), pulled from Firestore sessions + practice history.
3. **Pages filled** — the progress artifact (feature 5.8): a fore-edge visualization of how thick the "written" portion of the journal has become.
4. **The dispatch slot** — if a new Katha dispatch exists, its folded letter sits tipped into the lower-left corner of this page (see §7).

**Right page — today (prospective).** What is about to be written:
1. **The dateline:** today's date, oversized (see typography), with a faint pre-ruled entry below it.
2. **Today's spread = the PawHub replacement** (see §6): "The gap" and "New territory," written as the journal's own draft of today's plan.
3. **The index lines** at the page bottom: quiet single-line links — "Problem solver," "Session notes," "The map" — set like a book's own cross-references ("see the map, back pocket →").

**Chrome (on the Deep Field frame, not on paper):**
- Top-left of the desk: the MindCraft wordmark, chalk, 14px.
- Top-right: avatar + sign out, chalk at 64%.
- The existing `AppTabBar` destinations (Dashboard | Practice | Problem solver | Knowledge map) become the **section tabs** on the notebook's right fore-edge (feature 5.3) — they are part of the object, not a floating pill bar.

### 2.3 Mobile (<1024px)

Single page, full-bleed paper (see §9 for the full spec). The binding moves to the left edge as a 12px gutter shadow; the desk frame collapses to a 16px Deep Field strip at top (status/chrome) only. Left page and right page become two swipeable pages: swipe left from "today" to reach "the record." Section tabs become a fore-edge strip pinned to the right screen edge.

### 2.4 Where PawHub lives

PawHub *is* the right page. It stops being a launcher component floating on a dashboard and becomes "today's entry, pre-drafted" — the journal has already written today's two candidate headings (challenge and explore) in faint pencil, and the student commits to one by tapping it, which "inks" it and turns the page into the session. Full spec in §6. The paw shape is retired; the name survives internally in code.

---

## 3. The Paper System

The resolution, stated as doctrine: **Deep Field is the world; paper is the interior.** The desk, the cover, the binding, the chrome, the foldout map — Deep Field. The pages — warm ivory. The student isn't looking at a light-mode app; they're inside a dark-world object that happens to have paper in it. Cinema outside, intimacy inside.

### 3.1 Paper tones (exact values)

| Token | Value | Use |
|---|---|---|
| `--paper-base` | `#f7f3ee` | Default page ground |
| `--paper-raised` | `#fbf8f3` | The current/active sheet (today's page sits one sheet "above") |
| `--paper-recessed` | `#efe9e0` | Older entries, the left page, disabled areas |
| `--paper-edge` | `#e6ddd0` | Page-edge stack, deckle, fore-edge strips |
| `--paper-onion` | `#fdfcf9` at 92% opacity | Katha's letter stock (tipped-in dispatch) |

**Grain:** every paper surface carries a tiled noise texture — a 128×128 PNG of monochrome noise at **3% opacity**, `background-blend-mode: multiply`, `background-size: 128px`. Implement as a single `::before` overlay per page so it never multiplies on nested elements. No paper surface ships flat; the grain is what makes `#f7f3ee` read as paper instead of "beige mode."

**Page depth:** the open spread shows a stacked-sheet edge on the outer sides: three 1px lines offset 2px/4px/6px in `--paper-edge`, `--paper-recessed`, `--paper-edge` — the suggestion of the pages beneath, done with `box-shadow: 2px 0 0 #e6ddd0, 4px 0 0 #efe9e0, 6px 0 0 #e6ddd0` on the right page (mirrored on the left).

### 3.2 Rules and margins

- **Rule lines:** `1px solid rgba(29,58,138,0.10)` — Depth navy at 10%, the classic feint-blue notebook rule, on-brand. Line pitch **32px** (matches the body line-height so text sits *on* the rules, non-negotiable — misaligned rules kill the illusion). Rules render only in entry areas, not under headings or the dateline.
- **The margin rule:** a single vertical line at **72px** from the page's inner edge, `1px solid rgba(193,18,31,0.28)` — Stakes red at 28%. This is deliberate brand theater: *the stakes live in the margin.* The margin column is where the agent writes, where gap flags sit, where tension is annotated. Red never marks a student's answer — it marks the margin, the territory of what's at risk.
- **Margin column ground:** transparent (same paper), but agent notes inside it use pencil ink (below) so the column reads quieter than the body.

### 3.3 Shadow, not glow

Paper has shadow. Nothing in the notebook glows.

- `--shadow-page`: `0 1px 2px rgba(8,14,20,0.10), 0 6px 24px rgba(8,14,20,0.18)` — the open notebook on the desk.
- `--shadow-tip-in`: `0 1px 3px rgba(8,14,20,0.22), 0 2px 1px -1px rgba(8,14,20,0.12)` — letters, cards, anything resting *on* a page.
- `--shadow-lift`: `0 4px 10px rgba(8,14,20,0.24)` — the transient state while something is being picked up (drag, page mid-turn).
- Inner gutter shadow as specified in §2.2.

### 3.4 The Click on paper

`#c4f547` on ivory fails contrast as text. The lime is therefore never ink — it is a **highlighter** and a **physical accent** (the elastic band, one tab). On paper it appears exclusively as a highlighter stroke: `background: linear-gradient(104deg, transparent 2%, rgba(196,245,71,0.55) 4%, rgba(196,245,71,0.42) 96%, transparent 98%)`, applied to an inline span, with `border-radius: 2px` and 2px vertical bleed beyond the text box. Slightly angled gradient = the human wobble of a real highlighter. **One stroke per screen**, and it always marks mastery or the single most important thing (rule preserved from the brand book, translated into notebook language).

---

## 4. Typography System

Two voices, one accent, per the brand: the engine speaks geometric sans; Katha speaks editorial serif. The notebook adds a third register — the "written" layer — without a handwriting font.

### 4.1 Faces

- **Display / engine voice:** a geometric grotesque — *Space Grotesk* (web-available; upgrade to *Founders Grotesk* or *Neue Haas Grotesk Display* if budget allows). Used for concept names, datelines, chapter headings, numbers. Weight 500–700. Tracking tightens as size grows: `-0.01em` at 32px, `-0.03em` at 72px+.
- **Body / UI voice:** a clean humanist sans — *Inter* at weights 400/500, `font-feature-settings: "ss01", "cv05"` for the humanist alternates. All UI copy, entry text, labels.
- **Katha / editorial serif:** *Tiempos Text* (fallback: *Source Serif 4*). Dispatches, story excerpts, chapter epigraphs. Katha's italic is the emotional register.
- **The stamp voice:** *IBM Plex Mono* 400, used *only* for dates-as-stamps and page numbers — the typewriter/date-stamp artifact of a field journal. Never for body copy.

### 4.2 The "written" accent layer (no handwriting fonts — ever)

The personal, hand-touched quality is produced by **behavior, not letterforms**:

1. **Pencil ink:** written-layer text uses `--ink-pencil` (`#6f6a61`) instead of full black — graphite, not ink.
2. **The tilt:** written-layer blocks carry `transform: rotate(-0.4deg)` (agent notes) or `rotate(0.3deg)` (student notes) — one consistent value per speaker, never randomized per line (randomness reads as gimmick; consistency reads as a hand).
3. **Serif italic as script:** anything "written by a person" is set in Tiempos *italic*, 15px, pencil ink. Editorial italic + graphite + tilt = handwritten *feeling* at design-bookstore quality.
4. **Imperfect underlines:** emphasis in the written layer uses an inline SVG stroke — a 2px path with two gentle control-point deviations (±1.5px) — in place of `text-decoration`. One reusable SVG, `currentColor`.
5. **Ruled alignment:** written text always sits on the 32px rules. Print voice (grotesque headings) is allowed to break the rules; the written voice never is.

### 4.3 Size scale

| Token | Size / line-height | Use |
|---|---|---|
| `--type-micro` | 11px / 16px | Page numbers, stamp captions (mono) |
| `--type-small` | 13px / 20px | Margin notes, index lines, metadata |
| `--type-base` | 16px / 32px | Body — **line-height locked to rule pitch** |
| `--type-lead` | 19px / 32px | Katha body, entry first lines |
| `--type-heading` | 28px / 34px | Entry headings, section titles |
| `--type-display` | 48px / 52px | Concept names, "The gap" heading |
| `--type-mega` | clamp(72px, 9vw, 120px) / 0.95 | The dateline, chapter openers, mastery stamps |

The dateline on today's page is the flagship: "July 2" set at `--type-mega` in the grotesque, ink `--ink-system`, with the year and day-of-week in mono 11px stacked beside it — a film title card made of a date.

---

## 5. Signature Features

**5.1 The ribbon**
*One red ribbon marks where you left off; pulling it opens that page.* The Stakes-red ribbon (`#c1121f`, 14px wide) lies across the right page's bottom corner, ending in a clean 45° cut, with `--shadow-tip-in`. It's labeled in mono 11px chalk-on-red: "linear equations · L2 · Tuesday". Click: the ribbon pulls taut (`translateX 8px`, 150ms), then the page turns directly into that resumed session — resuming `practiceDrafts` without visiting the practice picker. The ribbon is the single fastest path back into work, and it's the object your eye finds first because red-on-ivory is the loudest thing on the spread.

**5.2 Margin notes from the agent**
*The engine's observations appear as penciled annotations in the red-ruled margin.* Each note is ≤ 12 words, Tiempos italic 13px, `--ink-pencil`, tilted −0.4°, sitting in the 72px margin column aligned to the entry it annotates: *"third session where fractions slowed you — see p. 12,"* with a thin pencil line hooking to the relevant entry line. Notes fade in with a 240ms top-down wipe when the page settles, staggered 80ms apart, max three per page. Content sources: `/recommend` bridge gaps, decay warnings, displacement direction — the engine's real signals, phrased as a mentor's marginalia, never as system alerts. Banned phrasing enforced here: no "try again" — every note points at *what to see differently*.

**5.3 Section tabs**
*Notebook divider tabs on the fore-edge replace the pill nav.* Five tabs protrude 14px from the right page edge, each 64px tall, 2px radius on the outer corners, labeled vertically in grotesque 11px: **Today · Record · Map · Dispatches · Index**. Each tab is dyed with its section's cluster tone at 20% over `--paper-edge`; the *active* tab extends 6px further and sits at full paper brightness with `--shadow-tip-in`. Clicking a tab triggers a page-turn (§12) to that section's spread. On the Map tab only, the dye is Deep Field itself — a dark tab, foreshadowing the dark foldout inside (§8).

**5.4 The daily entry structure**
*Every day the journal pre-rules a fresh entry whether or not the student shows up.* Today's page always opens with the mega dateline, then faint 32px rules, then the pre-drafted plan (§6). Days the student worked, the entry is inked; days they didn't, the page shows the dateline and empty rules — and stays in the record that way. No guilt copy, no broken-streak flame, no red: just an unwritten page, which is the most honest and most motivating streak mechanic ever shipped, because Maya can *see* the blank pages and see that they simply have nothing on them.

**5.5 Entry lines (sessions as ledger entries)**
*Each practice or tutor session renders as one dated written line in the record.* Format: mono date stamp ("JUN 30") in `--ink-pencil` · grotesque concept name 16px in `--ink-system` · a written-layer fragment in serif italic ("held under pressure at level 2 — 9 of 12") · and, if the session produced mastery movement, a short horizontal graphite gauge — a hand-ruled double line whose fill is cross-hatching (`repeating-linear-gradient(45deg, #6f6a61 0 1px, transparent 1px 4px)`) rather than a progress bar. Hover lifts the line 1px and reveals its margin note. Click opens the full session page.

**5.6 The dispatch (Katha's letter) — tipped in**
*Story content arrives as a physical letter tucked between the pages.* Full spec §7. On the record page it appears folded: an onion-skin rectangle (`--paper-onion`) at a 2° tilt with one visible fold crease (a 1px line of `rgba(8,14,20,0.08)` with a 6px soft highlight above it) and a small Stakes-red thread stitched through its corner. Unread state: the thread visible; read state: thread removed, letter filed flatter (tilt 0.5°).

**5.7 The mastery stamp and the stroke**
*Mastery is marked the way a field journal marks a confirmed finding: highlighted, then stamped.* When a concept crosses its mastery threshold, its name wherever it appears on the current page receives the screen's single highlighter stroke (§3.4), and a letterpress stamp appears beside the entry: the concept's cluster glyph inside a 44px circle, *debossed* (`box-shadow: inset 0 2px 3px rgba(8,14,20,0.25), inset 0 -1px 0 rgba(255,255,255,0.7)`), ink `--ink-depth` at 70%, with the date in mono 11px curved along the bottom arc. No confetti. No modal. The animation (§12.4) is the entire celebration: pressure, not party. Stamps accumulate in the Index section as a stamp sheet — the trophy case, disguised as philately.

**5.8 Pages filled (progress as thickness)**
*Overall progress is the physical thickness of the written portion of the journal.* Bottom of the left page: a side-view of the closed book drawn as stacked 2px lines — written pages in `--ink-system` at 12% opacity, unwritten in `--paper-edge` — with the ribbon drawn at the current position. Caption in mono: "47 of 120 pages · act track". The 120 derives from the ACT path length (concepts × levels on the exam track from `/exam-concepts/act`). Not a percent, not a ring, not a bar: it is *how much book you've written*, and it makes the remaining pages feel finite and claimable.

**5.9 The scratch margin (annotation input)**
*During practice, the page's margin is writable.* A "notes to self" affordance: clicking the margin next to a question opens a 240px-wide writing area on the rules — student ink `--ink-student`, serif italic, tilted +0.3°, saved to the entry and resurfaced by the agent's margin notes later ("you wrote 'flip the sign??' here on June 12 — you don't need the question marks anymore"). This closes a loop no edtech product closes: the student's own confusion, quoted back at the moment it's resolved.

**5.10 The elastic closure (sign-out)**
*Leaving snaps the band back over the cover.* Sign-out or extended idle triggers the close animation (§12): pages settle, cover falls, the lime band slides across, and the desk line updates: "Entry 47 · today". The session ends with the object made whole — an exhale, not a logout.

---

## 6. The PawHub Redesign — Today's Page

The launcher is rewritten as **the journal drafting today's entry for you**. The engine (via `worstWeakness()` and the exam-mode learn-next signal — the existing `/recommend` plumbing is untouched) produces two candidate headings, and the page presents them as a plan written in pencil, waiting to be inked.

**Layout (right page, under the mega dateline):**

```
July 2                                    [mega dateline]
wednesday · entry 47                      [mono, pencil]

————————————————————————————————————————  [rules begin]

The gap                                   [display 48px, grotesque]
Systems of linear equations               [heading 28px, ink-system]
    Two sessions stalled at substitution. [serif italic, pencil, on rules]
    The margin says this is the one.
    ▸ open a session · level 2           [16px, ink-depth]

New territory                             [display 48px, grotesque]
Circles                                   [heading 28px]
    Unwritten. First lines are the       [serif italic, pencil]
    easiest to write.
    ▸ begin at level 1

— — — — — — — — — — — — — — — — — —      [pencil divider]
see also: problem solver · session notes · the map (back pocket →)
```

**The gap** carries a small Stakes-red margin flag: a 20px × 12px red tab clipped into the margin rule beside its heading — the *only* red on the page besides the margin rule and ribbon, and it marks the stakes of the material, never the student. Severity from C1 drives which candidate gets the flag.

**Interaction:** the two blocks are not cards — no border, no background, no radius. They are *text on the page*; the hover state inks them (pencil `#6f6a61` → system ink `#1c1a17`, 180ms, plus the ▸ line gaining an imperfect underline). Click = commit: the chosen heading gets struck through by a fast pencil line left-to-right (240ms) — the field-journal gesture for "doing this now" — and the page turns into the session (`launchMissionDirect()`, level from `bridgePractice.getRecommendedLevel` exactly as today). The unchosen block remains penciled on the page and appears in the record as an unwritten intention.

GPS/Notes/Problem solver demote to the "see also" index line — they are references, not peers of the day's work.

---

## 7. The Story Splash (Katha) — The Tipped-in Letter

Katha does not overlay. Katha **arrives in the mail.**

**Object:** a letter on onion-skin stock (`--paper-onion`, subtly translucent — the page rules ghost through at 4% where it overlaps them), 380px wide unfolded on desktop, with one horizontal fold crease across the middle. Corner-stitched with a short red thread (two 2px `#c1121f` stitches). No envelope, no wax seal; the thread is the seal.

**Typography:** entirely Katha's voice — Tiempos. A one-line epigraph in italic 19px at top, body in roman 16px on 32px leading, and the signature: "— K." set 24px italic with 8px extra tracking. No UI elements on the letter except a final line in mono 11px pencil: "read before entry 47" — the only instruction, and it's an invitation, not a gate.

**Transition in:** triggered before a story-bearing session. The current spread dims 8% (`filter: brightness(0.92)`, 300ms), the letter slides out from the gutter (`translateX` from center, −20px → 0, `rotate −6° → −2°`, 450ms, `cubic-bezier(0.2, 0, 0, 1)`), then unfolds in **two moves**: top half rotates open around the crease (`rotateX 80° → 0°` with a moving crease shadow, 350ms), settle 100ms. Total ≤ 900ms.

**Transition out:** "fold and begin ▸" at the letter's foot (grotesque 14px — the engine voice takes over exactly at the boundary of story and work). The letter refolds (one move, 300ms), slips *into the gutter* (not off-screen — into the binding, where the Dispatches tab will hold it forever), and the page turn into the session begins before the letter fully disappears — an 80ms overlap that stitches story to work.

Past dispatches live under the **Dispatches** tab as a correspondence file: letters filed at slight alternating tilts, each openable.

---

## 8. The Knowledge Map — The Dark Foldout

The move: everything in the journal is paper — **except the map, which is a piece of the night folded into the back pocket.** The existing constellation aesthetic is not discarded; it is *bound in*.

- **Access:** the Map tab (the one dark tab, §5.3) or "the map (back pocket →)" index line. The transition is an **unfolding**: a Deep Field sheet expands from the right page in two hinge moves (half → full, 300ms + 300ms, crease shadows sweeping), growing past the notebook's edges to near-full viewport. The paper world remains visible as a 24px ivory border around the chart — you are holding the foldout over the open book.
- **The chart:** the constellation on `#080e14`, but redrawn as plotted points — 6px chalk circles with mono 11px labels — connected by prerequisite edges drawn as thin chalk dashes (`stroke-dasharray: 2 4`, `rgba(245,245,245,0.35)`); bridges as solid hairlines in Depth `#1d3a8a` at 60%. Untouched nodes (`eventCount === 0`) are *unplotted*: label only, no circle, 30% opacity. Mastered nodes are circled twice (two slightly offset SVG circles). The current worst gap (`isBridgeGap`/severity) is marked with a red survey flag glyph and a chalk annotation in serif italic: *"the crossing that keeps failing."* The screen's one lime instance: a single `#c4f547` dot with a 1px chalk ring at the student's mastery-centroid position.
- **Chart furniture:** a corner compass rose built from the 4 PCA axes with real labels ("applied ↔ symbolic", "calculus ↔ statistical") in mono 11px chalk 40% — the embedding space, presented as cartography. Fold creases stay faintly visible across the dark sheet (two 1px lines, `rgba(245,245,245,0.05)`).
- **Refolding:** click the ivory border or the "fold" affordance at the chart corner; the sheet folds back in reverse into the page pocket.

---

## 9. Mobile Adaptation

- **One page, full attention.** Paper goes full-bleed; the Deep Field desk survives as a 16px top strip holding the wordmark and avatar. Binding: a 12px inner shadow gradient on the left edge.
- **Navigation = page turning.** Horizontal swipe moves between section pages in fixed order: Record ← **Today** → Dispatches. The page-turn animation runs on swipe with direct manipulation — the page tracks the finger, commits past 30% travel.
- **Tabs become a fore-edge strip** pinned to the right screen edge: a 20px-wide strip showing the five tab dyes as stacked color slivers; tap opens a one-thumb tab drawer (the strip slides out 96px revealing labels, 250ms).
- **The ribbon** becomes a bottom-anchored pull: the red ribbon tail hangs 28px into view at bottom-right; pull up ≥ 48px to resume the last session (with a haptic tick at the commit threshold).
- **The dateline** drops to `clamp(56px, 16vw, 72px)`. The gap/territory blocks stack with 48px separation. Margin notes move to interstitial full-width pencil lines between entries (the 72px margin column is suppressed below 720px; the red margin rule remains at 20px as pure brand signature).
- **The map foldout** opens full-screen dark with pinch-zoom/pan; the ivory border shrinks to 8px.
- **The closed-cover landing is skipped on mobile** — cold opens go straight to Today.

---

## 10. CSS Design Tokens

```css
:root {
  /* ---------- world / chrome ---------- */
  --cover: #080e14;            /* Deep Field — desk, cover, chrome */
  --cover-object: #0b1119;     /* the notebook cover as object */
  --cover-emboss: #10181f;     /* debossed wordmark */
  --chalk: #f5f5f5;            /* text on Deep Field only */
  --chalk-dim: rgba(245, 245, 245, 0.64);

  /* ---------- paper ---------- */
  --paper-base: #f7f3ee;
  --paper-raised: #fbf8f3;
  --paper-recessed: #efe9e0;
  --paper-edge: #e6ddd0;
  --paper-onion: rgba(253, 252, 249, 0.92);
  --paper-grain-opacity: 0.03;         /* noise tile, multiply */

  /* ---------- rules & margins ---------- */
  --rule: rgba(29, 58, 138, 0.10);     /* feint blue, Depth-derived */
  --rule-pitch: 32px;                  /* == body line-height. locked. */
  --margin-rule: rgba(193, 18, 31, 0.28);
  --margin-width: 72px;

  /* ---------- inks (speakers) ---------- */
  --ink-system: #1c1a17;       /* engine voice — warm near-black */
  --ink-katha: #232f4e;        /* iron-gall blue-black, Depth-derived */
  --ink-student: #3a3733;      /* graphite-dark, the student's pen */
  --ink-pencil: #6f6a61;       /* agent margin notes, pre-drafts */
  --ink-depth: #1d3a8a;        /* structural accents, links, stamps */
  --ink-faded: #a39b8e;        /* metadata, disabled */

  /* ---------- the click & the stakes ---------- */
  --click: #c4f547;
  --click-highlighter: rgba(196, 245, 71, 0.48);
  --stakes: #c1121f;

  /* ---------- tab dyes (concept clusters) ---------- */
  --tab-algebra: #d9c8a8;      /* ochre */
  --tab-geometry: #b9c4ce;     /* slate */
  --tab-functions: #c3cdb4;    /* sage */
  --tab-data: #d4bcb4;         /* clay */
  --tab-map: #080e14;          /* the dark tab */

  /* ---------- shadow (never glow) ---------- */
  --shadow-page: 0 1px 2px rgba(8,14,20,0.10), 0 6px 24px rgba(8,14,20,0.18);
  --shadow-tip-in: 0 1px 3px rgba(8,14,20,0.22), 0 2px 1px -1px rgba(8,14,20,0.12);
  --shadow-lift: 0 4px 10px rgba(8,14,20,0.24);
  --shadow-deboss: inset 0 2px 3px rgba(8,14,20,0.25), inset 0 -1px 0 rgba(255,255,255,0.7);
  --gutter-shade: linear-gradient(90deg, transparent, rgba(8,14,20,0.28) 50%, transparent);

  /* ---------- geometry ---------- */
  --radius-page: 2px;          /* notebooks have corners */
  --radius-tab: 0 2px 2px 0;
  --radius-stamp: 50%;

  /* ---------- type ---------- */
  --font-display: "Space Grotesk", sans-serif;
  --font-body: "Inter", sans-serif;
  --font-katha: "Tiempos Text", "Source Serif 4", serif;
  --font-stamp: "IBM Plex Mono", monospace;

  --type-micro: 11px;  --type-small: 13px;  --type-base: 16px;
  --type-lead: 19px;   --type-heading: 28px; --type-display: 48px;
  --type-mega: clamp(72px, 9vw, 120px);
  --leading-ruled: var(--rule-pitch);

  /* ---------- motion ---------- */
  --ease-weight: cubic-bezier(0.2, 0, 0, 1);
  --ease-settle: cubic-bezier(0.33, 0, 0.1, 1);
  --dur-ink: 180ms;  --dur-wipe: 240ms;  --dur-turn: 450ms;
  --dur-open: 700ms; --dur-unfold: 600ms;
}
```

---

## 11. What to REMOVE

Every one of these is incompatible and goes to zero:

1. **All glow:** neon box-shadows, lime outer glows, text glow, glowing borders, hover glow states. Replaced by shadow.
2. **Dark cards on dark background** — the card-on-canvas pattern itself. Content is *on the page*, not in containers.
3. **Glassmorphism / frosted panels / backdrop-blur** anywhere in the dashboard.
4. **Gradient buttons and gradient borders.** Actions are inked text with ▸ and underline behavior.
5. **Progress rings, percent donuts, XP bars, level chips.** Replaced by pages-filled, the graphite gauge, and stamps.
6. **The paw shape** and any mascot-adjacent iconography.
7. **Streak flames / gamified urgency chips.** Replaced by the honest blank page (§5.4).
8. **Rounded-16px card radii, pill buttons, pill tab bar.** The `AppTabBar` pills on the dashboard are replaced by fore-edge tabs; radius system is 2px.
9. **All-caps UI labels and letter-spaced overlines.** Sentence case everywhere.
10. **Confetti, particles, badge-grid trophy walls, toast celebrations.** The mastery moment is the stroke + stamp, full stop.
11. **Skeleton shimmer loaders.** Loading = rules drawn on an empty page, then text wiping in.
12. **Exclamation marks, "try again," "great job," emoji** in any dashboard copy.
13. **The full-screen story overlay** as a pattern — replaced by the tipped-in letter.
14. **Lime as a bulk surface or text color.** One highlighter stroke or one object accent per screen.

---

## 12. Animation Spec

Doctrine: **weight over bounce.** Nothing overshoots, nothing springs, nothing loops. Standard easing `--ease-weight: cubic-bezier(0.2, 0, 0, 1)` — fast start, long settle, zero bounce. All animations respect `prefers-reduced-motion` (cut to 80ms opacity fades).

**12.1 The open (arrival, once per session) — 700ms total.**
Cover lifts and rotates open on its left hinge: `rotateY(0 → -160°)` over 450ms `--ease-weight`, `transform-origin: left`, perspective 1600px; the cover's moving shadow sweeps the right page (an overlay gradient animating opacity 0.3 → 0). At 300ms (overlapping), the spread scales from the closed footprint to full width (`scale 0.62 → 1`, 400ms). At 550ms, page content begins: rules draw in top-to-bottom (`scaleY` on a clipped container, 150ms), then the dateline and text wipe in with `clip-path: inset(0 0 100% 0 → 0)` at 240ms, staggered 60ms per block. Nothing fades — everything *wipes*, like writing.

**12.2 Page turn (section navigation) — 450ms.**
Not a full 3D curl. A two-layer sleight: the outgoing page slides toward the gutter (`translateX(0 → -6%)`) while a vertical shade gradient sweeps across it (`opacity 0 → 0.22 → 0`); simultaneously the incoming page slides from the gutter (`translateX(4% → 0)`) rising from `--shadow-tip-in` to none as it "lands." Both on `--ease-weight`, 450ms, content wipe following at 200ms overlap.

**12.3 The new entry (a session result lands in the record) — 700ms sequence.**
The date stamps first: mono date appears with a 1-frame 2px downward displacement and a subtle darkening (0.9 → 1 opacity in 120ms) — a stamp *press*, not a fade. Then the entry line writes: `clip-path` wipe left-to-right, 300ms. Then, if present, the graphite gauge cross-hatches in (`background-position` animation, 250ms). If a margin note accompanies it, it wipes in last after a 200ms beat.

**12.4 The mastery moment — 1.4s, the ceremony.**
Everything else on the page dims to 88% brightness (300ms). The highlighter stroke draws across the concept name left-to-right — `clip-path: inset(0 100% 0 0 → 0)`, **600ms**, `--ease-settle` — deliberately slower than every other animation in the product; this is the one moment allowed to take its time. At 500ms (overlapping), the stamp *presses*: it appears at `scale(1.15)`, `opacity 0.6`, and settles to `scale(1)`, full deboss shadow, in 250ms with a 1px downward translate at the end — pressure into paper. Page brightness returns over 300ms. This is the click, and it should feel like a fact being recorded, not a reward being dispensed.

**12.5 The letter (in/out)** — as specified in §7: slide-from-gutter 450ms, two-move unfold 350ms + settle, refold 300ms into the binding with an 80ms overlap into the session page-turn.

**12.6 The foldout map (in/out)** — two hinge moves out (300ms + 300ms, crease shadows sweeping, `--ease-weight`), nodes plotting in a 400ms stagger ordered by prerequisite depth (foundations plot first — the map *draws itself in learning order*). Refold reverses in 450ms total.

**12.7 The close (sign-out/idle) — 800ms.**
Content wipes out bottom-to-top (200ms), the spread scales down (400ms), the cover falls closed with its shadow sweeping the left page (350ms, overlapping), and the lime band slides across the cover left-to-right (200ms) — the last thing that moves on screen is The Click sealing the book.

**Performance guardrails:** animate only `transform`, `opacity`, and `clip-path`; grain overlay and rule backgrounds are static layers (`will-change` only during transitions, removed after); page-turn layers promoted with `translateZ(0)` for the duration only. Every sequence has a hard cap ≤ 1.4s and every *interactive* response (hover ink, ribbon pull, tab press) responds within 180ms.

---

*The test for every future component: could this exist in a beautiful notebook? A toast can't. A modal can't. A progress ring can't. A margin note can, a stamp can, a folded map can, a letter can. Hold that line, and Maya opens this in October and sees forty pages in her own record that prove she is someone who does math.*
