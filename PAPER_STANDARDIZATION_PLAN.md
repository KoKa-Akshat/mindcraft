# Build plan: standardize remaining dark/green pages onto the paper system

Lane: **Product** (`app/**`). Read DASHBOARD_NOTEBOOK_SPEC.md (paper
tokens/typography) and FABLE5_VISION.md (cluster colors, area briefs)
first. Reference implementations already shipped — match them, don't
invent a third look:
- Dashboard book (`Book.module.css`, `Dashboard.module.css`)
- Practice SESSION view (journal paper reskin, `Practice.module.css` —
  the session screens only; its hub screens are still teal)
- ConceptChapterPage desk (beige `--theme-bg` + paper sheet)
- The paper book panels (`DashboardPanels.module.css` — Task 3 of
  STUDY_SURFACE_TUTOR_PING_PLAN.md)

## Step 0 — extract shared tokens FIRST (everything else depends on it)

Create `app/src/styles/paper.css` (imported once in `main.tsx`) defining
the design tokens as CSS custom properties on `:root`, sourced from
DASHBOARD_NOTEBOOK_SPEC + the shipped surfaces (do not invent values —
lift them from Book.module.css / DashboardPanels.module.css):
`--paper-bg`, `--paper-sheet`, `--paper-ink`, `--paper-ink-dim`,
`--paper-rule` (ruled-line color), `--paper-accent-red` (bookmark),
plus the font stacks (`--font-hand`, `--font-mono`, `--font-serif`).
The per-user theme (`dashboardTheme.paper`) already overrides paper vars
on the book root — point it at these tokens so a student's chosen paper
tone follows them onto every standardized page, not just the dashboard.

## Step 1 — the offenders (verified against current CSS, priority order)

| Page | Route | Today | Treatment |
|------|-------|-------|-----------|
| Practice HUB screens (mode picker, path view, category chips) | `/practice` | `--practice-bg: #21616E` teal + lime accent | Paper page; keep cluster-colored accents for concept chips per FABLE5_VISION. Session view already done — make hub match it. |
| KnowledgeGraph | `/knowledge-graph` | `#006b66` green | Paper frame, mono header/legend, ink text. The graph canvas itself may keep a deep-slate plotting field as a "chart area" INSIDE the paper frame (spec precedent: map panel) — but chrome, side panels, route drawer all paper. |
| StudentSessions + SessionDetail | `/sessions`, session pages | dark | Notes surfaces — journal-entry list like the paper notes panel; detail = ruled paper with mono meta. |
| GradeOnboard | `/onboard` | `#080e14` | FIRST-RUN experience — highest cohesion value. Paper + hand font per BRAND_BOOK voice. |
| Book | `/book` (booking) | check | Paper form: underlined inputs, mono submit. |
| SessionWork | `/session-work/:id` | check | Already hosts ScratchPad; frame it in paper like ConceptChapterPage's scratch pages. |
| Chat | `/chat/:partnerId` | dark | Paper thread: bubbles as ink-outlined paper cards; keep sender tint subtle. |
| StudyTimer | `/study-timer` | dark | Paper + big mono clock. |
| OrganizeNotes | `/organize-notes` | `#0069ff` blue | Paper board; keep subject colors as chip accents only. |
| JoinClassroom | `/join-classroom` | check | Paper card, mono code input. |
| Prep | `/prep` | `#0A0A0F` | LOWEST priority — confirm with Akshat it's staying before touching (may be superseded by book flow). |

Explicitly OUT: `Login` (dark entry screen is a deliberate threshold —
decide separately), `Admin` + tutor/parent dashboards (internal tools),
`/constellation*` labs (legacy, not student-routed), the 3D world.

## Rules of engagement
- One page per commit; use the tokens — NO new hardcoded hex values
  (grep yourself for `#[0-9a-f]{6}` in the diff before committing).
- Don't change layout/behavior — this is a skin pass. Anything that needs
  structural change gets a note in ACTIVE_TASK.md instead of improvising.
- Interactive states (hover/active/disabled) must keep ≥4.5:1 contrast on
  the lightest paper preset AND the darkest (test with the theme drawer).
- MathText/KaTeX renders ink-on-paper already — don't restyle `.katex`.
- Coordinate via ACTIVE_TASK.md rows per page — Akshat's lane is active;
  claim pages there before starting so nothing is double-skinned.

## Acceptance (per page)
- [ ] No teal/green/near-black full-page background remains; page reads
      as the same journal as Dashboard/Practice-session.
- [ ] Student theme presets (paper tone) visibly apply.
- [ ] No behavior/layout diffs beyond the skin.
