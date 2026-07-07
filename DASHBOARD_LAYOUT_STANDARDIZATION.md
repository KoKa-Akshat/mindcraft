# Layout standardization: ConceptChapterPage, Problem Solver, Session Notes

Confirmed live in the browser (screenshots taken against the current running
app, not guessed from CSS alone). Three surfaces currently use three different,
uncoordinated "page shell" patterns — this is the artifact of several rapid,
independent redesign passes on Dashboard/TutorDashboard/Admin/ConceptChapterPage
in quick succession without a shared convention.

## Current state (measured on a 1440×900 viewport)

| Surface | Container | Width | Height | Notes |
|---|---|---|---|---|
| `ConceptChapterPage.tsx` (story + questions) | `.desk` → `.page` | `width: min(860px, 96vw)` — hard-capped at 860px, ignores viewport | `min-height: min(580px, 84dvh)` — only a MINIMUM, grows with content | **Confirmed visibly inconsistent**: cover page ~580px tall, story page ~627px, question page ~705px, on the SAME concept. Card floats centered with large unused dark margins left/right on any screen wider than ~900px. |
| Practice → Problem Solver | `.solverWrap` → `.solverPanel` | `width: min(100%, 980px)` — capped at 980px | Grid `align-items: stretch` (internally consistent between its own two cards) but the outer wrap doesn't fill the viewport | Two floating dark-teal cards, same "island in empty space" problem as ConceptChapterPage, different card treatment. |
| `StudentSessions.tsx` (Session Notes) | `.shell` → `.page` | **No max-width set** — genuinely fills available width | `min-height: 100vh` on `.shell` | This is the one surface that already does what the other two should — full-bleed, uses the actual viewport. |

**This is exactly what's being asked for**: make ConceptChapterPage's beige area
fill the screen (not a small centered card), make ALL its pages (cover/story/
question) the same fixed size instead of reflowing per page, and make Problem
Solver match Session Notes' already-correct full-bleed convention instead of
its own separate capped-card layout.

---

## Fix 1 — `ConceptChapterPage.module.css`: full-screen, fixed-size page

**`.desk`** (~line 4) already correctly uses `min-height: 100dvh` and centers
its child — the desk/background is fine. The problem is entirely in **`.page`**
(~line 34):
```css
.page {
  width: min(860px, 96vw);
  min-height: min(580px, 84dvh);
  ...
}
```
Change to fill the viewport (minus a reasonable margin) and use a genuine
fixed `height` (not `min-height`) so every page — cover, story, question — is
IDENTICAL in size regardless of content:
```css
.page {
  width: min(1280px, 96vw);
  height: min(820px, 88dvh);
  ...
}
```
Since content length varies (some stories are longer than others, some
questions have 3 choices vs 5), a fixed `height` will overflow on the longest
content. The story-text container and question-body container inside `.page`
need `overflow-y: auto` so long content scrolls WITHIN the fixed card rather
than growing the card itself. Check the inner containers (~line 198-289,
various `max-width: 48ch`/`52ch`/`58ch` text columns) for where to add
`overflow-y: auto` and a `max-height` matching the new fixed `.page` height
minus header/nav chrome inside the card.

Also check the `@media (min-width: 768px) and (max-width: 1024px)` override
(~line 679-683) which currently sets its OWN smaller `width: min(800px, 96vw)`
— update this breakpoint consistently with whatever the new base values are,
or it'll reintroduce the same inconsistency on tablet widths specifically.

**Test:** navigate through a concept's cover → all 3 story pages → all 4+
question pages. The beige card should be pixel-identical in width AND height
across every single page — only the content inside scrolls/changes.

---

## Fix 2 — Practice Problem Solver: adopt the same full-screen convention

**`Practice.module.css`** (~line 861):
```css
.solverWrap {
  width: min(100%, 980px);
  margin: 0 auto;
}
```
Loosen the cap to match the wider convention from Fix 1 (or remove the cap
entirely and rely on padding, matching `StudentSessions.module.css`'s
approach of no `max-width` at all — recommend picking ONE of these two
approaches and applying it to both this and Fix 1, not inventing a third
number). The `.solverPanel` grid (`grid-template-columns: minmax(260px,
0.9fr) minmax(420px, 1.1fr)`) already stretches to fill `.solverWrap`, so
loosening the wrap's cap should be enough to make the two cards fill the
screen properly without further grid changes.

**Test:** open Problem Solver on a 1440px+ wide screen — the two cards should
use most of the available width, not float with large dark margins on both
sides like the current screenshot shows.

---

## Fix 3 — Shared convention: Problem Solver should visually match Session Notes

Per the explicit ask ("question help and session notes should be the same
format"): rather than Problem Solver inventing its own floating-card
aesthetic, it should read as the same surface as `StudentSessions.tsx`.
Concretely:
- Match the outer container pattern: `StudentSessions.module.css`'s `.shell`
  (nav + full-width `.page` below it, no width cap) is the reference —
  Problem Solver's `.solverWrap`/`.solverPanel` should sit inside the same
  kind of shell rather than being its own centered, capped block.
- Match header treatment: `StudentSessions.tsx` has a `.header` row (title +
  count + "View Knowledge Graph" button) at a consistent position/padding
  from the nav. Problem Solver's current header (`Dashboard | Problem
  Solver` toggle pill, top-right) uses different spacing/positioning —
  align these so switching between "Session Notes" and "Problem Solver" via
  the nav feels like moving between tabs of the same page, not two
  different apps.
- Don't necessarily need a literal shared CSS file for this pass — visual
  parity (same padding scale, same header pattern, same content-width
  convention) is the goal. A shared module is a reasonable follow-up if this
  pattern needs to extend to a 4th/5th surface later, but not required to
  close this specific request.

**Test:** flip between Session Notes and Problem Solver (both reachable from
the same nav bar) — they should feel like the same product, not a jump
between two different design languages.

## Suggested order
Fix 1 (ConceptChapterPage) is the most visible/frequently-hit surface —
students pass through it on every concept click. Fix 2 and 3 are the same
underlying change (Problem Solver's container) viewed from two angles — do
them together.