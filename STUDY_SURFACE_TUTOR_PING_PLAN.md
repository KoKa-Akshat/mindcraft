# Build plan: beige full-bleed study surface + real Ping-a-tutor + paper book panels

All Product lane (`app/**`), one agent can take the whole file. Read
DASHBOARD_NOTEBOOK_SPEC.md (paper system) and BRAND_BOOK.md (copy voice)
before starting — surfaces must follow the Field Journal paper language.

## Task 1 — Kill the black desk on the chapter reader

**The page**: `ConceptChapterPage.tsx` — the story/questions reader Study
and Practice open. The paper sheet is already themed beige per cluster
(`CLUSTER_THEME[cluster].bg/paper`, passed as CSS vars `--theme-bg` etc. on
`.desk`), but the desk behind it is hardcoded near-black.

Changes in `ConceptChapterPage.module.css`:
1. `.desk` (line ~6): replace `background: #0c0e08` + dark radial gradient
   with the cluster paper tone: `background: var(--theme-bg)`. Optional: a
   very soft warm vignette (few % darker at edges) for depth — NO dark hues.
2. The paper `.page` should read as the whole page: stretch to fill the
   viewport height (`min-height: calc(100dvh - <desk padding>)`) so there is
   no contrasting band above/below; keep a whisper of shadow so the sheet
   still reads as paper on the desk.
3. Sweep every style that assumes a dark desk (search the module for
   `rgba(255,255,255` and light-on-dark text):
   - `.backBtn` (white-alpha pill) → ink-on-paper: `color: var(--theme-ink)`,
     border `var(--theme-ink)` at ~15% alpha, transparent/paper bg.
   - Page-dots / nav arrows / footer bar — same inversion.
   - Floating pills (Ping tutor, Calculator) — keep readable on beige:
     paper bg + ink text + subtle border, accent on hover.
   - The page-flip/enter animation shadows — soften for a light desk (no
     black glows).
4. The floating panels (`showCalc`, `showPing` popups) must still contrast:
   paper-white cards with an ink border + shadow work on beige.

Acceptance:
- [x] No black anywhere on cover/story/question/scratch pages, all 4
      cluster themes (algebra beige, geometry blue-grey, functions green,
      data warm red — visit one concept from each).
- [x] back button, dots, arrows, floating pills all legible on the light desk.
- [x] Page-flip transition still looks right (no dark flash between pages).

## Task 2 — Make “Ping tutor” real (and add it to Practice)

`sendPing` (`ConceptChapterPage.tsx` ~line 361) is a stub — it fakes
success and writes nothing. Wire it to the existing chat infrastructure
(`Chat.tsx` is the reference implementation):

1. Resolve the tutor: read `users/{uid}.tutorId` (server-authoritative,
   set by classroom join). Load once alongside the page's other user reads.
2. On send:
   - `chatId = [uid, tutorId].sort().join('_')`
   - `addDoc(chats/{chatId}/messages, { senderId: uid, text, fileUrl: null,
     fileName: null, fileType: null, createdAt: serverTimestamp() })`
   - `setDoc(chats/{chatId}, { participants: [uid, tutorId], lastMessage,
     lastAt: serverTimestamp() }, { merge: true })`
   (exact shape from `Chat.tsx:sendMessage` — keep it identical so the
   Chat page and tutor views render it.)
   - Prefix the student's message with context so the tutor knows where
     they are: concept name + (if on a question page) the question text,
     e.g. `📍 Systems of Equations, Q3: <first 120 chars>… — <student msg>`.
3. No `tutorId` → the popup explains instead of lying: “You're not linked
   to a tutor yet — join your tutor's classroom first.” (BRAND_BOOK tone.)
   Keep the button visible; the popup is the explainer.
4. Firestore rules already allow this write (`chats/{chatId}` requires uid
   ∈ chatId parts — verified). No rules change.
5. Add the same floating “Ping tutor” pill + popup to the Practice session
   view (`Practice.tsx`) — extract the popup into a small shared component
   (`components/PingTutor.tsx`) rather than duplicating.

Acceptance:
- [x] Student with a linked tutor pings from chapter page → message appears
      in `chats/{uid_tutorId}/messages` and in the Chat page thread.
- [x] Ping includes concept/question context automatically.
- [x] Student without a tutor gets the explainer, no write, no error.
- [x] Same flow works from a Practice session.

## Task 3 — Book panels: session notes + knowledge map in the paper style

The dashboard book's **problem solver** panel is the reference: content
sits directly on the ruled/dotted paper — mono `← today` nav + lowercase
panel title, italic serif helper line, underlined-paper input, mono
`Build hint path →` button, mono `Open full … →` text link. The **session
notes** and **knowledge map** panels instead render as dark rounded cards
floating in the book — because `DashboardNotesPanel.tsx`,
`ConstellationGpsExplorer.tsx`, and `DashboardRoutePanel.tsx` all import
the dark `ConstellationGpsLab.module.css`. Re-skin all three to the paper
language.

Rules of engagement:
- Do NOT edit `ConstellationGpsLab.module.css` (shared with the full
  constellation/GPS pages). Add paper styles to
  `DashboardPanels.module.css` (already imported as `n` in the notes
  panel) and switch the three components' class usage over.
- Do NOT touch the full-page `/knowledge-graph` route — only the embedded
  book panels.
- Match the solver panel's existing classes in `Dashboard.module.css`
  (`solverHint`, `solverInput`, `solverSubmit`) — reuse or mirror them.

Per panel:
1. **Session notes** (`DashboardNotesPanel.tsx`): search box → single-line
   underlined paper input with mono placeholder; each note = a journal
   entry (mono date + tutor line, serif title, bullets on ruled lines,
   expand inline); empty state = italic serif line
   ("No published session notes yet.") with mono text links
   `Book a session →` and `Open full notes page →` styled like
   `Open full problem solver →`. No dark card, no rounded dark header.
2. **Knowledge map** (`ConstellationGpsExplorer.tsx`): concept search +
   `Plot route →` as paper input + mono button; the map field renders on
   the page's dotted paper, not a black canvas — ink-toned edges/labels,
   keep the four status hues for nodes (they read fine on paper); legend
   becomes a small mono caption row under the field; coverage bar = thin
   ink progress line; empty state = italic serif message on the dotted
   paper.
3. **Route panel** (`DashboardRoutePanel.tsx`): same treatment — step list
   as journal checklist on ruled lines (mono step numbers, serif names,
   status as small ink chips).

Acceptance:
- [ ] No dark card inside any book page — solver, notes, map, and route
      panels all read as the same paper journal.
- [ ] All interactions unchanged (search, expand, plot route, step click).
- [ ] Full-page knowledge graph route untouched.

## Task 4 — Admin view-all (already shipped — verify only)

Shipped in commit `101dc07a`: admin sidebar links to Student Dashboard /
Practice / Knowledge Map (+ tutor/parent), and role-gated “Admin Panel”
back-links on the student pages. Nothing to build. Verify once deployed:
sign in as admin → /admin → each of the five links opens and navigates
back. If anything misbehaves, file it against Task A of
ADMIN_VIEWS_TRANSCRIBE_LATEX_PLAN.md.
