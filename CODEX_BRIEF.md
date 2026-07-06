# CODEX_BRIEF.md — MindCraft Implementation Brief

> Read this before touching any file. This is the briefing AND the compass for
> Codex, Cursor, and any AI coding agent working in this repo.
> Deep references: `BRAND_BOOK.md` (voice), `AGENT_RULEBOOK.md` (LLM contracts),
> `DASHBOARD_NOTEBOOK_SPEC.md` (journal design system).

---

## What MindCraft Is

MindCraft pairs high school students with human tutors, builds a per-student
knowledge graph of 42 math concepts, and drives personalized practice.

The deterministic engine (Python ML, `ml/`) decides WHAT to teach and in what
ORDER. The LLM/agent layer owns HOW it is experienced — story, framing, tone,
scaffolding.

**The core law, never broken:** the deterministic engine owns structural
decisions. The LLM owns language. Never overlap. An LLM never decides what
concept comes next. The engine never writes copy.

---

## Who We Build For

**Maya. Sixteen. B- by memorization. Rationing her shame.** She was told she's
not a math person. MindCraft is the thing that changes that verdict.

**The click** is the product: the specific felt experience of suddenly seeing
the pattern. Not the grade. Not the score. The feeling. Every design decision,
every copy choice, every agent output asks one question: *does this serve the
click?* If the answer is no — cut it.

---

## The Adaptive Learning Thesis (the company's core IP)

Most tutoring systems ask: "What problem did the student get wrong?"
MindCraft asks: **"What state was the learner in when the problem broke?"**

A wrong answer is a signal of one of: attention fatigue, working-memory
overload, sequencing issues, language confusion, low confidence, math anxiety,
or a missing conceptual schema.

The system adapts across four layers:

1. **Math model** — what concept is weak? (deterministic engine)
2. **Cognitive model** — what mental process is overloaded? (time + attempt signals)
3. **Affective model** — what emotional state is blocking learning? (check-in agent + affective modifier)
4. **Independence model** — how much support can we safely remove today? (bridge gap severity + session history)

The agent loop: **Detect → Diagnose → Scaffold → Regulate → Retry → Fade
support → Reflect.**

The moat is NOT problem generation. The moat is the learner profile: "This
child learns best with visual-first scaffolding, low verbal load, no timers,
8-minute sessions." That profile compounds in value over time. Every feature
you build should feed it or draw from it.

---

## Current State — Built and Deployed

### Frontend — live at `mindcraft-93858.web.app`
- `app/` — React (Vite + TS), Firebase Hosting, CI-deployed on push to `main`.
- **Login** (`app/src/pages/Login.tsx`) — warm cream / forest green frosted
  glass. Google OAuth + email auth. Stable.
- **Dashboard** (`app/src/pages/Dashboard.tsx`) — PawHub launcher: paw-shaped
  hub with toe buttons (Practice, Learn, Homework Help, GPS, Notes).
- **Practice** (`app/src/pages/Practice.tsx`) — full session flow: gap scan →
  recommendation → story splash → question sequence → outcome recording.
- **Knowledge Graph** (`app/src/pages/KnowledgeGraph.tsx`) — constellation view
  of the 42-concept graph.
- **Concept Chapter Page** (`app/src/pages/ConceptChapterPage.tsx`) — NEW.
  Two-page journal spread per concept. Left page: Katha story (Source Serif 4,
  warm ivory, rule lines). Right page: ingredient list + question preview +
  "Practice this chapter" CTA. Route: `/concept/:conceptId`. Opened by clicking
  topics in the learning path mini.
- **Gap scan** — per-concept confidence flow → `/seed-assessment` → diagnostic
  complete.
- **Question bank** — ~1,500 questions across 24 concepts (static ACT + Eedi
  GCSE + generated), merged in `app/src/lib/questionBank.ts`.

### ML engine — Cloud Run, separate GCP project (Blake's lane)
- `POST /recommend` — concept pathfinder (exam / curriculum / explore modes)
- `POST /seed-assessment` — seeds graph from onboarding confidence ratings
- `POST /record-outcomes` — records practice outcomes to the graph
- `GET /knowledge-graph/{uid}` — full node/edge graph with bridge gaps
- `GET /exam-concepts/{exam}` — 29 ACT concept IDs
- All endpoints require Firebase ID token auth (attached via `mlAuthHeaders()`
  in `app/src/lib/mlApi.ts`).

### Story system
- `app/src/data/conceptStories.json` — 41 concept stories, Katha voice,
  already generated. Read-only from the frontend.
- Each story: `story` (long narrative) + `ingredientStories` (3-4
  ingredient-level stories). Discovery-focused historical narratives — the
  scribe at the Nile for fractions, the navigator for linear equations.

---

## Design System

### The world vs. the page
Deep Field `#080e14` is the world — desk, chrome, covers. Warm ivory `#f7f3ee`
is the page interior — ALL content. The product is a **field journal on a dark
desk**. Cinema outside, intimacy inside.

### Canonical CSS tokens (from `DASHBOARD_NOTEBOOK_SPEC.md`)
```css
--paper-base: #f7f3ee;       /* warm ivory page */
--paper-raised: #fbf8f3;     /* current/active sheet */
--paper-recessed: #efe9e0;   /* older entries */
--paper-edge: #e6ddd0;       /* page-edge stack */
--ink-system: #1c1a17;       /* engine voice — warm near-black */
--ink-katha: #232f4e;        /* Katha/story ink — iron-gall blue-black */
--ink-pencil: #6f6a61;       /* pencil/agent notes — graphite */
--ink-depth: #1d3a8a;        /* structural accents, links */
--rule: rgba(29,58,138,0.10);        /* feint notebook rule lines */
--rule-pitch: 32px;                  /* body line-height locked to this */
--margin-rule: rgba(193,18,31,0.28); /* red margin line */
--margin-width: 72px;
--cover: #080e14;            /* Deep Field */
--click: #c4f547;            /* lime — ONE use per screen, mastery signal */
--stakes: #c1121f;           /* Stakes red — gap severity, narrative tension */
```

### Typography (all fonts already loaded)
- Display / engine voice: **Space Grotesk**
- Body / UI: **Inter** or **DM Sans**
- Katha / story: **Source Serif 4 italic**
- Stamp / dates / code: **IBM Plex Mono**

### Motion doctrine
Weight over bounce. `cubic-bezier(0.2, 0, 0, 1)`. Nothing overshoots. Nothing
animates to seem lively — only state changes animate.

### Remove on sight (from old screens)
Glow, dark cards on dark background, glassmorphism, gradient buttons, progress
rings / XP bars, streak flames, 16px border radii, all-caps labels, confetti,
exclamation marks, emoji in product copy, skeleton shimmer loaders.

---

## The Experience Journey

### 1. Marketing site (`mindcraft-marketing-site.web.app`, repo root)
Warm cream + forest green. Parent-first. The headline is a verdict reversal:
"You were never bad at math." Pricing is invitation-based, not transactional:
"A few seats remain." CTA: "Apply for a seat." No stock photos — type is the
image. **Open item:** the hero art div still uses a stock photo. Replace it
with a CSS/SVG knowledge-map fragment (see Priority 3).

### 2. Login (`/login`)
Warm cream frosted glass, forest green palette. Already well-designed and
consistent with marketing. Do not rearchitect.

### 3. Onboarding / diagnostic — in Jesse's Kitchen
The in-world diagnostic in `worlds/world2/` (3D world) triggers at the Projects
sign: `mc-diagnostic.js` + `data/actDiagnostic.json`. It redirects to the web
app via a `?diag=` URL param carrying confidence + goals; `Diagnostic.tsx`
reads it and posts to `/seed-assessment`. **This pipeline WORKS — don't break
it. Improvements go on top.**

Planned (not built): a richer diagnostic — grade-aware, goal-aware,
story-driven. The student (1) enters grade + goals in a warm conversational UI,
not a form; (2) sees 2-3 real questions at grade level (LLM-selected from the
question bank via `/onboard-agent`); (3) gets a brief story showing the kind of
problem they'll solve; (4) lands in the journal with their map already built.

### 4. The journal / dashboard — THE MAIN EXPERIENCE
Spec: `DASHBOARD_NOTEBOOK_SPEC.md`. The field journal (closed cover →
page-open → two-page spread) is the TARGET. The current PawHub is a stepping
stone. Clicking a chapter (concept) should flip pages into that chapter's
two-page spread — Katha story on the left, practice on the right.
`ConceptChapterPage.tsx` already renders as the two-page spread and IS the
chapter page. Missing: the page-flip navigation from within the journal.

### 5. Practice sessions
Story splash → questions → outcomes. Working. Do NOT rearchitect.

### 6. Question rendering — CRITICAL GAP
Questions render as plain text today. Math like `\frac{3}{4}` or
`x^2 + 5x + 6 = 0` needs LaTeX rendering. Use KaTeX. Questions must look like
they are PART OF THE PAGE — same paper, same typography — never a floating
card on a dark background.

---

## Active Work — Priorities In Order

### Priority 1: LaTeX in questions
Install the `katex` package. Build a `<MathText>` component that detects
`$...$` inline and `$$...$$` block math in question stems and renders via
KaTeX. Wire it into `ConceptChapterPage.tsx` first, then `Practice.tsx`.
Questions sit on the paper, not in a separate card on dark background.

### Priority 2: Journal page-flip navigation
From the dashboard, clicking a concept topic triggers a page-turn into the
chapter spread (`ConceptChapterPage`). Animation: current spread slides toward
the gutter (`translateX(-6%)`); incoming chapter spread slides from the gutter
side (`translateX(4%) → 0`). Both on `--ease-weight`, 450ms.

### Priority 3: Marketing hero → CSS knowledge map
Replace `<div class="hero-art">` (stock photo) with a CSS/SVG knowledge-map
fragment: 6-8 concept nodes as circles with connections, in brand colors
(navy, lime, ivory), with a subtle entrance animation — nodes plotting in from
the left, connections drawing in. Zero image dependency.

### Priority 4: Diagnostic story experience
Upgrade the gap scan to be conversational and grade-aware. The confidence
rating page currently lists all 29 ACT concepts as text. Instead:
- Group concepts by cluster (algebra, geometry, functions, data).
- Show one real question per cluster for calibration.
- Make it feel like the journal: warm ivory cards, a Katha intro paragraph.

### Priority 5: Answer cognitive state tagging
On every answer, derive and store a `cognitive_signal`:

| Signal | Condition |
|--------|-----------|
| `fluent` | fast correct (< 15s) |
| `effortful` | slow correct (> 45s) |
| `anxious` | fast wrong (< 15s) — overconfident gap or guessing |
| `overloaded` | slow wrong (> 45s) |

Send these to `/record-outcomes` as additional fields. They build the
independence model over time.

---

## File Ownership Map

| What | Files | Status |
|------|-------|--------|
| Marketing site | `index.html`, `style.css`, root static | Active — Codex works here |
| Login | `app/src/pages/Login.tsx`, `Login.module.css` | Stable — do not rearchitect |
| Dashboard | `app/src/pages/Dashboard.tsx` | Stepping stone (PawHub) — moving toward field journal |
| Chapter page | `app/src/pages/ConceptChapterPage.tsx` | New — extend, don't revert |
| Practice | `app/src/pages/Practice.tsx` | Stable — extend, don't rearchitect |
| Question bank | `app/src/lib/questionBank.ts` | Seam file — coordinate before changing shape |
| ML client | `app/src/lib/mlApi.ts` | Seam file — coordinate before changing |
| Concept stories | `app/src/data/conceptStories.json` | 41 stories, read-only from frontend |
| ML backend | `ml/` | Blake's lane — do not touch unless explicitly tasked |
| Worlds | `worlds/` | Blake's lane |
| Brand docs | `BRAND_BOOK.md`, `AGENT_RULEBOOK.md`, `DASHBOARD_NOTEBOOK_SPEC.md` | Read-only reference |

### Lane ownership — prevents collisions

| Lane | Owner | Tree |
|------|-------|------|
| Engine | Blake (co-founder) | `ml/**`, `webhook/**`, `data/**`, `worlds/**` |
| Product | Akshat | `app/**`, `index.html`, `blog.html`, root marketing files |

Shared seam files — coordinate before changing:
- `app/src/lib/questionBank.ts` — question shape contract
- `app/src/lib/mlApi.ts` — API client
- `CLAUDE.md` — the repo's instruction file

---

## Design Principles That Break Ties

1. **The click is the product.** If a feature doesn't directly lead Maya toward
   the moment she sees the pattern, cut it.
2. **Shadow, not glow.** Everything has weight. Nothing radiates.
3. **The margin is where stakes live.** Red (`#c1121f`) never marks a wrong
   answer. It marks gaps and tension.
4. **Warm outside, serious inside.** Marketing and login are warm and inviting.
   The journal is serious, beautiful, and theirs.
5. **One lime per screen.** `#c4f547` appears exactly once — on the most
   important action or the mastery signal.
6. **The written layer never lies.** Pencil/agent notes feel hand-touched
   through *behavior* — tilt, serif italic, rule-sitting — not decorative fonts.
7. **Reduce extraneous load before increasing difficulty.** No timers, no red
   X, no dense screens, one task per screen.
8. **Never say:** wrong, incorrect, try again, easy, fix, catch up, behind,
   AI tutor, quiz, great job!!, awesome, diagnostic test.

---

## Deploy Rules

- **Frontend deploys automatically on every `git push origin main`.** CI builds
  and deploys all three Firebase Hosting targets (app, world1, marketing).
  **Never run `firebase deploy` manually** — it publishes local disk and
  overwrites CI.
- **ML backend (`ml/`)** deploys to a separate GCP project, manually. Every
  deploy must pass BOTH `FIRESTORE_PROJECT=mindcraft-93858` AND
  `ML_SERVICE_SECRET=<secret>` in `--set-env-vars` — the flag replaces the
  whole set, so omitting one drops it.

---

## The One Question That Breaks Ties

**Does this serve the click?**

If a design element, copy choice, or feature does not directly lead Maya
toward the moment she suddenly sees the pattern — cut it.
